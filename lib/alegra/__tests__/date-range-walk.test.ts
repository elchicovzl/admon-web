/**
 * Tests for the generic paginated date-range walk.
 *
 * Exercised here with estimates, but the same helper backs /bills and
 * /payments — none of the three can filter a date RANGE server-side.
 *
 * The bug this replaced was a SILENT undercount: one 30-row page was summed
 * and presented as the month's total. So the assertions here care about two
 * things above all — that the walk reads every page the range needs, and
 * that when it can't, it says so instead of rounding down quietly.
 */

import { describe, expect, it, vi } from 'vitest'
import {
  collectByDateRange,
  ALEGRA_WALK_PAGE_SIZE,
  type DatePageFetcher,
  type PageFetcher,
} from '../date-range-walk'
import type { EstimateListItem, EstimateListResponse } from '../types'

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function buildEstimate(date: string | null, overrides: Partial<EstimateListItem> = {}) {
  return {
    id: `e-${date ?? 'nodate'}-${Math.random().toString(36).slice(2, 7)}`,
    number: 1,
    date,
    dueDate: null,
    client: { id: '20', name: 'ACME', identification: '900123456-7' },
    total: 100,
    currency: { code: 'COP', symbol: '$' },
    ...overrides,
  } as unknown as EstimateListItem
}

/**
 * Build a fetcher over a flat, pre-sorted (date DESC) list of estimates —
 * exactly what the API contract promises when `order_field: 'date'` and
 * `order_direction: 'DESC'` are sent.
 */
function fetcherOver(
  all: EstimateListItem[],
  total = all.length,
): PageFetcher<EstimateListItem> {
  return vi.fn(async (start: number, limit: number): Promise<EstimateListResponse> => ({
    data: all.slice(start, start + limit),
    total,
  }))
}

/** Generate `count` estimates all sharing the same date. */
function repeat(date: string, count: number): EstimateListItem[] {
  return Array.from({ length: count }, () => buildEstimate(date))
}

// -----------------------------------------------------------------------------
// Happy paths
// -----------------------------------------------------------------------------

describe('collectByDateRange — cobertura del rango', () => {
  it('junta todo cuando el mes entra en una sola página', async () => {
    const all = repeat('2026-07-10', 5)
    const result = await collectByDateRange(fetcherOver(all), {
      dateFrom: '2026-07-01',
      dateTo: null,
    })

    expect(result.items).toHaveLength(5)
    expect(result.truncated).toBe(false)
    expect(result.pagesFetched).toBe(1)
  })

  it('pagina hasta cubrir un mes con MÁS de 30 cotizaciones — el bug original', async () => {
    // 45 in-month estimates: the old single-page code summed 30 and reported
    // that as the month's total.
    const all = [...repeat('2026-07-15', 45), ...repeat('2026-06-20', 10)]

    const fetchPage = fetcherOver(all)
    const result = await collectByDateRange(fetchPage, {
      dateFrom: '2026-07-01',
      dateTo: null,
    })

    expect(result.items).toHaveLength(45)
    expect(result.truncated).toBe(false)
    // page 1 (30 in-month) → page 2 (15 in-month, then hits June and stops)
    expect(fetchPage).toHaveBeenCalledTimes(2)
  })

  it('corta en el primer documento anterior al rango y NO sigue paginando', async () => {
    const all = [...repeat('2026-07-15', 5), ...repeat('2026-06-01', 100)]

    const fetchPage = fetcherOver(all)
    const result = await collectByDateRange(fetchPage, {
      dateFrom: '2026-07-01',
      dateTo: null,
    })

    expect(result.items).toHaveLength(5)
    // Sorted DESC, so the first out-of-range item proves the rest are too.
    expect(fetchPage).toHaveBeenCalledTimes(1)
    expect(result.truncated).toBe(false)
  })

  it('trata una página corta como la última', async () => {
    const all = repeat('2026-07-10', 12)
    const fetchPage = fetcherOver(all)

    const result = await collectByDateRange(fetchPage, {
      dateFrom: '2026-07-01',
      dateTo: null,
    })

    expect(result.items).toHaveLength(12)
    expect(fetchPage).toHaveBeenCalledTimes(1)
    expect(result.truncated).toBe(false)
  })

  it('maneja una cuenta sin cotizaciones', async () => {
    const result = await collectByDateRange(fetcherOver([], 0), {
      dateFrom: '2026-07-01',
      dateTo: null,
    })

    expect(result.items).toEqual([])
    expect(result.truncated).toBe(false)
    expect(result.total).toBe(0)
  })

  it('junta todo cuando no hay rango', async () => {
    const all = repeat('2026-07-10', 40)
    const result = await collectByDateRange(fetcherOver(all), {
      dateFrom: null,
      dateTo: null,
    })

    expect(result.items).toHaveLength(40)
    expect(result.truncated).toBe(false)
  })

  it('toma el total exacto del metadata de la primera página', async () => {
    const all = repeat('2026-07-10', 5)
    // metadata.total is account-wide and independent of the range walked.
    const result = await collectByDateRange(fetcherOver(all, 873), {
      dateFrom: '2026-07-01',
      dateTo: null,
    })

    expect(result.total).toBe(873)
  })
})

