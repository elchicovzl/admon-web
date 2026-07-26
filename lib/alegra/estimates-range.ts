/**
 * Date-range collection for estimates (cotizaciones).
 *
 * THE PROBLEM
 * -----------
 * Alegra's `/estimates` endpoint does NOT support `date_after` / `date_before`
 * (only an exact `date` match), and caps `limit` at 30. The KPI code used to
 * request one page, filter it in memory, and sum whatever survived.
 *
 * That silently undercounts. An account with 45 cotizaciones in a month gets
 * 30 of them summed and the card reports the result as "Cotizado mes actual"
 * with no indication that a third of the money is missing. A financial number
 * that is quietly wrong is worse than one that is visibly unavailable.
 *
 * THE FIX
 * -------
 * Page through `/estimates` in `date DESC` order and stop at the first
 * document older than the range. Because the list is sorted by date
 * descending, that first out-of-range item proves every remaining one is
 * also out of range — so this reads exactly as many pages as the range
 * needs and not one more.
 *
 * ORDERING IS LOAD-BEARING
 * ------------------------
 * The early stop is only valid if the API really sorts by `date` descending.
 * `AlegraClient.listEstimates` forces `order_direction: 'DESC'` but leaves
 * `order_field` at the API default (id — i.e. creation order), and a document
 * can be created today with last month's date. Callers here therefore pass
 * `order_field: 'date'` EXPLICITLY. Do not remove it.
 *
 * TRUNCATION IS REPORTED, NEVER SILENT
 * ------------------------------------
 * A hard page cap still exists as a runaway guard. When it is hit, the result
 * carries `truncated: true` and the UI says so. The whole point of this module
 * is to stop showing confidently wrong totals.
 */

import type { EstimateListItem, EstimateListResponse } from './types'

/** Alegra's hard cap on `limit` for list endpoints. */
export const ESTIMATES_PAGE_SIZE = 30

/**
 * Runaway guard: at most 10 pages = 300 estimates in a single range.
 *
 * Sized to cover a busy month for the SMB accounts this dashboard serves
 * while bounding the worst case to 10 upstream requests. Combined with the
 * 5-minute KPI cache, even a permanently-truncating account costs ~120
 * requests/hour against a 150/min budget.
 */
export const ESTIMATES_MAX_PAGES = 10

export interface EstimatesRangeResult {
  /** Estimates whose `date` falls inside [dateFrom, dateTo], in API order. */
  estimates: EstimateListItem[]
  /**
   * True when the page cap was reached before the range was fully covered.
   * The caller MUST surface this — the sums are a floor, not the total.
   */
  truncated: boolean
  /** How many upstream pages were actually read (for logging/observability). */
  pagesFetched: number
  /** Exact account-wide total from the `metadata` envelope of the first page. */
  total: number
}

/** Fetches one page. Injected so this module is testable without network. */
export type EstimatesPageFetcher = (
  start: number,
  limit: number,
) => Promise<EstimateListResponse>

export interface CollectEstimatesOptions {
  dateFrom: string | null
  dateTo: string | null
  maxPages?: number
  pageSize?: number
}

/**
 * Walk `/estimates` pages until the requested date range is fully covered.
 *
 * Assumes the fetcher returns items sorted by `date` DESCENDING — see the
 * "ordering is load-bearing" note in the file header.
 *
 * Items without a `date` are skipped rather than treated as range boundaries:
 * a null date says nothing about ordering, so stopping on one would truncate
 * the walk on a data quirk. They are also excluded from the results — showing
 * an undated document under an explicit date filter would be misleading.
 */
export async function collectEstimatesInRange(
  fetchPage: EstimatesPageFetcher,
  { dateFrom, dateTo, maxPages = ESTIMATES_MAX_PAGES, pageSize = ESTIMATES_PAGE_SIZE }: CollectEstimatesOptions,
): Promise<EstimatesRangeResult> {
  const estimates: EstimateListItem[] = []

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

    for (const estimate of rows) {
      // Undated documents can't be positioned in a date-sorted walk.
      if (!estimate.date) continue

      // Sorted DESC: the first item below the floor proves the rest are too.
      if (dateFrom && estimate.date < dateFrom) {
        hitOlderThanRange = true
        break
      }

      // Newer than the ceiling — skip it, but keep walking. These sit at the
      // head of a DESC list and are not evidence that we're done.
      if (dateTo && estimate.date > dateTo) continue

      estimates.push(estimate)
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
      `[Alegra] rango de cotizaciones truncado en ${pagesFetched} páginas ` +
        `(${estimates.length} cotizaciones). El total mostrado es un piso, no el valor real.`,
    )
  }

  return {
    estimates,
    truncated: !rangeCovered,
    pagesFetched,
    total,
  }
}
