import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AlegraClient, getAlegraClient } from '../client'
import { AlegraError, AuthError, RateLimitError, ValidationError } from '../errors'

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function buildResponse(overrides: {
  status?: number
  json?: unknown
  text?: string
  rateLimitRemaining?: string
  rateLimitReset?: string
  contentType?: string
}): Response {
  const status = overrides.status ?? 200
  const headers = new Headers()
  if (overrides.rateLimitRemaining !== undefined) {
    headers.set('X-Rate-Limit-Remaining', overrides.rateLimitRemaining)
  }
  if (overrides.rateLimitReset !== undefined) {
    headers.set('X-Rate-Limit-Reset', overrides.rateLimitReset)
  }
  headers.set('content-type', overrides.contentType ?? 'application/json')

  const body = overrides.json !== undefined
    ? JSON.stringify(overrides.json)
    : overrides.text ?? ''

  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: statusTextFor(status),
    headers,
    json: () => Promise.resolve(overrides.json),
    text: () => Promise.resolve(body),
  } as unknown as Response
}

function statusTextFor(status: number): string {
  if (status === 200) return 'OK'
  if (status === 401) return 'Unauthorized'
  if (status === 429) return 'Too Many Requests'
  return `Status ${status}`
}

function buildInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: '1',
    date: '2026-06-15',
    dueDate: '2026-07-15',
    datetime: '2026-06-15 16:04:00',
    status: 'open',
    client: { id: '20', name: 'ACME', identification: '900123456-7' },
    numberTemplate: { id: '1', prefix: 'FE-', number: 520 },
    total: 1190,
    totalPaid: 0,
    balance: 1190,
    currency: { code: 'COP', symbol: '$' },
    ...overrides,
  }
}

function buildEmptyInvoicesResponse() {
  return { metadata: { total: 0 }, data: [] }
}

function buildCompanyResponse() {
  return {
    name: 'Administración Segura',
    country: 'CO',
    applicationVersion: 'colombia',
    decimalPrecision: 0,
    currency: { code: 'COP', symbol: '$' },
  }
}

// -----------------------------------------------------------------------------
// Test setup
// -----------------------------------------------------------------------------

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  process.env.ALEGRA_EMAIL = 'integration@example.com'
  process.env.ALEGRA_TOKEN = 'test-token-abc123'
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

// -----------------------------------------------------------------------------
// Construction / env vars
// -----------------------------------------------------------------------------

describe('AlegraClient — construction', () => {
  it('lanza error si ALEGRA_EMAIL falta', () => {
    delete process.env.ALEGRA_EMAIL
    expect(() => new AlegraClient()).toThrow(/ALEGRA_EMAIL/)
  })

  it('lanza error si ALEGRA_TOKEN falta', () => {
    delete process.env.ALEGRA_TOKEN
    expect(() => new AlegraClient()).toThrow(/ALEGRA_TOKEN/)
  })

  it('construye OK con ambas env vars', () => {
    expect(() => new AlegraClient()).not.toThrow()
  })

  it('getAlegraClient() devuelve un singleton', () => {
    const a = getAlegraClient()
    const b = getAlegraClient()
    expect(a).toBe(b)
  })
})

// -----------------------------------------------------------------------------
// Auth header
// -----------------------------------------------------------------------------

describe('AlegraClient — auth header', () => {
  it('envía Authorization Basic con base64(email:token)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(buildResponse({ json: buildEmptyInvoicesResponse() }))
    vi.stubGlobal('fetch', fetchMock)

    const client = new AlegraClient()
    await client.listInvoices()

    const expectedAuth = `Basic ${Buffer.from('integration@example.com:test-token-abc123').toString('base64')}`
    const [, init] = fetchMock.mock.calls[0]!
    expect((init as RequestInit).headers).toEqual(
      expect.objectContaining({ Authorization: expectedAuth }),
    )
  })
})

// -----------------------------------------------------------------------------
// Request shape (URL, params, cache, signal)
// -----------------------------------------------------------------------------