// -----------------------------------------------------------------------------
// Boundaries
// -----------------------------------------------------------------------------

describe('collectByDateRange — bordes del rango', () => {
  it('incluye documentos exactamente en dateFrom (borde inclusivo)', async () => {
    const all = [buildEstimate('2026-07-01'), buildEstimate('2026-06-30')]
    const result = await collectByDateRange(fetcherOver(all), {
      dateFrom: '2026-07-01',
      dateTo: null,
    })

    expect(result.items).toHaveLength(1)
    expect(result.items[0]!.date).toBe('2026-07-01')
  })

  it('incluye documentos exactamente en dateTo (borde inclusivo)', async () => {
    const all = [buildEstimate('2026-07-31'), buildEstimate('2026-07-15')]
    const result = await collectByDateRange(fetcherOver(all), {
      dateFrom: '2026-07-01',
      dateTo: '2026-07-31',
    })

    expect(result.items).toHaveLength(2)
  })

  it('saltea los más nuevos que dateTo SIN cortar el recorrido', async () => {
    // These sit at the head of a DESC list. Stopping on them would drop the
    // entire range that follows.
    const all = [
      buildEstimate('2026-08-05'),
      buildEstimate('2026-08-01'),
      buildEstimate('2026-07-20'),
      buildEstimate('2026-07-10'),
      buildEstimate('2026-06-01'),
    ]

    const result = await collectByDateRange(fetcherOver(all), {
      dateFrom: '2026-07-01',
      dateTo: '2026-07-31',
    })

    expect(result.items.map((e) => e.date)).toEqual(['2026-07-20', '2026-07-10'])
  })

  it('saltea documentos sin fecha sin cortar el recorrido', async () => {
    // A null date says nothing about ordering — treating it as a boundary
    // would truncate the walk on a data quirk.
    const all = [
      buildEstimate('2026-07-20'),
      buildEstimate(null),
      buildEstimate('2026-07-10'),
      buildEstimate('2026-06-01'),
    ]

    const result = await collectByDateRange(fetcherOver(all), {
      dateFrom: '2026-07-01',
      dateTo: null,
    })

    expect(result.items.map((e) => e.date)).toEqual(['2026-07-20', '2026-07-10'])
  })
})

// -----------------------------------------------------------------------------
// Truncation — must never be silent
// -----------------------------------------------------------------------------

