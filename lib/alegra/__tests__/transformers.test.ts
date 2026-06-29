import { describe, expect, it } from 'vitest'
import type { InvoiceListItem } from '../types'
import {
  ALEGRA_PAGE_SIZE,
  buildInvoicesSearchString,
  buildPaginationLinks,
  computeAgingBucket,
  countByStatus,
  daysOverdue,
  formatCurrency,
  formatInvoiceNumber,
  getCurrencyFormatter,
  getInvoiceStatusBadgeClass,
  getInvoiceStatusLabel,
  parseAlegraDate,
  parseAlegraDateTime,
  parseInvoiceFilters,
  sumInvoices,
  totalPages,
} from '../transformers'

// -----------------------------------------------------------------------------
// Fixtures
// -----------------------------------------------------------------------------

function buildInvoice(overrides: Partial<InvoiceListItem> = {}): InvoiceListItem {
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

const TODAY = new Date(2026, 5, 28) // 2026-06-28 (local time, noon-ish to avoid TZ edge)

// -----------------------------------------------------------------------------
// Currency
// -----------------------------------------------------------------------------

describe('formatCurrency / getCurrencyFormatter', () => {
  it('formatea COP con locale es-CO (separador de miles con punto)', () => {
    expect(formatCurrency(1_234_567, 'COP')).toMatch(/1\.234\.567/)
  })

  it('formatea USD', () => {
    const result = formatCurrency(1234.5, 'USD')
    expect(result).toContain('1.234')
  })

  it('getCurrencyFormatter cachea por currency code', () => {
    const a = getCurrencyFormatter('COP')
    const b = getCurrencyFormatter('COP')
    expect(a).toBe(b)

    const c = getCurrencyFormatter('USD')
    expect(c).not.toBe(a)
  })

  it('maneja amount 0', () => {
    expect(formatCurrency(0, 'COP')).toBeTruthy()
  })

  it('NO crashea con currency code vacío — fallback a decimal format', () => {
    // Empty string would throw RangeError without the try/catch in
    // getCurrencyFormatter. Make sure it falls back gracefully.
    expect(() => formatCurrency(1000, '')).not.toThrow()
    expect(formatCurrency(1000, '')).toMatch(/1\.000/)
  })

  it('NO crashea con currency code inválido — fallback a decimal format', () => {
    expect(() => formatCurrency(1000, 'NOPE')).not.toThrow()
    expect(formatCurrency(1000, 'NOPE')).toMatch(/1\.000/)
  })
})

// -----------------------------------------------------------------------------
// Date parsing
// -----------------------------------------------------------------------------

describe('parseAlegraDateTime', () => {
  it('parsea formato YYYY-MM-DD HH:MM:SS', () => {
    const d = parseAlegraDateTime('2026-06-15 16:04:00')
    expect(d).not.toBeNull()
    expect(d!.getFullYear()).toBe(2026)
    expect(d!.getMonth()).toBe(5) // June (0-indexed)
    expect(d!.getDate()).toBe(15)
    expect(d!.getHours()).toBe(16)
    expect(d!.getMinutes()).toBe(4)
    expect(d!.getSeconds()).toBe(0)
  })

  it('parsea formato DD-MM-YYYY HH:MM:SS (DIAN events)', () => {
    const d = parseAlegraDateTime('15-06-2026 16:04:00')
    expect(d).not.toBeNull()
    expect(d!.getFullYear()).toBe(2026)
    expect(d!.getMonth()).toBe(5)
    expect(d!.getDate()).toBe(15)
  })

  it('parsea formato YYYY-MM-DD sin time', () => {
    const d = parseAlegraDateTime('2026-06-15')
    expect(d).not.toBeNull()
    expect(d!.getDate()).toBe(15)
    expect(d!.getHours()).toBe(0)
  })

  it('devuelve null para input inválido', () => {
    expect(parseAlegraDateTime('not a date')).toBeNull()
    expect(parseAlegraDateTime('')).toBeNull()
    expect(parseAlegraDateTime(null)).toBeNull()
    expect(parseAlegraDateTime(undefined)).toBeNull()
  })
})

describe('parseAlegraDate', () => {
  it('parsea YYYY-MM-DD', () => {
    const d = parseAlegraDate('2026-06-15')
    expect(d).not.toBeNull()
    expect(d!.getFullYear()).toBe(2026)
    expect(d!.getMonth()).toBe(5)
    expect(d!.getDate()).toBe(15)
  })

  it('rechaza otros formatos', () => {
    expect(parseAlegraDate('15-06-2026')).toBeNull()
    expect(parseAlegraDate('2026-06-15 16:04:00')).toBeNull()
  })

  it('devuelve null para input vacío/null', () => {
    expect(parseAlegraDate(null)).toBeNull()
    expect(parseAlegraDate(undefined)).toBeNull()
    expect(parseAlegraDate('')).toBeNull()
  })
})

// -----------------------------------------------------------------------------
// daysOverdue
// -----------------------------------------------------------------------------

describe('daysOverdue', () => {
  it('devuelve positivo si dueDate ya pasó', () => {
    const inv = buildInvoice({ dueDate: '2026-06-01', status: 'open' })
    // TODAY = 2026-06-28 → 27 días vencida
    expect(daysOverdue(inv, TODAY)).toBe(27)
  })

  it('devuelve negativo si dueDate es futuro', () => {
    const inv = buildInvoice({ dueDate: '2026-07-15', status: 'open' })
    expect(daysOverdue(inv, TODAY)).toBeLessThan(0)
  })

  it('devuelve 0 si dueDate es hoy', () => {
    const inv = buildInvoice({ dueDate: '2026-06-28', status: 'open' })
    expect(daysOverdue(inv, TODAY)).toBe(0)
  })

  it('devuelve null si dueDate es null (crédito abierto)', () => {
    const inv = buildInvoice({ dueDate: null, status: 'open' })
    expect(daysOverdue(inv, TODAY)).toBeNull()
  })

  it('devuelve 0 si status=closed (ya pagada)', () => {
    const inv = buildInvoice({ dueDate: '2026-06-01', status: 'closed' })
    expect(daysOverdue(inv, TODAY)).toBe(0)
  })

  it('devuelve 0 si status=void (anulada)', () => {
    const inv = buildInvoice({ dueDate: '2026-06-01', status: 'void' })
    expect(daysOverdue(inv, TODAY)).toBe(0)
  })
})

// -----------------------------------------------------------------------------
// computeAgingBucket
// -----------------------------------------------------------------------------

describe('computeAgingBucket', () => {
  it('current cuando dueDate es futuro', () => {
    expect(computeAgingBucket(buildInvoice({ dueDate: '2026-07-15', status: 'open' }), TODAY)).toBe('current')
  })

  it('current cuando dueDate es null', () => {
    expect(computeAgingBucket(buildInvoice({ dueDate: null, status: 'open' }), TODAY)).toBe('current')
  })

  it('current cuando status=closed', () => {
    expect(computeAgingBucket(buildInvoice({ dueDate: '2026-06-01', status: 'closed' }), TODAY)).toBe('current')
  })

  it('days_1_30 cuando 1-30 días vencido', () => {
    // TODAY=28 jun, dueDate=01 jun → 27 días
    expect(computeAgingBucket(buildInvoice({ dueDate: '2026-06-01', status: 'open' }), TODAY)).toBe('days_1_30')
  })

  it('days_31_60 cuando 31-60 días vencido', () => {
    // TODAY=28 jun, dueDate=15 may → 44 días
    expect(computeAgingBucket(buildInvoice({ dueDate: '2026-05-15', status: 'open' }), TODAY)).toBe('days_31_60')
  })

  it('days_61_90 cuando 61-90 días vencido', () => {
    // TODAY=28 jun, dueDate=15 abr → 74 días
    expect(computeAgingBucket(buildInvoice({ dueDate: '2026-04-15', status: 'open' }), TODAY)).toBe('days_61_90')
  })

  it('days_90_plus cuando >90 días vencido', () => {
    // TODAY=28 jun, dueDate=01 mar → 119 días
    expect(computeAgingBucket(buildInvoice({ dueDate: '2026-03-01', status: 'open' }), TODAY)).toBe('days_90_plus')
  })

  it('boundary: exactamente 30 días → days_1_30', () => {
    // TODAY=28 jun, dueDate=29 may → 30 días
    expect(computeAgingBucket(buildInvoice({ dueDate: '2026-05-29', status: 'open' }), TODAY)).toBe('days_1_30')
  })

  it('boundary: exactamente 31 días → days_31_60', () => {
    // TODAY=28 jun, dueDate=28 may → 31 días
    expect(computeAgingBucket(buildInvoice({ dueDate: '2026-05-28', status: 'open' }), TODAY)).toBe('days_31_60')
  })
})

// -----------------------------------------------------------------------------
// sumInvoices / countByStatus
// -----------------------------------------------------------------------------

describe('sumInvoices', () => {
  it('suma el campo indicado a través de varias facturas', () => {
    const invs = [
      buildInvoice({ total: 100, totalPaid: 50, balance: 50 }),
      buildInvoice({ total: 200, totalPaid: 200, balance: 0 }),
      buildInvoice({ total: 300, totalPaid: 100, balance: 200 }),
    ]
    expect(sumInvoices(invs, 'total')).toBe(600)
    expect(sumInvoices(invs, 'totalPaid')).toBe(350)
    expect(sumInvoices(invs, 'balance')).toBe(250)
  })

  it('devuelve 0 para lista vacía', () => {
    expect(sumInvoices([], 'total')).toBe(0)
  })
})

describe('countByStatus', () => {
  it('cuenta facturas que están en los statuses dados', () => {
    const invs = [
      buildInvoice({ status: 'open' }),
      buildInvoice({ status: 'open' }),
      buildInvoice({ status: 'closed' }),
      buildInvoice({ status: 'draft' }),
    ]
    expect(countByStatus(invs, ['open'])).toBe(2)
    expect(countByStatus(invs, ['open', 'closed'])).toBe(3)
    expect(countByStatus(invs, ['void'])).toBe(0)
  })

  it('devuelve 0 para lista vacía', () => {
    expect(countByStatus([], ['open'])).toBe(0)
  })
})

// -----------------------------------------------------------------------------
// Display helpers
// -----------------------------------------------------------------------------

describe('formatInvoiceNumber', () => {
  it('concatena prefix + number', () => {
    expect(formatInvoiceNumber({ id: '1', prefix: 'FE-', number: 520 })).toBe('FE-520')
  })

  it('funciona con prefix vacío', () => {
    expect(formatInvoiceNumber({ id: '1', prefix: '', number: 12 })).toBe('12')
  })

  it('devuelve "—" para null/undefined', () => {
    expect(formatInvoiceNumber(null)).toBe('—')
    expect(formatInvoiceNumber(undefined)).toBe('—')
  })
})

describe('getInvoiceStatusLabel / getInvoiceStatusBadgeClass', () => {
  it('traduce los 4 estados al español', () => {
    expect(getInvoiceStatusLabel('open')).toBe('Abierta')
    expect(getInvoiceStatusLabel('closed')).toBe('Cerrada')
    expect(getInvoiceStatusLabel('draft')).toBe('Borrador')
    expect(getInvoiceStatusLabel('void')).toBe('Anulada')
  })

  it('devuelve una clase CSS para cada estado', () => {
    expect(getInvoiceStatusBadgeClass('open')).toContain('bg-amber')
    expect(getInvoiceStatusBadgeClass('closed')).toContain('bg-emerald')
    expect(getInvoiceStatusBadgeClass('draft')).toContain('bg-slate')
    expect(getInvoiceStatusBadgeClass('void')).toContain('bg-rose')
  })

  it('fallback a slate para status desconocido', () => {
    // TypeScript prevents this normally, but the runtime should be safe
    expect(getInvoiceStatusBadgeClass('unknown' as never)).toContain('bg-slate')
  })
})

// =============================================================================
// parseInvoiceFilters
// =============================================================================

describe('parseInvoiceFilters', () => {
  it('devuelve defaults cuando no hay searchParams', () => {
    const f = parseInvoiceFilters(undefined)
    expect(f).toEqual({ status: [], dateFrom: null, dateTo: null, clientName: null, page: 1 })
  })

  it('devuelve defaults con searchParams vacío', () => {
    const f = parseInvoiceFilters({})
    expect(f.status).toEqual([])
    expect(f.page).toBe(1)
  })

  it('parsea status como array cuando viene repetido', () => {
    const f = parseInvoiceFilters({ status: ['open', 'closed'] })
    expect(f.status).toEqual(['open', 'closed'])
  })

  it('parsea status como string único', () => {
    const f = parseInvoiceFilters({ status: 'open' })
    expect(f.status).toEqual(['open'])
  })

  it('parsea status comma-separated', () => {
    const f = parseInvoiceFilters({ status: 'open,closed' })
    expect(f.status).toEqual(['open', 'closed'])
  })

  it('mezcla array + comma-separated si ambos están (no debería pasar, pero tolera)', () => {
    const f = parseInvoiceFilters({ status: ['open,closed', 'draft'] })
    expect(f.status).toEqual(['open', 'closed', 'draft'])
  })

  it('ignora status inválidos (no explota)', () => {
    const f = parseInvoiceFilters({ status: ['open', 'paid', 'closed', 'PAGADA'] })
    expect(f.status).toEqual(['open', 'closed'])
  })

  it('parsea date_from y date_to si tienen formato YYYY-MM-DD', () => {
    const f = parseInvoiceFilters({
      date_from: '2026-01-01',
      date_to: '2026-06-30',
    })
    expect(f.dateFrom).toBe('2026-01-01')
    expect(f.dateTo).toBe('2026-06-30')
  })

  it('ignora dates con formato inválido', () => {
    const f = parseInvoiceFilters({
      date_from: '01-01-2026',
      date_to: 'ayer',
    })
    expect(f.dateFrom).toBeNull()
    expect(f.dateTo).toBeNull()
  })

  it('trimea client_name y lo deja null si vacío', () => {
    expect(parseInvoiceFilters({ client_name: 'ACME' }).clientName).toBe('ACME')
    expect(parseInvoiceFilters({ client_name: '  ' }).clientName).toBeNull()
    expect(parseInvoiceFilters({ client_name: '' }).clientName).toBeNull()
  })

  it('parsea page como entero positivo', () => {
    expect(parseInvoiceFilters({ page: '3' }).page).toBe(3)
    expect(parseInvoiceFilters({ page: '1' }).page).toBe(1)
  })

  it('page no numérico o <1 cae a 1', () => {
    expect(parseInvoiceFilters({ page: 'abc' }).page).toBe(1)
    expect(parseInvoiceFilters({ page: '0' }).page).toBe(1)
    expect(parseInvoiceFilters({ page: '-5' }).page).toBe(1)
    expect(parseInvoiceFilters({}).page).toBe(1)
  })
})

// =============================================================================
// buildInvoicesSearchString
// =============================================================================

describe('buildInvoicesSearchString', () => {
  it('devuelve string vacío para filtros vacíos', () => {
    expect(buildInvoicesSearchString({})).toBe('')
  })

  it('omite valores nulos/vacíos', () => {
    const s = buildInvoicesSearchString({
      status: [],
      dateFrom: null,
      dateTo: null,
      clientName: null,
    })
    expect(s).toBe('')
  })

  it('construye múltiples status como parámetros repetidos', () => {
    const s = buildInvoicesSearchString({ status: ['open', 'closed'] })
    expect(s).toContain('status=open')
    expect(s).toContain('status=closed')
  })

  it('incluye date_from / date_to / client_name si están', () => {
    const s = buildInvoicesSearchString({
      dateFrom: '2026-01-01',
      dateTo: '2026-06-30',
      clientName: 'ACME',
    })
    expect(s).toContain('date_from=2026-01-01')
    expect(s).toContain('date_to=2026-06-30')
    expect(s).toContain('client_name=ACME')
  })

  it('omite page si es 1', () => {
    const s = buildInvoicesSearchString({ page: 1 })
    expect(s).not.toContain('page=')
  })

  it('incluye page si es >1', () => {
    const s = buildInvoicesSearchString({ page: 3 })
    expect(s).toContain('page=3')
  })

  it('roundtrip con parseInvoiceFilters conserva la semántica', () => {
    const original = {
      status: ['open', 'closed'] as const,
      dateFrom: '2026-01-01',
      dateTo: '2026-06-30',
      clientName: 'ACME',
      page: 2,
    }
    const qs = buildInvoicesSearchString(original)
    // Reconstruct the { status: string[] } shape that parseInvoiceFilters expects.
    // Object.fromEntries() would drop duplicate keys, so we build it manually.
    const sp = new URLSearchParams(qs)
    const params: Record<string, string | string[] | undefined> = {
      status: sp.getAll('status'),
      date_from: sp.get('date_from') ?? undefined,
      date_to: sp.get('date_to') ?? undefined,
      client_name: sp.get('client_name') ?? undefined,
      page: sp.get('page') ?? undefined,
    }
    const parsed = parseInvoiceFilters(params)
    expect(parsed.status.sort()).toEqual(['closed', 'open'])
    expect(parsed.dateFrom).toBe('2026-01-01')
    expect(parsed.dateTo).toBe('2026-06-30')
    expect(parsed.clientName).toBe('ACME')
    expect(parsed.page).toBe(2)
  })
})

// =============================================================================
// totalPages
// =============================================================================

describe('totalPages + ALEGRA_PAGE_SIZE', () => {
  it('ALEGRA_PAGE_SIZE = 30 (Alegra hard cap)', () => {
    expect(ALEGRA_PAGE_SIZE).toBe(30)
  })

  it('calcula páginas redondeando hacia arriba', () => {
    expect(totalPages(0)).toBe(1)
    expect(totalPages(1)).toBe(1)
    expect(totalPages(30)).toBe(1)
    expect(totalPages(31)).toBe(2)
    expect(totalPages(60)).toBe(2)
    expect(totalPages(61)).toBe(3)
    expect(totalPages(1247)).toBe(42) // 1247 / 30 = 41.57 → 42
  })
})

// =============================================================================
// buildPaginationLinks
// =============================================================================

describe('buildPaginationLinks', () => {
  const baseFilters = {
    status: ['open'] as const,
    dateFrom: '2026-01-01' as const,
    dateTo: null,
    clientName: 'ACME' as const,
    page: 3,
  }

  it('devuelve null para prev si estamos en página 1', () => {
    const links = buildPaginationLinks({ ...baseFilters, page: 1 }, 100)
    expect(links.prev).toBeNull()
    expect(links.next).not.toBeNull()
  })

  it('devuelve null para next si estamos en la última página', () => {
    // total 100 → 4 páginas; última = 4
    const links = buildPaginationLinks({ ...baseFilters, page: 4 }, 100)
    expect(links.next).toBeNull()
    expect(links.prev).not.toBeNull()
  })

  it('genera URLs correctas con todos los filtros preservados', () => {
    const links = buildPaginationLinks(baseFilters, 100)
    expect(links.prev).toContain('page=2')
    expect(links.next).toContain('page=4')
    expect(links.prev).toContain('status=open')
    expect(links.prev).toContain('date_from=2026-01-01')
    expect(links.prev).toContain('client_name=ACME')
  })

  it('omite page=1 en URLs (porque es el default)', () => {
    // Build a pagination link going BACK to page 1 (no filters). Expected: empty string,
    // NOT '?page=1', because parseInvoiceFilters treats page=1 as the default and
    // the URL should remain clean (the user is just removing the pagination param).
    const links = buildPaginationLinks(
      { status: [], dateFrom: null, dateTo: null, clientName: null, page: 2 },
      100,
    )
    expect(links.prev).toBe('') // back to page 1, no params needed
    expect(links.next).toBe('?page=3') // forward to page 3, page param explicit
  })

  it('preserva filtros activos al paginar (no solo page=)', () => {
    const links = buildPaginationLinks(
      { status: ['open'], dateFrom: '2026-01-01', dateTo: null, clientName: 'ACME', page: 3 },
      100,
    )
    expect(links.prev).toContain('status=open')
    expect(links.prev).toContain('date_from=2026-01-01')
    expect(links.prev).toContain('client_name=ACME')
    expect(links.prev).toContain('page=2')
    expect(links.next).toContain('page=4')
  })
})
