/**
 * Tests for the resilience layer added to AlegraClient:
 *   - single-flight de-duplication of concurrent identical requests
 *   - retry with backoff on 429 / 5xx / transient network errors
 *   - non-retry of deterministic failures (401, 404, timeouts)
 *   - optimistic rate-limit slot reservation
 *
 * Timing is driven with fake timers so a test that exercises a 60-second
 * backoff still runs in milliseconds.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AlegraClient, backoffDelay } from '../client'
import { AlegraError, AuthError } from '../errors'

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function buildResponse(overrides: {
  status?: number
  json?: unknown
  rateLimitRemaining?: string
  rateLimitReset?: string
  retryAfter?: string
}): Response {
  const status = overrides.status ?? 200
  const headers = new Headers()
  if (overrides.rateLimitRemaining !== undefined) {
    headers.set('X-Rate-Limit-Remaining', overrides.rateLimitRemaining)
  }
  if (overrides.rateLimitReset !== undefined) {
    headers.set('X-Rate-Limit-Reset', overrides.rateLimitReset)
  }
  if (overrides.retryAfter !== undefined) {
    headers.set('Retry-After', overrides.retryAfter)
  }
  headers.set('content-type', 'application/json')

  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: `Status ${status}`,
    headers,
    json: () => Promise.resolve(overrides.json),
    text: () => Promise.resolve(JSON.stringify(overrides.json ?? '')),
  } as unknown as Response
}

function emptyInvoices() {
  return { metadata: { total: 0 }, data: [] }
}

function companyPayload() {
  return {
    name: 'Administración Segura',
    country: 'CO',
    applicationVersion: 'colombia',
    decimalPrecision: 0,
    currency: { code: 'COP', symbol: '$' },
  }
}

/**
 * Resolve a pending client call while letting all scheduled timers fire.
 *
 * The no-op `.catch` is load-bearing: without a handler attached BEFORE the
 * timers are drained, a rejecting call is momentarily unhandled and Vitest
 * flags it as an unhandled rejection. The original promise is still what's
 * returned, so the caller's `.rejects` assertion still sees the failure.
 */
async function settle<T>(promise: Promise<T>): Promise<T> {
  promise.catch(() => {})
  await vi.runAllTimersAsync()
  return promise
}

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  process.env.ALEGRA_EMAIL = 'integration@example.com'
  process.env.ALEGRA_TOKEN = 'test-token-abc123'
  vi.useFakeTimers()
  // Silence the retry/rate-limit warnings the client emits by design.
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.unstubAllGlobals()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

// -----------------------------------------------------------------------------
// Single flight
// -----------------------------------------------------------------------------

