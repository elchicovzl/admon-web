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