describe('collectByDateRange — truncado', () => {
  it('marca truncated cuando se alcanza el tope de páginas', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // Every page is full and in-range, so the walk can never prove it's done.
    const all = repeat('2026-07-15', ALEGRA_WALK_PAGE_SIZE * 12)
    const fetchPage = fetcherOver(all)

    const result = await collectByDateRange(fetchPage, {
      dateFrom: '2026-07-01',
      dateTo: null,
      maxPages: 3,
    })

    expect(result.truncated).toBe(true)
    expect(result.pagesFetched).toBe(3)
    expect(result.items).toHaveLength(ALEGRA_WALK_PAGE_SIZE * 3)

    warnSpy.mockRestore()
  })

  it('avisa por consola al truncar — no debe pasar en silencio', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await collectByDateRange(fetcherOver(repeat('2026-07-15', 200)), {
      dateFrom: '2026-07-01',
      dateTo: null,
      maxPages: 2,
    })

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('truncado'))

    warnSpy.mockRestore()
  })

  it('NO marca truncated cuando el rango se cubrió justo en el tope', async () => {
    // Exactly 2 full pages then out-of-range: covered, not truncated.
    const all = [
      ...repeat('2026-07-15', ALEGRA_WALK_PAGE_SIZE * 2),
      ...repeat('2026-06-01', 5),
    ]

    const result = await collectByDateRange(fetcherOver(all), {
      dateFrom: '2026-07-01',
      dateTo: null,
      maxPages: 3,
    })

    expect(result.truncated).toBe(false)
    expect(result.items).toHaveLength(ALEGRA_WALK_PAGE_SIZE * 2)
  })

  it('respeta pageSize custom al paginar', async () => {
    const all = repeat('2026-07-15', 25)
    const fetchPage = fetcherOver(all)

    await collectByDateRange(fetchPage, {
      dateFrom: '2026-07-01',
      dateTo: null,
      pageSize: 10,
    })

    expect(fetchPage).toHaveBeenNthCalledWith(1, 0, 10)
    expect(fetchPage).toHaveBeenNthCalledWith(2, 10, 10)
    expect(fetchPage).toHaveBeenNthCalledWith(3, 20, 10)
  })
})

describe('collectByDateRange — paginación inestable de Alegra', () => {
  /**
   * Alegra ordena por `date` y el desempate entre documentos del mismo día
   * cambia de una petición a otra. Con varios compartiendo fecha en el borde
   * de una página, la misma fila vuelve en la siguiente.
   *
   * Observado en la cuenta real: abril-2026 devolvía 81 filas para 73
   * cotizaciones. No era solo una clave repetida en React — inflaba el total
   * en la misma proporción.
   */
  it('descarta los documentos que la paginación repite', async () => {
    const pagina1 = [
      { id: 1, date: '2026-04-20' },
      { id: 2, date: '2026-04-15' },
      { id: 3, date: '2026-04-15' },
    ]
    // El solapamiento: 2 y 3 vuelven a aparecer.
    const pagina2 = [
      { id: 2, date: '2026-04-15' },
      { id: 3, date: '2026-04-15' },
      { id: 4, date: '2026-04-10' },
    ]

    const fetchPage = vi.fn(async (start: number) =>
      start === 0
        ? { data: pagina1, total: 4 }
        : start === 3
          ? { data: pagina2, total: 4 }
          : { data: [], total: 4 },
    )

    const result = await collectByDateRange(fetchPage, {
      dateFrom: '2026-04-01',
      dateTo: '2026-04-30',
      pageSize: 3,
    })

    expect(result.items.map((i) => i.id)).toEqual([1, 2, 3, 4])
  })

  it('no descarta documentos sin id', async () => {
    // Sin identidad no hay forma de saber si son el mismo; se prefiere
    // repetir antes que perder un documento.
    const fetchPage = vi.fn(async (start: number) =>
      start === 0
        ? { data: [{ date: '2026-04-20' }, { date: '2026-04-20' }], total: 2 }
        : { data: [], total: 2 },
    )

    const result = await collectByDateRange(fetchPage, {
      dateFrom: '2026-04-01',
      dateTo: '2026-04-30',
      pageSize: 2,
    })

    expect(result.items).toHaveLength(2)
  })

  it('un id repetido no cuenta como fin del rango', async () => {
    // El descarte tiene que ser silencioso: si cortara el walk, se perderían
    // los documentos que vienen después del solapamiento.
    const fetchPage = vi.fn(async (start: number) =>
      start === 0
        ? { data: [{ id: 1, date: '2026-04-20' }, { id: 2, date: '2026-04-19' }], total: 5 }
        : start === 2
          ? { data: [{ id: 2, date: '2026-04-19' }, { id: 3, date: '2026-04-18' }], total: 5 }
          : { data: [{ id: 4, date: '2026-04-17' }], total: 5 },
    )

    const result = await collectByDateRange(fetchPage, {
      dateFrom: '2026-04-01',
      dateTo: '2026-04-30',
      pageSize: 2,
    })

    expect(result.items.map((i) => i.id)).toEqual([1, 2, 3, 4])
    expect(result.truncated).toBe(false)
  })
})

