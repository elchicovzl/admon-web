/**
 * Invoices List Page — `/dashboard/finances/invoices`.
 *
 * Server Component that:
 *   1. Parses URL filters (URL → typed object)
 *   2. Renders the URL-driven filter bar immediately (filters + initial state)
 *   3. Streams the data fetch + table inside <Suspense> with a skeleton fallback
 *
 * Layout:
 *   - Header       (sync)
 *   - FilterBar    (Client Component, renders immediately with `initial`)
 *   - Table/Skeleton (async, streamed)
 */

import { Metadata } from 'next'
import { Suspense } from 'react'
import { getCachedCompany, getCachedInvoices } from '@/lib/alegra/cache'
import {
  ALEGRA_PAGE_SIZE,
  buildPaginationLinks,
  parseInvoiceFilters,
} from '@/lib/alegra/transformers'
import { RefreshButton } from '@/components/dashboard/finances/refresh-button'
import { InvoiceTable } from '@/components/dashboard/finances/invoice-table'
import {
  InvoiceFiltersBar,
} from '@/components/dashboard/finances/invoice-filters'
import { InvoiceTableSkeleton } from '@/components/dashboard/finances/invoice-table-skeleton'
import { InvoiceEmptyState } from '@/components/dashboard/finances/empty-state'
import type { InvoiceListItem } from '@/lib/alegra/types'

export const metadata: Metadata = {
  title: 'Facturas | Finanzas',
  description: 'Listado de facturas de venta — Alegra',
}

// searchParams in Next.js 15 is a Promise — await it explicitly
type SearchParams = Record<string, string | string[] | undefined>

interface PageProps {
  searchParams: Promise<SearchParams>
}

// 'dynamic = force-dynamic' is inherited from app/dashboard/finances/layout.tsx.

export default async function InvoicesListPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const filters = parseInvoiceFilters(sp)

  const activeCount =
    filters.status.length +
    (filters.dateFrom ? 1 : 0) +
    (filters.dateTo ? 1 : 0) +
    (filters.clientName ? 1 : 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Facturas de venta</h1>
          <p className="text-muted-foreground">
            {activeCount > 0
              ? `Listado filtrado de facturas — ${activeCount} filtro${activeCount === 1 ? '' : 's'} activo${activeCount === 1 ? '' : 's'}`
              : 'Listado completo de facturas emitidas en Alegra'}
          </p>
        </div>
        <RefreshButton />
      </div>

      {/* Filters — Client Component, URL-driven */}
      <InvoiceFiltersBar initial={filters} />

      {/* Data — streamed */}
      <Suspense
        key={JSON.stringify(filters)} // force re-mount on filter change so skeleton shows
        fallback={<InvoiceTableSkeleton />}
      >
        <InvoicesTableAsync filters={filters} activeCount={activeCount} />
      </Suspense>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Async data section (runs inside <Suspense>)
// -----------------------------------------------------------------------------

async function InvoicesTableAsync({
  filters,
  activeCount,
}: {
  filters: ReturnType<typeof parseInvoiceFilters>
  activeCount: number
}) {
  // Alegra's hard cap on `limit` is 30. Forcing it here keeps the URL-driven
  // page logic consistent even if a future caller passes a different value.
  const perPage = ALEGRA_PAGE_SIZE
  const start = (filters.page - 1) * perPage

  const listParams = {
    status: filters.status.length > 0 ? filters.status.join(',') : undefined,
    date_after: filters.dateFrom ?? undefined,
    date_before: filters.dateTo ?? undefined,
    client_name: filters.clientName ?? undefined,
    start,
    limit: perPage,
    metadata: true,
    order_field: 'date' as const,
    order_direction: 'DESC' as const,
  }

  // Default `list` TTL (30s) — this is the operational view, so it stays
  // much tighter than the KPI aggregates. `getCachedCompany` rides its own
  // 1h TTL and will essentially always be a cache hit.
  const [company, result] = await Promise.all([
    getCachedCompany(),
    getCachedInvoices(listParams),
  ])

  if (result.data.length === 0) {
    return (
      <InvoiceEmptyState
        hasActiveFilters={activeCount > 0}
        filtersCount={activeCount}
      />
    )
  }

  const links = buildPaginationLinks(filters, result.total)

  return (
    <InvoiceTable
      invoices={result.data satisfies InvoiceListItem[]}
      total={result.total}
      page={filters.page}
      perPage={perPage}
      currencyCode={company.currency.code}
      prevSearch={links.prev}
      nextSearch={links.next}
    />
  )
}
