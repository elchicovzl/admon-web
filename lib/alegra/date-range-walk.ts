/**
 * Paginated date-range collection for Alegra list endpoints.
 *
 * THE PROBLEM
 * -----------
 * Not every list endpoint this dashboard uses can narrow by a date RANGE
 * server-side (verified against the live API, 2026-10-02):
 *
 *   /invoices  → date_after / date_before               ✅ no walk needed
 *   /estimates → date_after / date_before, exact date   ✅ narrows the walk
 *   /bills     → exact `date` only (range params ignored) ❌ needs a walk
 *   /payments  → exact `date` only (range params ignored) ❌ needs a walk
 *
 * All of them cap `limit` at 30. The naive approach — fetch one page, filter it
 * in memory — silently undercounts as soon as the range holds more than 30
 * documents, and presents the short result as if it were complete. That bug
 * shipped once already in the "Cotizado mes" KPI; this module exists so it
 * cannot ship again.
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
 * `order_field: 'date'` and `order_direction: 'DESC'`. (Ordering by `id` is
 * not an alternative: Alegra sorts it as a STRING, so 999 > 1267.)
 *
 * UNSTABLE TIES, AND HOW THE WALK ANSWERS THEM
 * --------------------------------------------
 * Within one date the tie-break is undocumented and not stable between
 * requests, so a date group that straddles a page boundary can repeat some
 * rows and lose others. When the walk sees the same date on both sides of a
 * boundary it refetches that date through `fetchDatePage` (the endpoint's
 * exact `date` filter), paginating it completely, and replaces whatever it had
 * collected for that date with the exact set.
 *
 * Alegra answers HTTP 500, not an empty page, when `start` is at or beyond the
 * total — so the walk never requests a page whose `start >= total`.
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
  /**
   * Identidad del documento. Cuando está, el walk descarta repetidos.
   *
   * Hace falta porque la paginación de Alegra NO es estable: ordena por
   * `date`, y entre documentos del mismo día el desempate cambia de una
   * petición a otra. Con varios documentos compartiendo fecha en el borde de
   * una página, la misma fila vuelve a aparecer en la siguiente.
   *
   * Observado en la cuenta real: abril-2026 devolvía 81 filas para 73
   * cotizaciones distintas, con ocho ids consecutivos repetidos justo en un
   * borde de página. Eso no era solo una clave repetida en React — inflaba el
   * total en la misma proporción.
   */
  id?: string | number
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

/** Fetches one page of the documents dated exactly `date`. */
export type DatePageFetcher<T> = (
  date: string,
  start: number,
  limit: number,
) => Promise<ListPage<T>>

