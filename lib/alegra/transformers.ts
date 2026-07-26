/**
 * Pure helpers for working with Alegra data in the UI.
 *
 * No I/O, no side effects, no Alegra client references. Everything here is
 * trivially unit-testable and safe to call from both Server and Client
 * Components (though it's primarily used server-side).
 */

import type {
  BillListItem,
  BillStatus,
  EstimateListItem,
  InvoiceListItem,
  InvoiceStatus,
  NumberTemplate,
  PaymentListItem,
  PaymentType,
} from './types'

// =============================================================================
// Invoice list filters (URL-driven — pure parsing helpers)
// =============================================================================

/**
 * Mirrors the set of query-string filters supported by the invoices list page.
 * Defaults match the design doc ("no filters" = last 30 by date DESC, page 1).
 */
export interface InvoiceFilters {
  status: InvoiceStatus[]
  dateFrom: string | null // YYYY-MM-DD or null
  dateTo: string | null
  clientName: string | null // substring match against Alegra `client_name`
  page: number
}

const DEFAULT_PAGE = 1

function isValidInvoiceStatus(value: string): value is InvoiceStatus {
  return value === 'open' || value === 'closed' || value === 'draft' || value === 'void'
}

/**
 * Parse Next.js `searchParams` into a validated `InvoiceFilters` object.
 *
 * Accepts both forms of repeated params:
 *   - `?status=open&status=closed` → string[]
 *   - `?status=open,closed`         → string (comma-separated)
 * Anything invalid (bad status, malformed date, non-integer page) is dropped
 * to defaults rather than throwing — fetch failures should be visible to the
 * user, but malformed URLs should not.
 */
export function parseInvoiceFilters(
  searchParams: Record<string, string | string[] | undefined> | undefined,
): InvoiceFilters {
  const sp = searchParams ?? {}

  // status: handle both array and comma-joined forms
  const statusRaw = sp.status
  const status: InvoiceStatus[] = (
    Array.isArray(statusRaw) ? statusRaw : statusRaw ? [statusRaw] : []
  )
    .flatMap((s) => s.split(','))
    .map((s) => s.trim())
    .filter(isValidInvoiceStatus)

  // date_from / date_to: must be YYYY-MM-DD if present
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  const dateFrom = typeof sp.date_from === 'string' && dateRegex.test(sp.date_from) ? sp.date_from : null
  const dateTo = typeof sp.date_to === 'string' && dateRegex.test(sp.date_to) ? sp.date_to : null

  // client_name: any non-empty trimmed string
  const clientNameRaw = typeof sp.client_name === 'string' ? sp.client_name.trim() : ''
  const clientName = clientNameRaw.length > 0 ? clientNameRaw : null

  // page: positive integer, default 1
  const pageRaw = typeof sp.page === 'string' ? Number.parseInt(sp.page, 10) : DEFAULT_PAGE
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : DEFAULT_PAGE

  return { status, dateFrom, dateTo, clientName, page }
}

/**
 * Build a URL query string from a partial filters object.
 * Useful for pagination links and the "Limpiar filtros" button.
 *
 * Does NOT include `?` prefix — caller can prepend.
 */
export function buildInvoicesSearchString(filters: Partial<InvoiceFilters>): string {
  const params = new URLSearchParams()

  // Status: emit one `status=` per value (omit `?status=` if empty)
  if (filters.status && filters.status.length > 0) {
    for (const s of filters.status) params.append('status', s)
  }

  if (filters.dateFrom) params.set('date_from', filters.dateFrom)
  if (filters.dateTo) params.set('date_to', filters.dateTo)
  if (filters.clientName) params.set('client_name', filters.clientName)
  if (filters.page && filters.page > 1) params.set('page', String(filters.page))

  const s = params.toString()
  return s.length > 0 ? `?${s}` : ''
}

/**
 * Compute the total number of pages from a total count and the per-page limit
 * (always 30 — Alegra's hard cap).
 */