describe('AlegraClient — request shape', () => {
  it('usa cache: "no-store" en cada fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(buildResponse({ json: buildEmptyInvoicesResponse() }))
    vi.stubGlobal('fetch', fetchMock)

    await new AlegraClient().listInvoices()

    const [, init] = fetchMock.mock.calls[0]!
    expect((init as RequestInit).cache).toBe('no-store')
  })

  it('envía un AbortSignal para timeout', async () => {
    const fetchMock = vi.fn().mockResolvedValue(buildResponse({ json: buildEmptyInvoicesResponse() }))
    vi.stubGlobal('fetch', fetchMock)

    await new AlegraClient().listInvoices()

    const [, init] = fetchMock.mock.calls[0]!
    expect((init as RequestInit).signal).toBeDefined()
  })

  it('construye la URL base con /api/v1', async () => {
    const fetchMock = vi.fn().mockResolvedValue(buildResponse({ json: buildEmptyInvoicesResponse() }))
    vi.stubGlobal('fetch', fetchMock)

    await new AlegraClient().listInvoices()

    const [url] = fetchMock.mock.calls[0]!
    expect(url as string).toMatch(/^https:\/\/api\.alegra\.com\/api\/v1\/invoices/)
  })

  it('filtra params undefined/null/empty', async () => {
    const fetchMock = vi.fn().mockResolvedValue(buildResponse({ json: buildEmptyInvoicesResponse() }))
    vi.stubGlobal('fetch', fetchMock)

    await new AlegraClient().listInvoices({
      start: undefined,
      limit: null,
      status: 'open',
      client_name: '',
      date_after: '2026-01-01',
    } as never)

    const [url] = fetchMock.mock.calls[0]!
    expect(url as string).toContain('status=open')
    expect(url as string).toContain('date_after=2026-01-01')
    expect(url as string).not.toContain('start=')
    expect(url as string).not.toContain('limit=')
    expect(url as string).not.toContain('client_name=')
  })

  it('default metadata=true (para tener total)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(buildResponse({ json: buildEmptyInvoicesResponse() }))
    vi.stubGlobal('fetch', fetchMock)

    await new AlegraClient().listInvoices()

    const [url] = fetchMock.mock.calls[0]!
    expect(url as string).toContain('metadata=true')
  })

  it('respeta metadata=false si se pasa explícitamente', async () => {
    const fetchMock = vi.fn().mockResolvedValue(buildResponse({ json: buildEmptyInvoicesResponse() }))
    vi.stubGlobal('fetch', fetchMock)

    await new AlegraClient().listInvoices({ metadata: false })

    const [url] = fetchMock.mock.calls[0]!
    expect(url as string).not.toContain('metadata=true')
  })

  it('URL-encodes el id en getInvoice', async () => {
    const fetchMock = vi.fn().mockResolvedValue(buildResponse({ json: buildInvoice() }))
    vi.stubGlobal('fetch', fetchMock)

    await new AlegraClient().getInvoice('75c1a5ad-4bd5-4675-b51b-8d6c70f1f2f9')

    const [url] = fetchMock.mock.calls[0]!
    expect(url as string).toContain('/invoices/75c1a5ad-4bd5-4675-b51b-8d6c70f1f2f9')
  })
})

// -----------------------------------------------------------------------------
// getInvoice guards
// -----------------------------------------------------------------------------