export interface DateRangeOptions<T = DatedDocument> {
  dateFrom: string | null
  dateTo: string | null
  /** Page cap for the main walk, and per date for exact-date refetches. */
  maxPages?: number
  pageSize?: number
  /** Noun used in the truncation warning, e.g. "cotizaciones". */
  label?: string
  /**
   * Exact-date fetcher backed by the endpoint's `date` filter. When given, a
   * date seen on both sides of a page boundary is refetched completely and
   * its rows are replaced by the exact set, which makes the result immune to
   * Alegra's unstable same-date tie-break. Paginated internally with the same
   * `pageSize`, short-page and total guards. Its pages count in `pagesFetched`.
   * Without it the walk only dedupes by `id` (rows can still be lost).
   */
  fetchDatePage?: DatePageFetcher<T>
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
    pageSize = ALEGRA_WALK_PAGE_SIZE,
    label = 'documentos',
    maxPages = ALEGRA_WALK_MAX_PAGES,
    fetchDatePage,
  }: DateRangeOptions<T>,
): Promise<DateRangeResult<T>> {
  const items: T[] = []
  // Identidades ya vistas, para descartar lo que la paginación repita.
  const vistos = new Set<string>()
  // Dates already replaced by their exact set; later rows of those dates are
  // ignored because the exact set is authoritative.
  const exactDates = new Set<string>()

  let pagesFetched = 0
  let total = 0
  // "Covered" means we proved there is nothing left to read — either we saw a
  // document older than the range, the API ran out of rows, or `total` was
  // reached.
  let rangeCovered = false
  // An exact-date refetch hit the page cap before finishing.
  let exactTruncated = false

  const inRange = (date: string) =>
    !(dateFrom && date < dateFrom) && !(dateTo && date > dateTo)

  /** Add a row unless its id was already seen. */
  const push = (row: T) => {
    if (row.id !== undefined && row.id !== null) {
      const identidad = String(row.id)
      if (vistos.has(identidad)) return
      vistos.add(identidad)
    }
    items.push(row)
  }

  /** Fetch every row dated exactly `date`, paginating with the usual guards. */
  const fetchExactDate = async (date: string, fetcher: DatePageFetcher<T>) => {
    const exact: T[] = []
    const seen = new Set<string>()
    let exactTotal = 0
    let complete = false

    for (let p = 0; p < maxPages; p++) {
      const response = await fetcher(date, p * pageSize, pageSize)
      pagesFetched++
      if (p === 0) exactTotal = response.total

      for (const row of response.data) {
        if (row.date !== date) continue
        if (row.id !== undefined && row.id !== null) {
          const identidad = String(row.id)
          if (seen.has(identidad)) continue
          seen.add(identidad)
        }
        exact.push(row)
      }

      if (response.data.length < pageSize) {
        complete = true
        break
      }
      if (exactTotal > 0 && (p + 1) * pageSize >= exactTotal) {
        complete = true
        break
      }
    }

    return { exact, complete }
  }

  /** Replace everything collected for `date` with the exact set. */
  const replaceDate = async (date: string, fetcher: DatePageFetcher<T>) => {
    const { exact, complete } = await fetchExactDate(date, fetcher)
    exactDates.add(date)

    if (!complete) {
      // Partial exact set: never drop rows we already hold, only add new ones.
      exactTruncated = true
      for (const row of exact) push(row)
      return
    }

    const firstIdx = items.findIndex((row) => row.date === date)
    const kept: T[] = []
    for (const row of items) {
      if (row.date === date) {
        if (row.id !== undefined && row.id !== null) vistos.delete(String(row.id))
      } else {
        kept.push(row)
      }
    }
    const at = firstIdx < 0 ? kept.length : firstIdx
    // Rows before `firstIdx` are never of `date`, so the index is unchanged.
    kept.splice(at, 0, ...exact)
    for (const row of exact) {
      if (row.id !== undefined && row.id !== null) vistos.add(String(row.id))
    }
    items.length = 0
    items.push(...kept)
  }

  // Date of the last dated row of the previous page, to detect a date group
  // that straddles a page boundary.
  let previousLastDate: string | null = null

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

      // The list is date DESC, so the first row below the floor proves every
      // following row is also out of range.
      if (dateFrom && row.date < dateFrom) {
        hitOlderThanRange = true
        break
      }

      // Newer than the ceiling — skip it, but keep walking. These sit at the
      // head of a DESC list and are not evidence that we're done.
      if (dateTo && row.date > dateTo) continue

      if (exactDates.has(row.date)) continue

      // Repeated rows (unstable tie-break) are dropped silently. A document
      // without `id` can't be deduplicated and passes through.
      push(row)
    }

    const firstDated = rows.find((row) => row.date)?.date ?? null
    const lastDated = [...rows].reverse().find((row) => row.date)?.date ?? null

    // Same date on both sides of the boundary: the tie-break of an unstable
    // list may have dropped or repeated rows of that date, so fetch it exactly.
    if (
      fetchDatePage &&
      page > 0 &&
      firstDated &&
      firstDated === previousLastDate &&
      inRange(firstDated) &&
      !exactDates.has(firstDated)
    ) {
      await replaceDate(firstDated, fetchDatePage)
    }
    previousLastDate = lastDated

    if (hitOlderThanRange) {
      rangeCovered = true
      break
    }

    // A short page is the last page.
    if (rows.length < pageSize) {
      rangeCovered = true
      break
    }

    // Alegra answers HTTP 500 past the end, so never ask for `start >= total`.
    if (total > 0 && (page + 1) * pageSize >= total) {
      rangeCovered = true
      break
    }
  }

  const truncated = !rangeCovered || exactTruncated

  if (truncated) {
    console.warn(
      `[Alegra] rango de ${label} truncado en ${pagesFetched} páginas ` +
        `(${items.length} ${label}). El total mostrado es un piso, no el valor real.`,
    )
  }

  return {
    items,
    truncated,
    pagesFetched,
    total,
  }
}
