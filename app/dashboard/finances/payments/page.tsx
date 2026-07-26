/**
 * Payments List — `/dashboard/finances/payments`.
 *
 * Shows BOTH directions: `in` (cobros — settling sales invoices) and `out`
 * (pagos — settling purchase invoices, or standalone expenses).
 *
 * ⚠️ THIS IS THE CASH VIEW. Do not add these figures to the ones on
 * /dashboard/finances/bills. A payment against a bill is the SAME money as
 * that bill, one step later — accrual and cash are two lenses, not two
 * transactions. The "Concepto" column exists so the distinction is visible
 * row by row.
 *
 * Data flow: /payments has NO date filter of any kind — not even an exact
 * `date`. So unlike bills and estimates there is no server-paginated
 * fast path when a date range is active; the walk is the only option.
 */

import { Metadata } from 'next'
import { Suspense } from 'react'
import {
  ALEGRA_TTL,
  getCachedCompany,
  getCachedPayments,
  getCachedPaymentsInRange,
} from '@/lib/alegra/cache'
import {
  ALEGRA_PAGE_SIZE,
  buildPaymentPaginationLinks,
  parsePaymentFilters,
} from '@/lib/alegra/transformers'
import { PaymentTable } from '@/components/dashboard/finances/payment-table'
import { PaymentFiltersBar } from '@/components/dashboard/finances/payment-filters'
import { BillTableSkeleton } from '@/components/dashboard/finances/bill-table-skeleton'
import { RefreshButton } from '@/components/dashboard/finances/refresh-button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent } from '@/components/ui/card'
import { AlertTriangle, FileSearch } from 'lucide-react'
import type { PaymentListItem, PaymentType } from '@/lib/alegra/types'

export const metadata: Metadata = {
  title: 'Cobros y pagos | Finanzas',
  description: 'Movimientos de caja registrados — Alegra',
}

type SearchParams = Record<string, string | string[] | undefined>

interface PageProps {
  searchParams: Promise<SearchParams>
}

// 'dynamic = force-dynamic' is inherited from app/dashboard/finances/layout.tsx.

/**
 * The heading follows the `type` filter, so the page names whatever is
 * actually on screen.
 *
 * Both "Cobros" (Ingresos) and "Pagos" (Egresos) point here, differing only
 * by `?type=`. A fixed title would mean arriving from Ingresos and being told
 * you're looking at "Pagos" — the page contradicting the menu that sent you.
 */
function headingFor(type: PaymentType | null) {
  if (type === 'in') {
    return {
      title: 'Cobros',
      subtitle: 'Plata que entró — pagos recibidos de clientes',
    }
  }
  if (type === 'out') {
    return {
      title: 'Pagos',
      subtitle: 'Plata que salió — pagos a proveedores y gastos',
    }
  }
  return {
    title: 'Movimientos de caja',
    subtitle: 'Cobros y pagos registrados en Alegra',
  }
}

export default async function PaymentsListPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const filters = parsePaymentFilters(sp)
  const heading = headingFor(filters.type)

  const activeCount =
    (filters.type ? 1 : 0) + (filters.dateFrom ? 1 : 0) + (filters.dateTo ? 1 : 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{heading.title}</h1>
          <p className="text-muted-foreground">{heading.subtitle}</p>
        </div>
        <RefreshButton />
      </div>

      {/* Only shown when outgoing money is on screen. Under "Cobros" this
          warning would be about documents the user isn't looking at. */}
      {filters.type !== 'in' && (
        <Alert variant="default" className="border-sky-500/40">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Los pagos <strong>cancelan</strong> facturas, no se suman a ellas. Un
            pago asociado a una factura de compra ya está contado en{' '}
            <strong>Facturas de compra</strong> — sumar ambos duplicaría el gasto.
            Los marcados como <em>&ldquo;Gasto sin factura&rdquo;</em> son los
            únicos que no aparecen en ese listado.
          </AlertDescription>
        </Alert>
      )}

      <PaymentFiltersBar initial={filters} />

      <Suspense key={JSON.stringify(filters)} fallback={<BillTableSkeleton />}>
        <PaymentsTableAsync filters={filters} activeCount={activeCount} />
      </Suspense>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Async data section
// -----------------------------------------------------------------------------

async function PaymentsTableAsync({
  filters,
  activeCount,
}: {
  filters: ReturnType<typeof parsePaymentFilters>
  activeCount: number
}) {
  const perPage = ALEGRA_PAGE_SIZE
  const hasDateFilter = filters.dateFrom !== null || filters.dateTo !== null

  const [company, page] = await Promise.all([
    getCachedCompany(),
    hasDateFilter ? fetchRangedPage(filters, perPage) : fetchServerPage(filters, perPage),
  ])

  if (page.rows.length === 0) {
    return <PaymentsEmptyState hasActiveFilters={activeCount > 0} />
  }

  const links = buildPaymentPaginationLinks(filters, page.total)

  return (
    <div className="space-y-4">
      {page.truncated && (
        <Alert variant="default" className="border-amber-500/50 text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            El rango de fechas tiene más movimientos de los que se pueden listar
            de una vez. Estás viendo los más recientes — acotá el rango para
            verlos todos.
          </AlertDescription>
        </Alert>
      )}

      <PaymentTable
        payments={page.rows satisfies PaymentListItem[]}
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

function PaymentsEmptyState({ hasActiveFilters }: { hasActiveFilters: boolean }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <FileSearch className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold">
            {hasActiveFilters
              ? 'No hay movimientos que coincidan con los filtros'
              : 'No hay pagos registrados'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {hasActiveFilters
              ? 'Probá ampliando el rango de fechas o cambiando la dirección.'
              : 'Cuando registres un cobro o un pago en Alegra, aparecerá acá.'}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

// -----------------------------------------------------------------------------
// The two fetch paths
// -----------------------------------------------------------------------------

interface PaymentsPage {
  rows: PaymentListItem[]
  total: number
  truncated: boolean
}

/** No date filter — Alegra paginates, and `type` is a real server-side filter. */
async function fetchServerPage(
  filters: ReturnType<typeof parsePaymentFilters>,
  perPage: number,
): Promise<PaymentsPage> {
  const result = await getCachedPayments({
    type: filters.type ?? undefined,
    start: (filters.page - 1) * perPage,
    limit: perPage,
  })

  return { rows: result.data, total: result.total, truncated: false }
}

/**
 * Date filter active — walk, then paginate in memory. There is no
 * server-side alternative for /payments at all.
 */
async function fetchRangedPage(
  filters: ReturnType<typeof parsePaymentFilters>,
  perPage: number,
): Promise<PaymentsPage> {
  const result = await getCachedPaymentsInRange(
    {
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      type: filters.type,
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
