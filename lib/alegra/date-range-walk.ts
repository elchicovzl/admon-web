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

/**
 * Cómo viene ordenada la lista, que decide cuándo se puede dejar de leer.
 *
 * `'fecha'` — el orden es por `date` DESC. Permite cortar apenas aparece un
 *   documento más viejo que el rango, pero la paginación NO es estable: entre
 *   documentos del mismo día el desempate cambia de una petición a otra, así
 *   que en los bordes de página se repiten y se pierden filas.
 *
 * `'id'` — el orden es por `id` DESC. La clave es única, así que la paginación
 *   es estable y no hay repetidos ni faltantes. A cambio se pierde el corte por
 *   fecha: el id ordena por creación, no por la fecha del documento, y una
 *   cotización puede crearse hoy llevando fecha del mes pasado. Se compensa
 *   siguiendo unas páginas de más — ver `margenPaginas`.
 *
 * Se usa `'id'` donde el endpoint lo permite. `/bills` solo acepta
 * date/name/dueDate, así que se queda en `'fecha'` y depende del descarte de
 * repetidos para el caso más visible.
 */
export type OrdenDeLista = 'fecha' | 'id'

export interface DateRangeOptions {
  dateFrom: string | null
  dateTo: string | null
  maxPages?: number
  pageSize?: number
  /** Noun used in the truncation warning, e.g. "cotizaciones". */
  label?: string
  /** Cómo viene ordenada la lista. Por defecto 'fecha', el comportamiento viejo. */
  orden?: OrdenDeLista
  /**
   * Con `orden: 'id'`, cuántas páginas seguidas sin nada del rango hay que ver
   * antes de dar el recorrido por terminado.
   *
   * Dos es suficiente: un documento del rango creado mucho después aparece
   * temprano en un orden por id descendente, y el caso contrario —creado mucho
   * antes de su propia fecha— exige haber fechado un documento hacia adelante.
   */
  margenPaginas?: number
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
    orden = 'fecha',
    margenPaginas = 2,
    /**
     * Con orden por id hace falta más recorrido: no se puede cortar al ver una
     * fecha vieja, así que llegar a un mes de hace medio año exige pasar por
     * todo lo posterior. Diez páginas alcanzaban para el corte por fecha; para
     * el orden estable se duplican.
     */
    maxPages = orden === 'id' ? ALEGRA_WALK_MAX_PAGES * 2 : ALEGRA_WALK_MAX_PAGES,
  }: DateRangeOptions,
): Promise<DateRangeResult<T>> {
  const items: T[] = []
  // Identidades ya vistas, para descartar lo que la paginación repita.
  const vistos = new Set<string>()

  let pagesFetched = 0
  let total = 0
  // "Covered" means we proved there is nothing left to read — either we saw a
  // document older than the range, or the API ran out of rows.
  let rangeCovered = false

  // Solo para orden 'id': páginas seguidas sin nada del rango.
  let paginasEnBlanco = 0

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
    let agregadosEnLaPagina = 0

    for (const row of rows) {
      // Undated documents can't be positioned in a date-sorted walk.
      if (!row.date) continue

      // Con orden por fecha, el primero por debajo del piso prueba que los que
      // siguen también lo están. Con orden por id eso no vale: el id ordena por
      // creación, no por la fecha del documento.
      if (orden === 'fecha' && dateFrom && row.date < dateFrom) {
        hitOlderThanRange = true
        break
      }

      if (dateFrom && row.date < dateFrom) continue

      // Newer than the ceiling — skip it, but keep walking. These sit at the
      // head of a DESC list and are not evidence that we're done.
      if (dateTo && row.date > dateTo) continue

      // Repetido por el solapamiento de páginas: se descarta en silencio.
      // Un documento sin `id` no se puede deduplicar y pasa tal cual.
      if (row.id !== undefined && row.id !== null) {
        const identidad = String(row.id)
        if (vistos.has(identidad)) continue
        vistos.add(identidad)
      }

      items.push(row)
      agregadosEnLaPagina++
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

    if (orden === 'id') {
      /**
       * El margen solo corre DESPUÉS de haber entrado al rango.
       *
       * Con orden por id se arranca por los documentos más nuevos, así que un
       * rango viejo tiene por delante varias páginas que no le pertenecen. Si
       * el margen contara desde el principio, cortaría antes de llegar — y así
       * fue: abril-2026 devolvía cero mientras agosto devolvía bien.
       */
      if (agregadosEnLaPagina > 0) {
        paginasEnBlanco = 0
      } else if (items.length > 0) {
        paginasEnBlanco++
      }

      if (items.length > 0 && paginasEnBlanco >= margenPaginas) {
        rangeCovered = true
        break
      }
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