// -----------------------------------------------------------------------------
// Total guard — Alegra answers HTTP 500 past the end
// -----------------------------------------------------------------------------

describe('collectByDateRange — guarda de total', () => {
  it('nunca pide una página con start >= total', async () => {
    // 60 rows, pageSize 30: two full pages, and the third request would be
    // start=60 — which Alegra answers with a 500.
    const all = repeat('2026-07-15', 60)
    const fetchPage = fetcherOver(all, 60)

    const result = await collectByDateRange(fetchPage, {
      dateFrom: '2026-07-01',
      dateTo: null,
      pageSize: 30,
    })

    expect(fetchPage).toHaveBeenCalledTimes(2)
    expect(fetchPage).not.toHaveBeenCalledWith(60, expect.anything())
    expect(result.items).toHaveLength(60)
    expect(result.truncated).toBe(false)
  })

  it('llegar al total cuenta como rango cubierto aunque sea el tope de páginas', async () => {
    const all = repeat('2026-07-15', 60)
    const result = await collectByDateRange(fetcherOver(all, 60), {
      dateFrom: '2026-07-01',
      dateTo: null,
      pageSize: 30,
      maxPages: 2,
    })

    expect(result.truncated).toBe(false)
  })
})

// -----------------------------------------------------------------------------
// Same-date group across a page boundary (unstable tie-break)
// -----------------------------------------------------------------------------