describe('AlegraClient — single flight', () => {
  it('colapsa dos llamadas idénticas concurrentes en un solo fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(buildResponse({ json: companyPayload() }))
    vi.stubGlobal('fetch', fetchMock)

    const client = new AlegraClient()
    const [a, b] = await settle(Promise.all([client.getCompany(), client.getCompany()]))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    // Both callers must receive the same resolved value.
    expect(a).toEqual(b)
  })

  it('NO colapsa llamadas a URLs distintas', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(
        url.includes('/company')
          ? buildResponse({ json: companyPayload() })
          : buildResponse({ json: emptyInvoices() }),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const client = new AlegraClient()
    await settle(Promise.all([client.getCompany(), client.listInvoices()]))

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('libera la key al terminar — una llamada posterior vuelve a pegarle a la API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(buildResponse({ json: companyPayload() }))
    vi.stubGlobal('fetch', fetchMock)

    const client = new AlegraClient()
    await settle(client.getCompany())
    await settle(client.getCompany())

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('una request fallida no envenena la key para el siguiente caller', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(buildResponse({ status: 401, json: { error: 'bad creds' } }))
      .mockResolvedValue(buildResponse({ json: companyPayload() }))
    vi.stubGlobal('fetch', fetchMock)

    const client = new AlegraClient()

    await expect(settle(client.getCompany())).rejects.toBeInstanceOf(AuthError)

    // The failure must have evicted the in-flight entry, so this succeeds.
    const company = await settle(client.getCompany())
    expect(company.currency.code).toBe('COP')
  })
})

// -----------------------------------------------------------------------------
// Retry
// -----------------------------------------------------------------------------

describe('AlegraClient — retry', () => {
  it('reintenta un 429 y devuelve el resultado del segundo intento', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(buildResponse({ status: 429, retryAfter: '1', json: { error: 'rate' } }))
      .mockResolvedValue(buildResponse({ json: emptyInvoices() }))
    vi.stubGlobal('fetch', fetchMock)

    const client = new AlegraClient()
    const result = await settle(client.listInvoices())

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.total).toBe(0)
  })

  it('reintenta un 500 y se recupera', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(buildResponse({ status: 500 }))
      .mockResolvedValue(buildResponse({ json: emptyInvoices() }))
    vi.stubGlobal('fetch', fetchMock)

    const client = new AlegraClient()
    const result = await settle(client.listInvoices())

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.total).toBe(0)
  })

  it('agota los reintentos y tira el error (3 intentos = 1 + 2 retries)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(buildResponse({ status: 503 }))
    vi.stubGlobal('fetch', fetchMock)

    const client = new AlegraClient()
    await expect(settle(client.listInvoices())).rejects.toBeInstanceOf(AlegraError)

    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('NO reintenta un 401 — es determinista, reintentar solo quema cuota', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      buildResponse({ status: 401, json: { error: 'invalid credentials' } }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const client = new AlegraClient()
    await expect(settle(client.listInvoices())).rejects.toBeInstanceOf(AuthError)

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('NO reintenta un 404', async () => {
    const fetchMock = vi.fn().mockResolvedValue(buildResponse({ status: 404 }))
    vi.stubGlobal('fetch', fetchMock)

    const client = new AlegraClient()
    await expect(settle(client.getInvoice('999'))).rejects.toMatchObject({ digest: 'HTTP_404' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('reintenta un error de red transitorio', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValue(buildResponse({ json: emptyInvoices() }))
    vi.stubGlobal('fetch', fetchMock)

    const client = new AlegraClient()
    const result = await settle(client.listInvoices())

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.total).toBe(0)
  })

  it('NO reintenta un timeout — tres intentos serían 30s de skeleton', async () => {
    const timeoutError = new Error('The operation was aborted due to timeout')
    timeoutError.name = 'TimeoutError'

    const fetchMock = vi.fn().mockRejectedValue(timeoutError)
    vi.stubGlobal('fetch', fetchMock)

    const client = new AlegraClient()
    await expect(settle(client.listInvoices())).rejects.toMatchObject({ digest: 'TIMEOUT' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('usa un AbortSignal nuevo por intento (uno reusado abortaría los retries)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(buildResponse({ status: 500 }))
      .mockResolvedValue(buildResponse({ json: emptyInvoices() }))
    vi.stubGlobal('fetch', fetchMock)

    const client = new AlegraClient()
    await settle(client.listInvoices())

    const firstSignal = (fetchMock.mock.calls[0]![1] as RequestInit).signal
    const secondSignal = (fetchMock.mock.calls[1]![1] as RequestInit).signal
    expect(firstSignal).toBeDefined()
    expect(secondSignal).toBeDefined()
    expect(firstSignal).not.toBe(secondSignal)
  })
})

// -----------------------------------------------------------------------------
// Estimate ordering — load-bearing, not cosmetic
// -----------------------------------------------------------------------------

describe('AlegraClient — orden de /estimates', () => {
  function urlOf(fetchMock: ReturnType<typeof vi.fn>): URL {
    return new URL(fetchMock.mock.calls[0]![0] as string)
  }

  it('fuerza order_field=id — la paginación por fecha no es estable', async () => {
    const fetchMock = vi.fn().mockResolvedValue(buildResponse({ json: { metadata: { total: 0 }, data: [] } }))
    vi.stubGlobal('fetch', fetchMock)

    await settle(new AlegraClient().listEstimates())

    // Este test afirmaba `date`, apoyado en que quien recorre páginas puede
    // cortar apenas ve una fecha fuera de rango. Ese razonamiento era correcto
    // pero incompleto: Alegra no desempata de forma estable entre documentos
    // del mismo día, así que paginar sobre un orden por fecha REPITE y PIERDE
    // filas en los bordes de página.
    //
    // Medido contra la cuenta real: abril-2026 devolvía 81 filas para 73
    // cotizaciones distintas, y dos corridas de la misma consulta daban 73 y
    // 63. Con orden por `id` —clave única— la paginación se vuelve
    // determinista y aparecen las 81 reales.
    //
    // El corte temprano se pierde y lo reemplaza el margen de páginas de
    // collectByDateRange (ver `orden: 'id'` ahí).
    expect(urlOf(fetchMock).searchParams.get('order_field')).toBe('id')
  })

  it('fuerza order_direction=DESC', async () => {
    const fetchMock = vi.fn().mockResolvedValue(buildResponse({ json: { metadata: { total: 0 }, data: [] } }))
    vi.stubGlobal('fetch', fetchMock)

    await settle(new AlegraClient().listEstimates())

    expect(urlOf(fetchMock).searchParams.get('order_direction')).toBe('DESC')
  })

  it('deja que el caller sobrescriba el orden si tiene una razón', async () => {
    const fetchMock = vi.fn().mockResolvedValue(buildResponse({ json: { metadata: { total: 0 }, data: [] } }))
    vi.stubGlobal('fetch', fetchMock)

    await settle(new AlegraClient().listEstimates({ order_field: 'id', order_direction: 'ASC' }))

    const params = urlOf(fetchMock).searchParams
    expect(params.get('order_field')).toBe('id')
    expect(params.get('order_direction')).toBe('ASC')
  })
})

// -----------------------------------------------------------------------------
// Bills & payments request shape
// -----------------------------------------------------------------------------

describe('AlegraClient — /bills y /payments', () => {
  function urlOf(fetchMock: ReturnType<typeof vi.fn>): URL {
    return new URL(fetchMock.mock.calls[0]![0] as string)
  }

  function emptyList() {
    return buildResponse({ json: { metadata: { total: 0 }, data: [] } })
  }

  it('/bills fuerza order_field=date y DESC', async () => {
    const fetchMock = vi.fn().mockResolvedValue(emptyList())
    vi.stubGlobal('fetch', fetchMock)

    await settle(new AlegraClient().listBills())

    const params = urlOf(fetchMock).searchParams
    expect(params.get('order_field')).toBe('date')
    expect(params.get('order_direction')).toBe('DESC')
  })

  it('/payments SIEMPRE pide los campos de asociación', async () => {
    const fetchMock = vi.fn().mockResolvedValue(emptyList())
    vi.stubGlobal('fetch', fetchMock)

    await settle(new AlegraClient().listPayments())

    // `bills` is the one the expense side depends on: without it every
    // outgoing payment classifies as 'unknown', the standalone-expense
    // figure collapses to zero, and the month looks cheaper than it was.
    const fields = urlOf(fetchMock).searchParams.get('fields')
    expect(fields).toContain('bills')
    expect(fields).toContain('categories')
    expect(fields).toContain('associations')
  })

  it('/payments pide los mismos campos en el detalle que en el listado', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      buildResponse({
        json: {
          id: '1',
          date: '2026-07-10',
          amount: 100,
          type: 'out',
          currency: { code: 'COP', symbol: '$' },
        },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await settle(new AlegraClient().getPayment('1'))

    // Same constant as the list call — a detail page that classifies a payment
    // differently from the row you clicked would be its own bug.
    const fields = urlOf(fetchMock).searchParams.get('fields')
    expect(fields).toContain('bills')
    expect(fields).toContain('categories')
  })

  it('/payments pasa el filtro type al servidor', async () => {
    const fetchMock = vi.fn().mockResolvedValue(emptyList())
    vi.stubGlobal('fetch', fetchMock)

    await settle(new AlegraClient().listPayments({ type: 'out' }))

    expect(urlOf(fetchMock).searchParams.get('type')).toBe('out')
  })

  it('rechaza ids vacíos sin pegarle a la API', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const client = new AlegraClient()
    await expect(client.getBill('')).rejects.toThrow(/bill id/)
    await expect(client.getPayment('')).rejects.toThrow(/payment id/)

    expect(fetchMock).not.toHaveBeenCalled()
  })
})

// -----------------------------------------------------------------------------
// Rate limit
// -----------------------------------------------------------------------------

describe('AlegraClient — rate limit', () => {
  it('reserva un slot de forma optimista antes de disparar el request', async () => {
    const fetchMock = vi.fn().mockImplementation(() => new Promise(() => {})) // never resolves
    vi.stubGlobal('fetch', fetchMock)

    const client = new AlegraClient()
    const before = client.getRateLimitState().remaining

    void client.listInvoices()
    await vi.advanceTimersByTimeAsync(0)

    // Without the optimistic decrement, concurrent callers all read the same
    // pre-flight budget and the gate never engages under real load.
    expect(client.getRateLimitState().remaining).toBe(before - 1)
  })

  it('corrige el estado con los headers reales de la respuesta', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      buildResponse({ json: emptyInvoices(), rateLimitRemaining: '42', rateLimitReset: '30' }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const client = new AlegraClient()
    await settle(client.listInvoices())

    expect(client.getRateLimitState().remaining).toBe(42)
    expect(client.getRateLimitState().resetAt).toBeGreaterThan(Date.now())
  })

  it('espera cuando el presupuesto está por debajo del umbral y luego lo repone', async () => {
    const fetchMock = vi
      .fn()
      // First response drives the budget down to 1 (below the threshold of 5).
      .mockResolvedValueOnce(
        buildResponse({ json: emptyInvoices(), rateLimitRemaining: '1', rateLimitReset: '2' }),
      )
      .mockResolvedValue(buildResponse({ json: emptyInvoices(), rateLimitRemaining: '150' }))
    vi.stubGlobal('fetch', fetchMock)

    const client = new AlegraClient()
    await settle(client.listInvoices({ start: 0 }))
    expect(client.getRateLimitState().remaining).toBe(1)

    // The next call must block on the reset window rather than fire blind.
    await settle(client.listInvoices({ start: 30 }))

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('rate limit bajo'))
  })
})

// -----------------------------------------------------------------------------
// Backoff
// -----------------------------------------------------------------------------

describe('backoffDelay', () => {
  it('nunca es negativo', () => {
    for (let attempt = 0; attempt < 6; attempt++) {
      expect(backoffDelay(attempt)).toBeGreaterThanOrEqual(0)
    }
  })

  it('respeta el techo exponencial por intento', () => {
    // Full jitter → random(0, base * 2^attempt). Pin Math.random to 1 to
    // assert the ceiling rather than a sampled value.
    vi.spyOn(Math, 'random').mockReturnValue(1)

    expect(backoffDelay(0)).toBe(500)
    expect(backoffDelay(1)).toBe(1_000)
    expect(backoffDelay(2)).toBe(2_000)
  })

  it('capea en 8s por más que suba el intento', () => {
    vi.spyOn(Math, 'random').mockReturnValue(1)
    expect(backoffDelay(20)).toBe(8_000)
  })

  it('aplica jitter — dos llamadas con el mismo intento no son idénticas', () => {
    const samples = new Set(Array.from({ length: 20 }, () => backoffDelay(3)))
    // Without jitter every retry fires in the same instant and reproduces
    // the overload it was meant to relieve.
    expect(samples.size).toBeGreaterThan(1)
  })
})