export const ALEGRA_PAGE_SIZE = 30

export function totalPages(total: number): number {
  return Math.max(1, Math.ceil(total / ALEGRA_PAGE_SIZE))
}

/**
 * Given current filters and a total count, build the search strings for
 * Anterior / Siguiente links.
 */
export function buildPaginationLinks(
  filters: InvoiceFilters,
  total: number,
): { prev: string | null; next: string | null } {
  const pages = totalPages(total)
  const prev = filters.page > 1 ? buildInvoicesSearchString({ ...filters, page: filters.page - 1 }) : null
  const next = filters.page < pages ? buildInvoicesSearchString({ ...filters, page: filters.page + 1 }) : null
  return { prev, next }
}

// =============================================================================
// Currency formatting
// =============================================================================

const LOCALE = 'es-CO'

/**
 * Build a cached `Intl.NumberFormat` for the given currency code.
 *
 * We cache by currency code because constructing an Intl.NumberFormat is
 * surprisingly expensive (~1ms each) and we format many values per page.
 *
 * Robustness: `new Intl.NumberFormat('es-CO', { currency: '...' })` throws
 * `RangeError: Invalid currency code` for empty strings or non-ISO codes.
 * Since we render dozens of values per page with the formatter, a single
 * bad response would otherwise crash the ENTIRE page → generic error
 * boundary → user sees "Error de conexión" (misleading). Catching the
 * RangeError and falling back to decimal-format-with-symbol-fallback
 * keeps the page alive.
 *
 * @example
 *   const fmt = getCurrencyFormatter('COP')
 *   fmt.format(1234567) // "$ 1.234.567"
 */
const formatterCache = new Map<string, Intl.NumberFormat>()

export function getCurrencyFormatter(currencyCode: string): Intl.NumberFormat {
  const cached = formatterCache.get(currencyCode)
  if (cached) return cached

  let formatter: Intl.NumberFormat
  try {
    formatter = new Intl.NumberFormat(LOCALE, {
      style: 'currency',
      currency: currencyCode,
    })
  } catch {
    // Fallback: empty / invalid / unknown currency code → render as plain
    // decimal number with the original currency symbol if we have one.
    // Better than crashing the whole page over one bad field.
    formatter = new Intl.NumberFormat(LOCALE, {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
  }
  formatterCache.set(currencyCode, formatter)
  return formatter
}

/**
 * Convenience wrapper: format a single amount.
 *
 * @example
 *   formatCurrency(1234567, 'COP') // "$ 1.234.567"
 */
export function formatCurrency(amount: number, currencyCode: string): string {
  return getCurrencyFormatter(currencyCode).format(amount)
}

// =============================================================================
// Date parsing (defensive — Alegra formats are inconsistent)
// =============================================================================

/**
 * Parse an Alegra datetime string into a JS Date.
 *
 * Handles two known formats:
 *   - "2026-06-15 16:04:00"  (most common)
 *   - "15-06-2026 16:04:00"  (DIAN events sometimes)
 *
 * Returns `null` if the string doesn't match either pattern or is invalid.
 * Callers should handle `null` explicitly (don't display "NaN/NaN").
 */
export function parseAlegraDateTime(input: string | null | undefined): Date | null {
  if (!input) return null

  // Pattern A: YYYY-MM-DD HH:MM:SS
  const aPattern = /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}):(\d{2}))?$/
  const aMatch = input.match(aPattern)
  if (aMatch) {
    const [, y, mo, d, h = '00', mi = '00', s = '00'] = aMatch
    const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s))
    return isNaN(date.getTime()) ? null : date
  }

  // Pattern B: DD-MM-YYYY HH:MM:SS
  const bPattern = /^(\d{2})-(\d{2})-(\d{4})(?: (\d{2}):(\d{2}):(\d{2}))?$/
  const bMatch = input.match(bPattern)
  if (bMatch) {
    const [, d, mo, y, h = '00', mi = '00', s = '00'] = bMatch
    const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s))
    return isNaN(date.getTime()) ? null : date
  }

  return null
}