describe('collectByDateRange — fecha repartida entre páginas', () => {
  const D = '2026-04-20'
  const OLDER = '2026-04-10'

  // Page 0 ends with the D group a,b,c. The second request tie-breaks
  // differently: page 1 starts with c again (repeated) and d. The unstable
  // list never returns e, which is also dated D.
  const page0 = [
    { id: 'a', date: D },
    { id: 'b', date: D },
    { id: 'c', date: D },
  ]
  const page1 = [
    { id: 'c', date: D },
    { id: 'd', date: D },
    { id: 'f', date: OLDER },
  ]
  const page2 = [{ id: 'g', date: '2026-04-05' }]
  const pages = [page0, page1, page2]
  const unstableFetcher: PageFetcher<{ id: string; date: string }> = async (start, limit) => ({
    data: pages[start / limit] ?? [],
    total: 7,
  })

  const exactSet = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, date: D }))
  const exactFetcher = () =>
    vi.fn<DatePageFetcher<{ id: string; date: string }>>(async (date, start, limit) => ({
      data: date === D ? exactSet.slice(start, start + limit) : [],
      total: date === D ? exactSet.length : 0,
    }))

  it('sin hook: deduplica pero pierde lo que el desempate dejó afuera', async () => {
    const result = await collectByDateRange(unstableFetcher, {
      dateFrom: '2026-04-01',
      dateTo: '2026-04-30',
      pageSize: 3,
    })

    // c is deduplicated, but e is lost: the known limit of the fallback.
    expect(result.items.map((i) => i.id)).toEqual(['a', 'b', 'c', 'd', 'f', 'g'])
  })

  it('con hook: reemplaza la fecha por el conjunto exacto, sin repetidos', async () => {
    const fetchDatePage = exactFetcher()

    const result = await collectByDateRange(unstableFetcher, {
      dateFrom: '2026-04-01',
      dateTo: '2026-04-30',
      pageSize: 3,
      fetchDatePage,
    })

    expect(result.items.map((i) => i.id)).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g'])
    expect(result.truncated).toBe(false)
    // Only D is refetched; its 5 rows take two pages of 3.
    expect(fetchDatePage).toHaveBeenCalledTimes(2)
    for (const call of fetchDatePage.mock.calls) expect(call[0]).toBe(D)
    // 3 main pages + 2 exact-date pages.
    expect(result.pagesFetched).toBe(5)
  })

  it('ignora filas posteriores de una fecha ya resuelta', async () => {
    // D spans three pages; after the first refetch the exact set is final.
    const long = [
      [{ id: 'a', date: D }, { id: 'b', date: D }],
      [{ id: 'b', date: D }, { id: 'c', date: D }],
      [{ id: 'c', date: D }, { id: 'z', date: D }],
      [{ id: 'f', date: OLDER }],
    ]
    const fetchPage: PageFetcher<{ id: string; date: string }> = async (start, limit) => ({
      data: long[start / limit] ?? [],
      total: 7,
    })
    const fetchDatePage = vi.fn<DatePageFetcher<{ id: string; date: string }>>(async (_d, start, limit) => ({
      data: ['a', 'b', 'c', 'd'].map((id) => ({ id, date: D })).slice(start, start + limit),
      total: 4,
    }))

    const result = await collectByDateRange(fetchPage, {
      dateFrom: '2026-04-01',
      dateTo: null,
      pageSize: 2,
      fetchDatePage,
    })

    // 'z' came from an unstable page after D was settled: the exact set wins.
    expect(result.items.map((i) => i.id)).toEqual(['a', 'b', 'c', 'd', 'f'])
    expect(fetchDatePage).toHaveBeenCalledTimes(2)
  })

  it('no dispara el hook cuando cada fecha cabe dentro de una página', async () => {
    const all = [
      { id: 'a', date: '2026-04-22' },
      { id: 'b', date: '2026-04-21' },
      { id: 'c', date: '2026-04-21' },
      { id: 'd', date: '2026-04-20' },
      { id: 'e', date: '2026-04-19' },
    ]
    const fetchPage: PageFetcher<(typeof all)[number]> = async (start, limit) => ({
      data: all.slice(start, start + limit),
      total: all.length,
    })
    const fetchDatePage = vi.fn<DatePageFetcher<(typeof all)[number]>>(async () => ({ data: [], total: 0 }))

    const result = await collectByDateRange(fetchPage, {
      dateFrom: '2026-04-01',
      dateTo: null,
      pageSize: 3,
      fetchDatePage,
    })

    expect(result.items).toHaveLength(5)
    expect(fetchDatePage).not.toHaveBeenCalled()
  })

  it('no refetchea una fecha fuera del rango', async () => {
    // The straddling date is newer than dateTo, so it is not part of the answer.
    const out = '2026-05-10'
    const fetchPage: PageFetcher<{ id: string; date: string }> = async (start, limit) => ({
      data: [
        [{ id: 'a', date: out }, { id: 'b', date: out }],
        [{ id: 'b', date: out }, { id: 'c', date: D }],
      ][start / limit] ?? [],
      total: 4,
    })
    const fetchDatePage = vi.fn<DatePageFetcher<{ id: string; date: string }>>(async () => ({ data: [], total: 0 }))

    const result = await collectByDateRange(fetchPage, {
      dateFrom: '2026-04-01',
      dateTo: '2026-04-30',
      pageSize: 2,
      fetchDatePage,
    })

    expect(result.items.map((i) => i.id)).toEqual(['c'])
    expect(fetchDatePage).not.toHaveBeenCalled()
  })

  it('marca truncated si el refetch de la fecha alcanza el tope de páginas', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fetchDatePage = vi.fn<DatePageFetcher<{ id: string; date: string }>>(async (_d, start, limit) => ({
      data: Array.from({ length: limit }, (_, i) => ({ id: `x${start + i}`, date: D })),
      total: 999,
    }))

    const result = await collectByDateRange(unstableFetcher, {
      dateFrom: '2026-04-01',
      dateTo: '2026-04-30',
      pageSize: 3,
      maxPages: 2,
      fetchDatePage,
    })

    expect(result.truncated).toBe(true)
    // The partial exact set never drops rows already held.
    expect(result.items.map((i) => i.id)).toEqual(expect.arrayContaining(['a', 'c', 'd']))
    warnSpy.mockRestore()
  })
})
