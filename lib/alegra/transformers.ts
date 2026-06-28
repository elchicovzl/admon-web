/**
 * Pure helpers for working with Alegra data in the UI.
 *
 * No I/O, no side effects, no Alegra client references. Everything here is
 * trivially unit-testable and safe to call from both Server and Client
 * Components (though it's primarily used server-side).
 */

import type { InvoiceListItem, NumberTemplate } from './types'

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
 * @example
 *   const fmt = getCurrencyFormatter('COP')
 *   fmt.format(1234567) // "$ 1.234.567"
 */
const formatterCache = new Map<string, Intl.NumberFormat>()

export function getCurrencyFormatter(currencyCode: string): Intl.NumberFormat {
  const cached = formatterCache.get(currencyCode)
  if (cached) return cached

  const formatter = new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: currencyCode,
    // COP usually has 0 decimals in Colombia but other currencies may differ.
    // Let Intl decide based on the currency code itself.
  })
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
