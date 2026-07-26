/**
 * Paginated date-range collection for Alegra list endpoints.
 *
 * THE PROBLEM
 * -----------
 * Three of the four list endpoints this dashboard uses cannot filter by a
 * date RANGE server-side:
 *
 *   /invoices  → supports date_after / date_before      ✅ no walk needed
 *   /estimates → only an exact `date`                   ❌ needs a walk
 *   /bills     → only an exact `date`                   ❌ needs a walk
 *   /payments  → NO date filter at all                  ❌ needs a walk
 *
 * All three cap `limit` at 30. The naive approach — fetch one page, filter it
 * in memory — silently undercounts as soon as the range holds more than 30
 * documents, and presents the short result as if it were complete. That bug
 * shipped once already in the "Cotizado mes" KPI; this module exists so it
 * cannot ship again for bills or payments.
 *
 * THE APPROACH
 * ------------
 * Page through the endpoint in `date DESC` order and stop at the first
 * document older than the range. Because the list is sorted by date
 * descending, that first out-of-range item proves every remaining one is also
 * out of range — so this reads exactly as many pages as the range needs and
 * not one more.
 *
 * ORDERING IS LOAD-BEARING
 * ------------------------
 * The early stop is only valid if the API really sorts by `date` descending.
 * Alegra's defaults do NOT guarantee that (see `AlegraClient.listEstimates`),
 * so every fetcher passed in here MUST come from a client method that forces
 * `order_field: 'date'` and `order_direction: 'DESC'`.
 *
 * TRUNCATION IS REPORTED, NEVER SILENT
 * ------------------------------------
 * A hard page cap exists as a runaway guard. When it is hit, the result
 * carries `truncated: true` and every caller surfaces that in the UI. A
 * financial figure that is quietly wrong is worse than one that is visibly
 * unavailable.
 */

/** Alegra's hard cap on `limit` for list endpoints. */
export const ALEGRA_WALK_PAGE_SIZE = 30

/**
 * Runaway guard: at most 10 pages = 300 documents in a single range.
 *
 * Sized to cover a busy month for the SMB accounts this dashboard serves
 * while bounding the worst case to 10 upstream requests. Combined with the
 * 5-minute KPI cache, even a permanently-truncating account costs ~120
 * requests/hour against a 150/min budget.
 */
export const ALEGRA_WALK_MAX_PAGES = 10

/** Minimum shape the walk needs: anything carrying an optional date string. */
export interface DatedDocument {
  date?: string | null
}

/** Minimum shape of a list response: rows plus an exact account-wide total. */
export interface ListPage<T> {
  data: T[]
  total: number
}

export interface DateRangeResult<T> {
  /** Documents whose `date` falls inside [dateFrom, dateTo], in API order. */
  items: T[]
  /**
   * True when the page cap was reached before the range was fully covered,
   * i.e. the caller is holding a FLOOR rather than the complete set.
   * Callers MUST surface this.
   */
  truncated: boolean
  /** How many upstream pages were actually read (for logging/observability). */
  pagesFetched: number
  /** Exact account-wide total from the `metadata` envelope of the first page. */
  total: number
}

/** Fetches one page. Injected so this module is testable without network. */
export type PageFetcher<T> = (start: number, limit: number) => Promise<ListPage<T>>

export interface DateRangeOptions {
  dateFrom: string | null
  dateTo: string | null
  maxPages?: number
  pageSize?: number
  /** Noun used in the truncation warning, e.g. "cotizaciones". */
  label?: string
}

/**
 * Walk list pages until the requested date range is fully covered.
 *
 * Assumes the fetcher returns items sorted by `date` DESCENDING — see the
 * "ordering is load-bearing" note in the file header.
 *
 * Items without a `date` are skipped rather than treated as range boundaries:
 * a null date says nothing about ordering, so stopping on one would truncate
 * the walk on a data quirk. They are also excluded from the results — showing
 * an undated document under an explicit date filter would be misleading.
 */
export async function collectByDateRange<T extends DatedDocument>(
  fetchPage: PageFetcher<T>,
  {
    dateFrom,
    dateTo,
    maxPages = ALEGRA_WALK_MAX_PAGES,
    pageSize = ALEGRA_WALK_PAGE_SIZE,
    label = 'documentos',
  }: DateRangeOptions,
): Promise<DateRangeResult<T>> {
  const items: T[] = []

  let pagesFetched = 0
  let total = 0
  // "Covered" means we proved there is nothing left to read — either we saw a
  // document older than the range, or the API ran out of rows.
  let rangeCovered = false

  for (let page = 0; page < maxPages; page++) {
    const response = await fetchPage(page * pageSize, pageSize)
    pagesFetched++

    if (page === 0) {
      total = response.total
    }

    const rows = response.data

    if (rows.length === 0) {
      rangeCovered = true
      break
    }

    let hitOlderThanRange = false

    for (const row of rows) {
      // Undated documents can't be positioned in a date-sorted walk.
      if (!row.date) continue

      // Sorted DESC: the first item below the floor proves the rest are too.
      if (dateFrom && row.date < dateFrom) {
        hitOlderThanRange = true
        break
      }

      // Newer than the ceiling — skip it, but keep walking. These sit at the
      // head of a DESC list and are not evidence that we're done.
      if (dateTo && row.date > dateTo) continue

      items.push(row)
    }

    if (hitOlderThanRange) {
      rangeCovered = true
      break
    }

    // A short page is the last page.
    if (rows.length < pageSize) {
      rangeCovered = true
      break
    }
  }

  if (!rangeCovered) {
    console.warn(
      `[Alegra] rango de ${label} truncado en ${pagesFetched} páginas ` +
        `(${items.length} ${label}). El total mostrado es un piso, no el valor real.`,
    )
  }

  return {
    items,
    truncated: !rangeCovered,
    pagesFetched,
    total,
  }
}
