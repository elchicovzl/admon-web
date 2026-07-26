/**
 * Estimates List Page — `/dashboard/finances/estimates`.
 *
 * Server Component that:
 *   1. Parses URL filters (URL → typed object)
 *   2. Renders the URL-driven filter bar immediately (filters + initial state)
 *   3. Streams the data fetch + table inside <Suspense> with a skeleton fallback
 *
 * Data flow — TWO PATHS, chosen by whether a date filter is active:
 *
 *   NO date filter (the common case, unchanged):
 *     One `/estimates` page via server-side pagination. `client_name` is a
 *     real API filter and `metadata.total` is an exact count, so pagination
 *     is correct and the page costs exactly one request.
 *
 *   WITH a date filter:
 *     `/estimates` supports neither `date_after` nor `date_before`, so the
 *     old code filtered one page in memory while paginating against the
 *     UNFILTERED total. That produced visible nonsense — "1-30 de 873" above
 *     a three-row table, and empty pages you could click into. Now we walk
 *     the range (`getCachedEstimatesInRange`) and paginate over the result.
 *
 * Why not route everything through the walk: without a date filter the
 * server-side path is already correct AND costs a single request. Making the
 * common case pay for the broken one would be backwards.
 *
 * Layout:
 *   - Header       (sync)
 *   - FilterBar    (Client Component, renders immediately with `initial`)
 *   - Table/Skeleton (async, streamed)
 */

import { Metadata } from 'next'
import { Suspense } from 'react'
import {
  ALEGRA_TTL,
  getCachedCompany,
  getCachedEstimates,
  getCachedEstimatesInRange,
} from '@/lib/alegra/cache'
import {
  ALEGRA_PAGE_SIZE,
  buildEstimatePaginationLinks,
  parseEstimateFilters,
} from '@/lib/alegra/transformers'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'
import { RefreshButton } from '@/components/dashboard/finances/refresh-button'
import { EstimateTable } from '@/components/dashboard/finances/estimate-table'
import { EstimateFiltersBar } from '@/components/dashboard/finances/estimate-filters'
import { EstimateTableSkeleton } from '@/components/dashboard/finances/estimate-table-skeleton'
import { EstimateEmptyState } from '@/components/dashboard/finances/estimate-empty-state'
import type { EstimateListItem } from '@/lib/alegra/types'

export const metadata: Metadata = {
  title: 'Cotizaciones | Finanzas',
  description: 'Listado de cotizaciones — Alegra',
}

type SearchParams = Record<string, string | string[] | undefined>

interface PageProps {
  searchParams: Promise<SearchParams>
}

// 'dynamic = force-dynamic' is inherited from app/dashboard/finances/layout.tsx.

export default async function EstimatesListPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const filters = parseEstimateFilters(sp)

  const activeCount =
    (filters.dateFrom ? 1 : 0) +
    (filters.dateTo ? 1 : 0) +
    (filters.clientName ? 1 : 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cotizaciones</h1>
          <p className="text-muted-foreground">
            {activeCount > 0
              ? `Listado filtrado de cotizaciones — ${activeCount} filtro${activeCount === 1 ? '' : 's'} activo${activeCount === 1 ? '' : 's'}`
              : 'Listado completo de cotizaciones emitidas en Alegra'}
          </p>
        </div>
        <RefreshButton />
      </div>

      {/* Filters — Client Component, URL-driven */}
      <EstimateFiltersBar initial={filters} />

      {/* Data — streamed */}
      <Suspense
        key={JSON.stringify(filters)} // force re-mount on filter change so skeleton shows
        fallback={<EstimateTableSkeleton />}
      >
        <EstimatesTableAsync filters={filters} activeCount={activeCount} />
      </Suspense>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Async data section (runs inside <Suspense>)
// -----------------------------------------------------------------------------

async function EstimatesTableAsync({
  filters,
  activeCount,
}: {
  filters: ReturnType<typeof parseEstimateFilters>
  activeCount: number
}) {
  const perPage = ALEGRA_PAGE_SIZE
  const hasDateFilter = filters.dateFrom !== null || filters.dateTo !== null

  const [company, page] = await Promise.all([
    getCachedCompany(),
    hasDateFilter
      ? fetchRangedPage(filters, perPage)
      : fetchServerPage(filters, perPage),
  ])

  if (page.rows.length === 0) {
    return (
      <EstimateEmptyState
        hasActiveFilters={activeCount > 0}
        filtersCount={activeCount}
      />
    )
  }

  const links = buildEstimatePaginationLinks(filters, page.total)

  return (
    <div className="space-y-4">
      {/* Truncation is announced, never silent — the whole reason this page
          was rewritten is that it used to present a short count as the
          complete answer. */}
      {page.truncated && (
        <Alert variant="default" className="border-amber-500/50 text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            El rango de fechas tiene más cotizaciones de las que se pueden
            listar de una vez. Estás viendo las más recientes — acotá el rango
            para verlas todas.
          </AlertDescription>
        </Alert>
      )}

      <EstimateTable
        estimates={page.rows satisfies EstimateListItem[]}
        total={page.total}
        page={filters.page}
        perPage={perPage}
        currencyCode={company.currency.code}
        prevSearch={links.prev}
        nextSearch={links.next}
      />
    </div>
  )
}

// -----------------------------------------------------------------------------
// The two fetch paths
// -----------------------------------------------------------------------------

interface EstimatesPage {
  rows: EstimateListItem[]
  /** Row count the pagination is computed against. */
  total: number
  truncated: boolean
}

/**
 * No date filter — Alegra paginates for us.
 *
 * `client_name` is a genuine server-side filter and `metadata.total` counts
 * exactly the rows that match it, so page links are correct and the whole
 * page costs one request.
 */
async function fetchServerPage(
  filters: ReturnType<typeof parseEstimateFilters>,
  perPage: number,
): Promise<EstimatesPage> {
  const result = await getCachedEstimates({
    client_name: filters.clientName ?? undefined,
    start: (filters.page - 1) * perPage,
    limit: perPage,
  })

  return { rows: result.data, total: result.total, truncated: false }
}

/**
 * Date filter active — walk the range, then paginate in memory.
 *
 * The walk returns every in-range document, so `estimates.length` is the real
 * denominator. Slicing it locally is what makes the page counter agree with
 * the table: previously the counter used the account-wide total while the
 * table showed a date-filtered subset of a single page.
 */
async function fetchRangedPage(
  filters: ReturnType<typeof parseEstimateFilters>,
  perPage: number,
): Promise<EstimatesPage> {
  const result = await getCachedEstimatesInRange(
    {
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      clientName: filters.clientName,
    },
    ALEGRA_TTL.list,
  )

  const start = (filters.page - 1) * perPage

  return {
    rows: result.estimates.slice(start, start + perPage),
    total: result.estimates.length,
    truncated: result.truncated,
  }
}