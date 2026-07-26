/**
 * Purchase Invoices List — `/dashboard/finances/bills`.
 *
 * These are facturas de COMPRA: money we owe providers. The sales-side
 * equivalent lives at /dashboard/finances/invoices.
 *
 * Data flow — TWO PATHS, chosen by whether a date filter is active. Same
 * design as the estimates list, and for the same reason:
 *
 *   NO date filter (common case):
 *     One `/bills` page via server-side pagination. `status` and
 *     `provider_name` are real API filters and `metadata.total` is an exact
 *     count, so pagination is correct at a cost of one request.
 *
 *   WITH a date filter:
 *     `/bills` supports only an EXACT `date` — no date_after/date_before.
 *     Filtering one page in memory while paginating against the unfiltered
 *     total produces visible nonsense (a row count that disagrees with the
 *     table, clickable empty pages). So we walk the range and paginate over
 *     the real result.
 */

import { Metadata } from 'next'
import { Suspense } from 'react'
import {
  ALEGRA_TTL,
  getCachedBills,
  getCachedBillsInRange,
  getCachedCompany,
} from '@/lib/alegra/cache'
import {
  ALEGRA_PAGE_SIZE,
  buildBillPaginationLinks,
  parseBillFilters,
} from '@/lib/alegra/transformers'
import { BillTable } from '@/components/dashboard/finances/bill-table'
import { BillFiltersBar } from '@/components/dashboard/finances/bill-filters'
import { BillTableSkeleton } from '@/components/dashboard/finances/bill-table-skeleton'
import { BillEmptyState } from '@/components/dashboard/finances/bill-empty-state'
import { RefreshButton } from '@/components/dashboard/finances/refresh-button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'
import type { BillListItem } from '@/lib/alegra/types'

export const metadata: Metadata = {
  title: 'Facturas de compra | Finanzas',
  description: 'Listado de facturas de proveedor — Alegra',
}

type SearchParams = Record<string, string | string[] | undefined>

interface PageProps {
  searchParams: Promise<SearchParams>
}

// 'dynamic = force-dynamic' is inherited from app/dashboard/finances/layout.tsx.

export default async function BillsListPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const filters = parseBillFilters(sp)

  const activeCount =
    filters.status.length +
    (filters.dateFrom ? 1 : 0) +
    (filters.dateTo ? 1 : 0) +
    (filters.providerName ? 1 : 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Facturas de compra</h1>
          <p className="text-muted-foreground">
            {activeCount > 0
              ? `Listado filtrado — ${activeCount} filtro${activeCount === 1 ? '' : 's'} activo${activeCount === 1 ? '' : 's'}`
              : 'Gastos facturados por proveedores en Alegra'}
          </p>
        </div>
        <RefreshButton />
      </div>

      <BillFiltersBar initial={filters} />

      <Suspense key={JSON.stringify(filters)} fallback={<BillTableSkeleton />}>
        <BillsTableAsync filters={filters} activeCount={activeCount} />
      </Suspense>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Async data section
// -----------------------------------------------------------------------------

async function BillsTableAsync({
  filters,
  activeCount,
}: {
  filters: ReturnType<typeof parseBillFilters>
  activeCount: number
}) {
  const perPage = ALEGRA_PAGE_SIZE
  const hasDateFilter = filters.dateFrom !== null || filters.dateTo !== null

  const [company, page] = await Promise.all([
    getCachedCompany(),
    hasDateFilter ? fetchRangedPage(filters, perPage) : fetchServerPage(filters, perPage),
  ])

  if (page.rows.length === 0) {
    return <BillEmptyState hasActiveFilters={activeCount > 0} filtersCount={activeCount} />
  }

  const links = buildBillPaginationLinks(filters, page.total)

  return (
    <div className="space-y-4">
      {page.truncated && (
        <Alert variant="default" className="border-amber-500/50 text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {/* Wrapped in <p>: AlertDescription is a grid, so any future
                inline emphasis added here would break onto its own line. */}
            <p>
              El rango de fechas tiene más facturas de las que se pueden listar
              de una vez. Estás viendo las más recientes — acotá el rango para
              verlas todas.
            </p>
          </AlertDescription>
        </Alert>
      )}

      <BillTable
        bills={page.rows satisfies BillListItem[]}
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

interface BillsPage {
  rows: BillListItem[]
  /** Row count the pagination is computed against. */
  total: number
  truncated: boolean
}

/** No date filter — Alegra paginates for us, and its total is exact. */
async function fetchServerPage(
  filters: ReturnType<typeof parseBillFilters>,
  perPage: number,
): Promise<BillsPage> {
  const result = await getCachedBills({
    status: filters.status.length > 0 ? filters.status.join(',') : undefined,
    provider_name: filters.providerName ?? undefined,
    start: (filters.page - 1) * perPage,
    limit: perPage,
  })

  return { rows: result.data, total: result.total, truncated: false }
}

/**
 * Date filter active — walk the range, then paginate in memory.
 * `items.length` is the real denominator, so the counter and the table agree.
 */
async function fetchRangedPage(
  filters: ReturnType<typeof parseBillFilters>,
  perPage: number,
): Promise<BillsPage> {
  const result = await getCachedBillsInRange(
    {
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      providerName: filters.providerName,
      status: filters.status.length > 0 ? filters.status.join(',') : null,
    },
    ALEGRA_TTL.list,
  )

  const start = (filters.page - 1) * perPage

  return {
    rows: result.items.slice(start, start + perPage),
    total: result.items.length,
    truncated: result.truncated,
  }
}
