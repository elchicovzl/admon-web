/**
 * Estimates List Page — `/dashboard/finances/estimates`.
 *
 * Server Component that:
 *   1. Parses URL filters (URL → typed object)
 *   2. Renders the URL-driven filter bar immediately (filters + initial state)
 *   3. Streams the data fetch + table inside <Suspense> with a skeleton fallback
 *
 * Data flow:
 *   - `client_name` filter goes straight to Alegra (substring match)
 *   - Date range filters are applied CLIENT-SIDE after the fetch
 *     (`filterEstimatesByDateRange`) because /estimates has no
 *     date_after / date_before support
 *   - `start` / `limit` give us a 30-item page (Alegra's hard cap)
 *
 * Layout:
 *   - Header       (sync)
 *   - FilterBar    (Client Component, renders immediately with `initial`)
 *   - Table/Skeleton (async, streamed)
 */

import { Metadata } from 'next'
import { Suspense } from 'react'
import { getAlegraClient } from '@/lib/alegra/client'
import {
  ALEGRA_PAGE_SIZE,
  buildEstimatePaginationLinks,
  filterEstimatesByDateRange,
  parseEstimateFilters,
} from '@/lib/alegra/transformers'
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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cotizaciones</h1>
        <p className="text-muted-foreground">
          {activeCount > 0
            ? `Listado filtrado de cotizaciones — ${activeCount} filtro${activeCount === 1 ? '' : 's'} activo${activeCount === 1 ? '' : 's'}`
            : 'Listado completo de cotizaciones emitidas en Alegra'}
        </p>
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
  const client = getAlegraClient()

  const perPage = ALEGRA_PAGE_SIZE
  const start = (filters.page - 1) * perPage

  // /estimates does NOT support date_after/date_before, so we only send the
  // server-side filters it accepts. The date range is applied below via
  // filterEstimatesByDateRange — see file header.
  const listParams = {
    client_name: filters.clientName ?? undefined,
    start,
    limit: perPage,
    metadata: true,
    order_field: 'date' as const,
    order_direction: 'DESC' as const,
  }

  const [company, result] = await Promise.all([
    client.getCompany(),
    client.listEstimates(listParams),
  ])

  // Apply the date-range filter client-side. `filterEstimatesByDateRange`
  // returns the same reference when no range is active, so the no-op case
  // costs zero.
  const filtered = filterEstimatesByDateRange(result.data, filters.dateFrom, filters.dateTo)

  if (filtered.length === 0) {
    return (
      <EstimateEmptyState
        hasActiveFilters={activeCount > 0}
        filtersCount={activeCount}
      />
    )
  }

  // Pagination is based on the total that matches the SERVER filters (not
  // the client-side date range), because the API gave us that count. If
  // the user filters by a range that excludes everything on this page,
  // they see the empty state with no pagination links (which is correct).
  const links = buildEstimatePaginationLinks(filters, result.total)

  return (
    <EstimateTable
      estimates={filtered satisfies EstimateListItem[]}
      total={result.total}
      page={filters.page}
      perPage={perPage}
      currencyCode={company.currency.code}
      prevSearch={links.prev}
      nextSearch={links.next}
    />
  )
}