/**
 * Parse a YYYY-MM-DD date string (no time component) into a Date.
 * The Date is constructed in local time (matches the format).
 */
export function parseAlegraDate(input: string | null | undefined): Date | null {
  if (!input) return null
  const match = input.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const [, y, mo, d] = match
  const date = new Date(Number(y), Number(mo) - 1, Number(d))
  return isNaN(date.getTime()) ? null : date
}

// =============================================================================
// Aging (overdue calculation + bucketing)
// =============================================================================

export type AgingBucket = 'current' | 'days_1_30' | 'days_31_60' | 'days_61_90' | 'days_90_plus'

/**
 * How many days an invoice is past its due date.
 *
 * Returns a negative number if the due date is in the future (i.e. not yet overdue).
 * Returns 0 if due today.
 * Returns `null` if the invoice has no due date (open-ended credit).
 */
export function daysOverdue(
  invoice: Pick<InvoiceListItem, 'dueDate' | 'status'>,
  today: Date = new Date(),
): number | null {
  if (!invoice.dueDate) return null
  if (invoice.status === 'closed' || invoice.status === 'void') return 0

  const due = parseAlegraDate(invoice.dueDate)
  if (!due) return null

  // Strip time from `today` to compare day-precision
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const diffMs = todayDay.getTime() - due.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

/**
 * Bucket an invoice into an aging bracket based on days overdue.
 *
 *   current      → not yet due (or no dueDate)
 *   days_1_30    → 1 to 30 days overdue
 *   days_31_60   → 31 to 60 days overdue
 *   days_61_90   → 61 to 90 days overdue
 *   days_90_plus → more than 90 days overdue
 *
 * Closed/void invoices always bucket as `current` (they're settled).
 */
export function computeAgingBucket(
  invoice: Pick<InvoiceListItem, 'dueDate' | 'status'>,
  today: Date = new Date(),
): AgingBucket {
  if (invoice.status === 'closed' || invoice.status === 'void') return 'current'

  const overdue = daysOverdue(invoice, today)
  if (overdue === null || overdue <= 0) return 'current'
  if (overdue <= 30) return 'days_1_30'
  if (overdue <= 60) return 'days_31_60'
  if (overdue <= 90) return 'days_61_90'
  return 'days_90_plus'
}

// =============================================================================
// KPI helpers (pure functions, no I/O)
// =============================================================================

/**
 * Sum a numeric field across a list of invoices.
 * Returns 0 for an empty list (not NaN).
 */
export function sumInvoices<T extends InvoiceListItem>(
  invoices: T[],
  field: keyof Pick<T, 'total' | 'totalPaid' | 'balance'>,
): number {
  return invoices.reduce((acc, inv) => acc + (inv[field] ?? 0), 0)
}

/**
 * Count invoices with the given status(es).
 */
export function countByStatus(
  invoices: Pick<InvoiceListItem, 'status'>[],
  statuses: ReadonlyArray<InvoiceListItem['status']>,
): number {
  return invoices.filter((inv) => statuses.includes(inv.status)).length
}

// =============================================================================
// Display helpers
// =============================================================================

/**
 * Build the human-readable invoice number from a `numberTemplate`.
 * Returns "—" if the template is missing.
 *
 * @example
 *   formatInvoiceNumber({ prefix: 'FE-', number: 520 }) // "FE-520"
 *   formatInvoiceNumber({ prefix: '', number: 12 })      // "12"
 *   formatInvoiceNumber(null)                            // "—"
 */
export function formatInvoiceNumber(template: NumberTemplate | null | undefined): string {
  if (!template) return '—'
  return `${template.prefix ?? ''}${template.number}`
}

/**
 * Map an invoice status to a Spanish label + Tailwind class for badges.
 */
export const INVOICE_STATUS_LABELS = {
  open: 'Abierta',
  closed: 'Cerrada',
  draft: 'Borrador',
  void: 'Anulada',
} as const

export const INVOICE_STATUS_BADGE_CLASS = {
  open: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  closed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  void: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400',
} as const

export function getInvoiceStatusLabel(status: InvoiceListItem['status']): string {
  return INVOICE_STATUS_LABELS[status] ?? status
}

export function getInvoiceStatusBadgeClass(status: InvoiceListItem['status']): string {
  return INVOICE_STATUS_BADGE_CLASS[status] ?? 'bg-slate-100 text-slate-700'
}

// =============================================================================
// Estimates (cotizaciones) — V2
//
// Differences vs the invoice filters:
//   - NO `status` — estimates have no status field (informational documents)
//   - Date-range filtering is CLIENT-SIDE: the /estimates endpoint does NOT
//     support `date_after` / `date_before` (only exact `date`). We fetch a
//     page of 30 and filter in memory; acceptable for V2 since typical pyme
//     accounts have <100 cotizaciones/month. If volume grows, we can switch
//     to multi-request pagination with start/limit — see the design doc.
// =============================================================================

/**
 * Mirrors the URL-driven filters for the estimates list page.
 * NOTE: no `status` field — estimates have no status.
 */
export interface EstimateFilters {
  dateFrom: string | null // YYYY-MM-DD or null
  dateTo: string | null
  clientName: string | null // substring match against Alegra `client_name`
  page: number
}

/**
 * Parse Next.js `searchParams` into a validated `EstimateFilters` object.
 *
 * Same conventions as `parseInvoiceFilters` — accept both array and
 * comma-joined forms for repeated params, drop malformed values silently.
 *
 * NOTE: `dateFrom` / `dateTo` here are UI hints only. The /estimates API
 * doesn't support range filters, so these are applied client-side after
 * fetching. If both are set and the fetched page doesn't include items in
 * that range, the list shows zero results — same UX as a no-match.
 */
export function parseEstimateFilters(
  searchParams: Record<string, string | string[] | undefined> | undefined,
): EstimateFilters {
  const sp = searchParams ?? {}

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  const dateFrom = typeof sp.date_from === 'string' && dateRegex.test(sp.date_from) ? sp.date_from : null
  const dateTo = typeof sp.date_to === 'string' && dateRegex.test(sp.date_to) ? sp.date_to : null

  const clientNameRaw = typeof sp.client_name === 'string' ? sp.client_name.trim() : ''
  const clientName = clientNameRaw.length > 0 ? clientNameRaw : null

  const pageRaw = typeof sp.page === 'string' ? Number.parseInt(sp.page, 10) : DEFAULT_PAGE
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : DEFAULT_PAGE

  return { dateFrom, dateTo, clientName, page }
}

/**
 * Build a URL query string from a partial filters object.
 * Mirrors `buildInvoicesSearchString` minus the status handling.
 */
export function buildEstimatesSearchString(filters: Partial<EstimateFilters>): string {
  const params = new URLSearchParams()

  if (filters.dateFrom) params.set('date_from', filters.dateFrom)
  if (filters.dateTo) params.set('date_to', filters.dateTo)
  if (filters.clientName) params.set('client_name', filters.clientName)
  if (filters.page && filters.page > 1) params.set('page', String(filters.page))

  const s = params.toString()
  return s.length > 0 ? `?${s}` : ''
}

/**
 * Pagination links for the estimates list. Reuses `totalPages` and the
 * 30-item hard cap from the invoice module.
 */
export function buildEstimatePaginationLinks(
  filters: EstimateFilters,
  total: number,
): { prev: string | null; next: string | null } {
  const pages = totalPages(total)
  const prev = filters.page > 1 ? buildEstimatesSearchString({ ...filters, page: filters.page - 1 }) : null
  const next = filters.page < pages ? buildEstimatesSearchString({ ...filters, page: filters.page + 1 }) : null
  return { prev, next }
}

/*
 * REMOVED: `filterEstimatesByDateRange`.
 *
 * It filtered a single already-fetched page by date range. That only ever
 * looked correct on accounts small enough to fit in one 30-row page — beyond
 * that it silently dropped documents, which is how the "Cotizado mes" KPI
 * ended up reporting a fraction of the month as the total.
 *
 * Range filtering now lives in `lib/alegra/estimates-range.ts`, which pages
 * through the API until the range is genuinely covered and reports when it
 * can't. Deliberately not kept "just in case": a public helper that filters
 * ranges over one page is an invitation to reintroduce the same bug.
 */

/**
 * Format an estimate's `number` field for display.
 *
 * Estimates don't use numberTemplate — they have a flat `number` field
 * (string per the API). We coerce to string with no thousands separators
 * (the UI shows it monospaced next to other identifiers, so "10" looks
 * cleaner than "10.00" or "1,000").
 *
 * @example
 *   formatEstimateNumber({ number: 22, ... }) // "22"
 *   formatEstimateNumber({ number: 'COT-8', ... }) // "COT-8" (defensive: some
 *     accounts echo the prefix here too)
 */
export function formatEstimateNumber(estimate: Pick<EstimateListItem, 'number'>): string {
  if (estimate.number === null || estimate.number === undefined) return '—'
  return String(estimate.number)
}

/**
 * Sum a numeric field across a list of estimates. Reuses the `sumInvoices`
 * pattern but typed for `EstimateListItem`. Currently only `total` is
 * summed (no balance/totalPaid on estimates).
 */
export function sumEstimates(
  estimates: EstimateListItem[],
  field: 'total',
): number {
  return estimates.reduce((acc, est) => acc + (est[field] ?? 0), 0)
}

// =============================================================================
// Bills (facturas de compra) — EGRESOS
// =============================================================================

export interface BillFilters {
  status: BillStatus[]
  dateFrom: string | null
  dateTo: string | null
  providerName: string | null
  page: number
}

function isValidBillStatus(value: string): value is BillStatus {
  return value === 'open' || value === 'closed' || value === 'void'
}

/**
 * Parse `searchParams` into validated `BillFilters`.
 * Same conventions as `parseInvoiceFilters` — malformed values fall back to
 * defaults rather than throwing.
 */
export function parseBillFilters(
  searchParams: Record<string, string | string[] | undefined> | undefined,
): BillFilters {
  const sp = searchParams ?? {}

  const statusRaw = sp.status
  const status: BillStatus[] = (
    Array.isArray(statusRaw) ? statusRaw : statusRaw ? [statusRaw] : []
  )
    .flatMap((s) => s.split(','))
    .map((s) => s.trim())
    .filter(isValidBillStatus)

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  const dateFrom = typeof sp.date_from === 'string' && dateRegex.test(sp.date_from) ? sp.date_from : null
  const dateTo = typeof sp.date_to === 'string' && dateRegex.test(sp.date_to) ? sp.date_to : null

  const providerRaw = typeof sp.provider_name === 'string' ? sp.provider_name.trim() : ''
  const providerName = providerRaw.length > 0 ? providerRaw : null

  const pageRaw = typeof sp.page === 'string' ? Number.parseInt(sp.page, 10) : DEFAULT_PAGE
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : DEFAULT_PAGE

  return { status, dateFrom, dateTo, providerName, page }
}

export function buildBillsSearchString(filters: Partial<BillFilters>): string {
  const params = new URLSearchParams()

  if (filters.status && filters.status.length > 0) {
    for (const s of filters.status) params.append('status', s)
  }
  if (filters.dateFrom) params.set('date_from', filters.dateFrom)
  if (filters.dateTo) params.set('date_to', filters.dateTo)
  if (filters.providerName) params.set('provider_name', filters.providerName)
  if (filters.page && filters.page > 1) params.set('page', String(filters.page))

  const s = params.toString()
  return s.length > 0 ? `?${s}` : ''
}

export function buildBillPaginationLinks(
  filters: BillFilters,
  total: number,
): { prev: string | null; next: string | null } {
  const pages = totalPages(total)
  const prev = filters.page > 1 ? buildBillsSearchString({ ...filters, page: filters.page - 1 }) : null
  const next = filters.page < pages ? buildBillsSearchString({ ...filters, page: filters.page + 1 }) : null
  return { prev, next }
}

/** Sum a numeric field across bills. Returns 0 for an empty list, not NaN. */
export function sumBills(
  bills: BillListItem[],
  field: 'total' | 'totalPaid' | 'balance',
): number {
  return bills.reduce((acc, bill) => acc + (bill[field] ?? 0), 0)
}

/**
 * Human-readable bill number. Bills use a flat `billNumber` string (unlike
 * invoices, which nest it in a numberTemplate) and it can legitimately be
 * absent on bills captured without a supplier document number.
 */
export function formatBillNumber(bill: Pick<BillListItem, 'billNumber'>): string {
  const n = bill.billNumber
  if (n === null || n === undefined || n === '') return '—'
  return String(n)
}

export const BILL_STATUS_LABELS = {
  open: 'Por pagar',
  closed: 'Pagada',
  void: 'Anulada',
} as const

export const BILL_STATUS_BADGE_CLASS = {
  // Deliberately NOT the same palette as invoices: an open SALE is money
  // coming in, an open PURCHASE is money going out. Same word, opposite
  // meaning for the business — the colours should not imply otherwise.
  open: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  closed: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  void: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400',
} as const

export function getBillStatusLabel(status: BillStatus): string {
  return BILL_STATUS_LABELS[status] ?? status
}

export function getBillStatusBadgeClass(status: BillStatus): string {
  return BILL_STATUS_BADGE_CLASS[status] ?? 'bg-slate-100 text-slate-700'
}

// =============================================================================
// Payments (pagos)
//
// ⚠️ THE DOUBLE-COUNTING RULE — the reason this section exists.
//
// A payment SETTLES an obligation; it is not a new one. Bills and their
// payments are the same money seen at two moments:
//
//     /bills                → accrual ("what we owe")
//     /payments type=out    → cash    ("what actually left")
//
// NEVER add a bills total to a payments total. The UI shows them as two
// separate, explicitly-labelled figures for exactly this reason.
//
// The one asymmetry: a payment associated ONLY with a category (no bill) is
// an expense that appears nowhere in /bills — a taxi, a bank fee. That is
// the only expense the cash view holds and the accrual view does not, and
// `classifyPaymentAssociation` is how you find them.
// =============================================================================

export interface PaymentFilters {
  type: PaymentType | null
  dateFrom: string | null
  dateTo: string | null
  page: number
}

function isValidPaymentType(value: string): value is PaymentType {
  return value === 'in' || value === 'out'
}

export function parsePaymentFilters(
  searchParams: Record<string, string | string[] | undefined> | undefined,
): PaymentFilters {
  const sp = searchParams ?? {}

  const typeRaw = typeof sp.type === 'string' ? sp.type.trim() : ''
  const type = isValidPaymentType(typeRaw) ? typeRaw : null

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  const dateFrom = typeof sp.date_from === 'string' && dateRegex.test(sp.date_from) ? sp.date_from : null
  const dateTo = typeof sp.date_to === 'string' && dateRegex.test(sp.date_to) ? sp.date_to : null

  const pageRaw = typeof sp.page === 'string' ? Number.parseInt(sp.page, 10) : DEFAULT_PAGE
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : DEFAULT_PAGE

  return { type, dateFrom, dateTo, page }
}

export function buildPaymentsSearchString(filters: Partial<PaymentFilters>): string {
  const params = new URLSearchParams()

  if (filters.type) params.set('type', filters.type)
  if (filters.dateFrom) params.set('date_from', filters.dateFrom)
  if (filters.dateTo) params.set('date_to', filters.dateTo)
  if (filters.page && filters.page > 1) params.set('page', String(filters.page))

  const s = params.toString()
  return s.length > 0 ? `?${s}` : ''
}

export function buildPaymentPaginationLinks(
  filters: PaymentFilters,
  total: number,
): { prev: string | null; next: string | null } {
  const pages = totalPages(total)
  const prev = filters.page > 1 ? buildPaymentsSearchString({ ...filters, page: filters.page - 1 }) : null
  const next = filters.page < pages ? buildPaymentsSearchString({ ...filters, page: filters.page + 1 }) : null
  return { prev, next }
}

/** Sum payment amounts. Returns 0 for an empty list, not NaN. */
export function sumPayments(payments: PaymentListItem[]): number {
  return payments.reduce((acc, p) => acc + (p.amount ?? 0), 0)
}

/**
 * What a payment is settling — the tri-state that keeps expense math honest.
 *
 *   'bill'       → cancels a purchase invoice. ALREADY counted in /bills.
 *                  Adding it to a bills total double-counts.
 *   'invoice'    → collects a sales invoice. Income side, not an expense.
 *   'standalone' → associated only with a category. An expense that exists
 *                  NOWHERE in /bills — the one thing the cash view has that
 *                  the accrual view doesn't.
 *   'unknown'    → `associations` was absent from the response. This is NOT
 *                  the same as 'standalone': it usually means the caller
 *                  forgot `fields=associations`. Treating unknown as
 *                  standalone would invent expenses out of a missing field,
 *                  so callers doing arithmetic must exclude it explicitly.
 */
export type PaymentAssociationKind = 'bill' | 'invoice' | 'standalone' | 'unknown'

export function classifyPaymentAssociation(
  payment: Pick<PaymentListItem, 'associations'>,
): PaymentAssociationKind {
  const assoc = payment.associations

  // Absent entirely → we simply don't know. See the doc comment above.
  if (assoc === null || assoc === undefined) return 'unknown'

  if (Array.isArray(assoc.bills) && assoc.bills.length > 0) return 'bill'
  if (Array.isArray(assoc.invoices) && assoc.invoices.length > 0) return 'invoice'
  if (Array.isArray(assoc.categories) && assoc.categories.length > 0) return 'standalone'

  // An associations object with no populated arrays means the payment really
  // isn't tied to a document — treat it as standalone, not unknown.
  return 'standalone'
}

/**
 * Expenses that would be MISSED by looking at /bills alone: outgoing payments
 * with no bill behind them.
 *
 * Deliberately excludes 'unknown'. If `fields=associations` wasn't requested
 * every payment classifies as unknown, and counting those would silently
 * double the expense figure — the precise failure this module exists to
 * prevent.
 */
export function sumStandaloneExpenses(payments: PaymentListItem[]): number {
  return payments
    .filter((p) => p.type === 'out' && classifyPaymentAssociation(p) === 'standalone')
    .reduce((acc, p) => acc + (p.amount ?? 0), 0)
}

export const PAYMENT_TYPE_LABELS = {
  in: 'Cobro',
  out: 'Pago',
} as const

export const PAYMENT_TYPE_BADGE_CLASS = {
  in: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  out: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
} as const

export function getPaymentTypeLabel(type: PaymentType): string {
  return PAYMENT_TYPE_LABELS[type] ?? type
}

export function getPaymentTypeBadgeClass(type: PaymentType): string {
  return PAYMENT_TYPE_BADGE_CLASS[type] ?? 'bg-slate-100 text-slate-700'
}

/** Short Spanish description of what a payment settles, for the table. */
export function describePaymentAssociation(
  payment: Pick<PaymentListItem, 'associations'>,
): string {
  switch (classifyPaymentAssociation(payment)) {
    case 'bill':
      return 'Factura de compra'
    case 'invoice':
      return 'Factura de venta'
    case 'standalone':
      return 'Sin factura'
    default:
      return '—'
  }
}
