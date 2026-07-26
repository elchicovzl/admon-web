/**
 * Finances Home Page — Overview with KPI cards.
 *
 * Server Component that reads Alegra through the cached layer
 * (`lib/alegra/cache.ts`) at the `kpis` TTL — 5 minutes.
 *
 * This is the most expensive page in the module and the one whose numbers
 * tolerate staleness best: they're month-to-date aggregates, not an
 * operational worklist. Caching it is what keeps the account clear of
 * Alegra's 150 req/min quota. The "Actualizar" button flushes every tag for
 * operators who need the number NOW.
 *
 * 5 parallel reads via `Promise.all`:
 *   - company       : company config (currency, locale)
 *   - mtd           : invoices this month, any status (open/closed/draft)
 *   - open          : all open invoices (data + total count for the 4th KPI)
 *   - overdue30     : open invoices past 30 days
 *   - estimatesMtd  : V2 — a paginated walk of this month's estimates. Backs
 *                     BOTH "Cotizado mes" (summed) and "Cotizaciones activas"
 *                     (its `metadata.total`, which is account-wide). This is
 *                     1..N upstream requests depending on monthly volume;
 *                     every other entry above is exactly one.
 *
 * Error handling: any thrown Alegra error propagates to the nearest
 * `error.tsx` boundary (alongside this file) which shows a friendly UI.
 */

import { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { startOfMonth, subDays, format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import {
  ALEGRA_TTL,
  getCachedCompany,
  getCachedEstimatesInRange,
  getCachedInvoices,
} from '@/lib/alegra/cache'
import {
  sumInvoices,
  sumEstimates,
  formatCurrency,
} from '@/lib/alegra/transformers'
import { KpiCards, KpiCardsSkeleton } from '@/components/dashboard/finances/kpi-cards'
import { RefreshButton } from '@/components/dashboard/finances/refresh-button'

export const metadata: Metadata = {
  title: 'Finanzas | Dashboard',
  description: 'Resumen financiero — facturas, cobros y vencidos (Alegra)',
}

// 'dynamic = force-dynamic' is inherited from app/dashboard/finances/layout.tsx.

// -----------------------------------------------------------------------------
// Data fetch (async server component inside Suspense)
// -----------------------------------------------------------------------------

async function FinancesKpis() {
  const today = new Date()
  const monthStart = format(startOfMonth(today), 'yyyy-MM-dd')
  const thirtyDaysAgoStr = format(subDays(today, 30), 'yyyy-MM-dd')

  // All 6 calls are independent — fire them in parallel so the user only
  // pays for ONE round-trip's worth of latency, not 6.
  //
  // All of them go through the cached layer at the `kpis` TTL. On a warm
  // cache this page makes ZERO upstream requests; on a cold one, the
  // client's single-flight de-duplication collapses any overlapping
  // identical calls into one socket.
  const [company, mtd, open, overdue, estimatesMtd] = await Promise.all([
    getCachedCompany(),
    getCachedInvoices(
      {
        date_after: monthStart,
        status: 'open,closed,draft',
      },
      ALEGRA_TTL.kpis,
    ),
    getCachedInvoices({ status: 'open' }, ALEGRA_TTL.kpis),
    getCachedInvoices(
      {
        status: 'open',
        dueDate_before: thirtyDaysAgoStr,
      },
      ALEGRA_TTL.kpis,
    ),
    // V2 — estimates. Paginates until the month is fully covered instead of
    // trusting one 30-row page — see lib/alegra/estimates-range.ts. The old
    // call passed `date_after`, which /estimates silently IGNORES, so the
    // param only ever added noise to the cache key.
    //
    // This ALSO covers the "Cotizaciones activas" count: the walk reads
    // `metadata.total` off its first page, and since it sends no filters
    // that total is already account-wide. A separate request just to read
    // the same integer would be a wasted round trip.
    getCachedEstimatesInRange({ dateFrom: monthStart, dateTo: null }, ALEGRA_TTL.kpis),
  ])

  const fmt = (amount: number) => formatCurrency(amount, company.currency.code)

  const kpis = {
    // V1 — invoices
    mtdBilled: fmt(sumInvoices(mtd.data, 'total')),
    openReceivables: fmt(sumInvoices(open.data, 'balance')),
    overdue30: fmt(sumInvoices(overdue.data, 'balance')),
    // After the InvoiceListResponseSchema transform, the count is at .total
    // (top level), NOT .metadata.total — the metadata object is stripped
    // during normalization. Originally I wrote .metadata.total which would
    // also work on the raw Alegra response but breaks the contract.
    openCount: open.total,
    // V2 — estimates.
    // `getCachedEstimatesInRange` already walked as many pages as the month
    // needed and returned ONLY in-range documents, so no client-side date
    // filter is required here anymore. When the page cap was hit anyway,
    // `truncated` is true and the card labels the figure as a minimum
    // instead of presenting a short count as the total.
    // `estimatesActive` uses `result.total` from metadata, which IS the
    // exact count regardless of pagination.
    estimatesMtd: fmt(sumEstimates(estimatesMtd.estimates, 'total')),
    estimatesMtdTruncated: estimatesMtd.truncated,
    estimatesActive: estimatesMtd.total,
    currencyCode: company.currency.code,
  }

  return <KpiCards kpis={kpis} />
}

// -----------------------------------------------------------------------------
// Page
// -----------------------------------------------------------------------------

export default async function FinancesHomePage() {
  return (
    <div className="space-y-6">
      {/* Header — renders immediately */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Finanzas</h1>
          {/* Copy states the actual freshness. It previously said "datos en
              vivo", which stopped being true when the 5-minute KPI cache
              landed — and a dashboard that misreports its own staleness is
              worse than a slow one. */}
          <p className="text-muted-foreground">
            Resumen de facturación desde Alegra — se actualiza cada 5 minutos
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <RefreshButton />
          <Button asChild variant="outline">
            <Link href="/dashboard/finances/estimates">
              Ver cotizaciones
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/finances/invoices">
              Ver todas las facturas
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI cards — streamed in via Suspense */}
      <Suspense fallback={<KpiCardsSkeleton />}>
        <FinancesKpis />
      </Suspense>

      {/* Future: aquí irían los gráficos de tendencia (V2) */}
    </div>
  )
}