describe('AlegraClient — getInvoice', () => {
  it('lanza ValidationError si el id está vacío', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(new AlegraClient().getInvoice('')).rejects.toThrow(ValidationError)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

// -----------------------------------------------------------------------------
// Rate limit awareness
// -----------------------------------------------------------------------------

describe('AlegraClient — rate limit', () => {
  it('lee X-Rate-Limit-Remaining y X-Rate-Limit-Reset de la respuesta', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      buildResponse({
        json: buildEmptyInvoicesResponse(),
        rateLimitRemaining: '142',
        rateLimitReset: '37',
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const client = new AlegraClient()
    await client.listInvoices()

    const state = client.getRateLimitState()
    expect(state.remaining).toBe(142)
    expect(state.resetAt).toBeGreaterThan(Date.now())
    expect(state.resetAt).toBeLessThanOrEqual(Date.now() + 37_000 + 100)
  })

  it('NO espera en el primer request (state inicial remaining=150)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(buildResponse({ json: buildEmptyInvoicesResponse() }))
    vi.stubGlobal('fetch', fetchMock)

    const start = Date.now()
    await new AlegraClient().listInvoices()
    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(100)
  })

  it('SÍ espera cuando remaining cae a ≤5 después de un response', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        buildResponse({
          json: buildEmptyInvoicesResponse(),
          rateLimitRemaining: '3',
          rateLimitReset: '30',
        }),
      )
      .mockResolvedValueOnce(buildResponse({ json: buildEmptyInvoicesResponse() }))

    vi.stubGlobal('fetch', fetchMock)

    const client = new AlegraClient()
    await client.listInvoices() // primera: no espera, devuelve remaining=3
    expect(client.getRateLimitState().remaining).toBe(3)

    // Segunda: remaining=3 ≤ 5 → debe esperar ~30s
    const promise = client.listInvoices()
    await vi.advanceTimersByTimeAsync(30_000)
    await promise

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('NO espera si remaining > 5', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      buildResponse({
        json: buildEmptyInvoicesResponse(),
        rateLimitRemaining: '100',
        rateLimitReset: '30',
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const client = new AlegraClient()
    await client.listInvoices() // primera
    await client.listInvoices() // segunda: 100 > 5, no espera

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

// -----------------------------------------------------------------------------
// Error mapping
// -----------------------------------------------------------------------------

describe('AlegraClient — error mapping', () => {
  it('401 → AuthError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      buildResponse({ status: 401, json: { code: 401, error: 'creds inválidas' } }),
    ))

    await expect(new AlegraClient().listInvoices()).rejects.toThrow(AuthError)
    await expect(new AlegraClient().listInvoices()).rejects.toThrow(/creds inválidas/)
  })

  it('429 → RateLimitError con resetAt', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      buildResponse({
        status: 429,
        json: { code: 429, error: 'rate limit' },
        rateLimitRemaining: '0',
        rateLimitReset: '42',
      }),
    ))

    try {
      await new AlegraClient().listInvoices()
      expect.fail('debería haber tirado error')
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError)
      expect((err as RateLimitError).resetAt).toBeGreaterThan(Date.now())
    }
  })

  it('500 → AlegraError con código HTTP_500', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      buildResponse({ status: 500, json: { error: 'internal' } }),
    ))

    try {
      await new AlegraClient().listInvoices()
      expect.fail('debería haber tirado error')
    } catch (err) {
      expect(err).toBeInstanceOf(AlegraError)
      expect((err as AlegraError).code).toBe('HTTP_500')
    }
  })

  it('network error → AlegraError con código NETWORK_ERROR', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')))

    try {
      await new AlegraClient().listInvoices()
      expect.fail('debería haber tirado error')
    } catch (err) {
      expect(err).toBeInstanceOf(AlegraError)
      expect((err as AlegraError).code).toBe('NETWORK_ERROR')
    }
  })

  it('respuesta no-JSON → ValidationError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      buildResponse({ status: 200, text: '<html>error</html>', contentType: 'text/html' }),
    ))

    await expect(new AlegraClient().listInvoices()).rejects.toThrow(ValidationError)
  })

  it('JSON con shape inválido → ValidationError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      buildResponse({ json: { unexpected: 'shape', totally: 'wrong' } }),
    ))

    await expect(new AlegraClient().listInvoices()).rejects.toThrow(ValidationError)
  })
})

// -----------------------------------------------------------------------------
// listInvoices success path
// -----------------------------------------------------------------------------

describe('AlegraClient — listInvoices', () => {
  it('devuelve { data, total } cuando metadata=true', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      buildResponse({
        json: {
          metadata: { total: 2 },
          data: [buildInvoice({ id: '1' }), buildInvoice({ id: '2' })],
        },
      }),
    ))

    const result = await new AlegraClient().listInvoices()
    expect(result.total).toBe(2)
    expect(result.data).toHaveLength(2)
  })
})

// -----------------------------------------------------------------------------
// getCompany
// -----------------------------------------------------------------------------

describe('AlegraClient — getCompany', () => {
  it('llama a /company y devuelve la company parseada', async () => {
    const fetchMock = vi.fn().mockResolvedValue(buildResponse({ json: buildCompanyResponse() }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await new AlegraClient().getCompany()

    expect(fetchMock.mock.calls[0]![0] as string).toContain('/company')
    expect(result.country).toBe('CO')
    expect(result.currency.code).toBe('COP')
  })
})
