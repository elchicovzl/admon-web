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
        ? { data: [{ id: 1, date: '2026-04-20' }, { id: 2, date: '2026-04-19' }], total: 4 }
        : start === 2
          ? { data: [{ id: 2, date: '2026-04-19' }, { id: 3, date: '2026-04-18' }], total: 4 }
          : { data: [{ id: 4, date: '2026-04-17' }], total: 4 },
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

describe('collectByDateRange — orden por id (paginación estable)', () => {
  /**
   * Con orden por id NO se puede cortar al ver una fecha vieja: el id ordena
   * por creación, no por la fecha del documento. Un documento del rango puede
   * aparecer después de otros más viejos.
   */
  it('NO corta al ver un documento más viejo que el rango', async () => {
    const fetchPage = vi.fn(async (start: number) =>
      start === 0
        ? { data: [{ id: 9, date: '2026-04-20' }, { id: 8, date: '2026-01-05' }], total: 4 }
        : start === 2
          ? { data: [{ id: 7, date: '2026-04-02' }, { id: 6, date: '2026-04-01' }], total: 4 }
          : { data: [], total: 4 },
    )

    const result = await collectByDateRange(fetchPage, {
      dateFrom: '2026-04-01',
      dateTo: '2026-04-30',
      pageSize: 2,
      orden: 'id',
    })

    // Con orden por fecha, el id 8 habría cortado el recorrido y se habrían
    // perdido el 7 y el 6.
    expect(result.items.map((i) => i.id)).toEqual([9, 7, 6])
  })

  it('CON orden por fecha sí corta, que es el comportamiento viejo', async () => {
    const fetchPage = vi.fn(async (start: number) =>
      start === 0
        ? { data: [{ id: 9, date: '2026-04-20' }, { id: 8, date: '2026-01-05' }], total: 4 }
        : { data: [{ id: 7, date: '2026-04-02' }], total: 4 },
    )

    const result = await collectByDateRange(fetchPage, {
      dateFrom: '2026-04-01',
      dateTo: '2026-04-30',
      pageSize: 2,
      orden: 'fecha',
    })

    expect(result.items.map((i) => i.id)).toEqual([9])
  })

  it('se detiene tras el margen de páginas sin nada del rango', async () => {
    // Sin este freno, con orden por id habría que leer la cuenta entera.
    const vacia = { data: [{ id: 1, date: '2020-01-01' }, { id: 2, date: '2020-01-02' }], total: 99 }
    const fetchPage = vi.fn(async (start: number) =>
      start === 0
        ? { data: [{ id: 9, date: '2026-04-20' }, { id: 8, date: '2026-04-19' }], total: 99 }
        : vacia,
    )

    const result = await collectByDateRange(fetchPage, {
      dateFrom: '2026-04-01',
      dateTo: '2026-04-30',
      pageSize: 2,
      orden: 'id',
      margenPaginas: 2,
    })

    expect(result.items.map((i) => i.id)).toEqual([9, 8])
    // 1 con datos + 2 de margen
    expect(fetchPage).toHaveBeenCalledTimes(3)
    expect(result.truncated).toBe(false)
  })

  it('el margen se reinicia si vuelve a aparecer algo del rango', async () => {
    // Un hueco de una página no puede dar por terminado el recorrido.
    const fetchPage = vi.fn(async (start: number) =>
      start === 0
        ? { data: [{ id: 9, date: '2026-04-20' }], total: 99 }
        : start === 1
          ? { data: [{ id: 8, date: '2020-01-01' }], total: 99 }
          : start === 2
            ? { data: [{ id: 7, date: '2026-04-05' }], total: 99 }
            : { data: [], total: 99 },
    )

    const result = await collectByDateRange(fetchPage, {
      dateFrom: '2026-04-01',
      dateTo: '2026-04-30',
      pageSize: 1,
      orden: 'id',
      margenPaginas: 2,
    })

    expect(result.items.map((i) => i.id)).toEqual([9, 7])
  })
})

describe('collectByDateRange — el margen no puede cortar antes de llegar', () => {
  /**
   * Regresión concreta: con orden por id se arranca por lo más nuevo, así que
   * un rango viejo tiene por delante páginas que no le pertenecen. Con el
   * margen contando desde el principio, abril-2026 devolvía CERO mientras
   * agosto devolvía bien.
   */
  it('sigue leyendo aunque las primeras páginas no traigan nada del rango', async () => {
    const paginas = [
      [{ id: 20, date: '2026-08-10' }], // fuera del rango
      [{ id: 19, date: '2026-07-10' }], // fuera
      [{ id: 18, date: '2026-06-10' }], // fuera
      [{ id: 17, date: '2026-04-20' }], // ¡adentro!
      [{ id: 16, date: '2026-04-05' }], // adentro
      [{ id: 15, date: '2026-03-10' }], // fuera
      [{ id: 14, date: '2026-03-09' }], // fuera → acá sí corta
      [{ id: 13, date: '2026-03-08' }],
    ]
    const fetchPage = vi.fn(async (start: number) => ({
      data: paginas[start] ?? [],
      total: 99,
    }))

    const result = await collectByDateRange(fetchPage, {
      dateFrom: '2026-04-01',
      dateTo: '2026-04-30',
      pageSize: 1,
      orden: 'id',
      margenPaginas: 2,
    })

    expect(result.items.map((i) => i.id)).toEqual([17, 16])
    // 3 de arranque + 2 con datos + 2 de margen = 7. La página 8 no se pide.
    expect(fetchPage).toHaveBeenCalledTimes(7)
  })

  it('si el rango no aparece nunca, recorre hasta el tope y avisa', async () => {
    const fetchPage = vi.fn(async () => ({
      data: [{ id: 1, date: '2020-01-01' }],
      total: 999,
    }))

    const result = await collectByDateRange(fetchPage, {
      dateFrom: '2026-04-01',
      dateTo: '2026-04-30',
      pageSize: 1,
      orden: 'id',
      maxPages: 4,
    })

    expect(result.items).toHaveLength(0)
    // Cero resultados sin aviso sería indistinguible de "no hay nada".
    expect(result.truncated).toBe(true)
    expect(fetchPage).toHaveBeenCalledTimes(4)
  })
})
