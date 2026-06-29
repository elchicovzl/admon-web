/**
 * Finances Home Page — Overview with KPI cards.
 *
 * Server Component that calls Alegra directly (on-demand, no cache).
 * 6 parallel requests via `Promise.all`:
 *   - company       : company config (currency, locale)
 *   - mtd           : invoices this month, any status (open/closed/draft)
 *   - open          : all open invoices (data + total count for the 4th KPI)
 *   - overdue30     : open invoices past 30 days
 *   - estimatesMtd  : V2 — estimates created this month (for "Cotizado mes")
 *   - estimatesAll  : V2 — all estimates, used ONLY for `result.total` count
 *                     (metadata gives us the exact total without pagination)
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
import { getAlegraClient } from '@/lib/alegra/client'
import {
  sumInvoices,
  sumEstimates,
  filterEstimatesByDateRange,
  formatCurrency,
} from '@/lib/alegra/transformers'
import { KpiCards, KpiCardsSkeleton } from '@/components/dashboard/finances/kpi-cards'

export const metadata: Metadata = {
  title: 'Finanzas | Dashboard',
  description: 'Resumen financiero — facturas, cobros y vencidos (Alegra)',
}

// 'dynamic = force-dynamic' is inherited from app/dashboard/finances/layout.tsx.

// -----------------------------------------------------------------------------
// Data fetch (async server component inside Suspense)
// -----------------------------------------------------------------------------

async function FinancesKpis() {
  const client = getAlegraClient()
  const today = new Date()
  const monthStart = format(startOfMonth(today), 'yyyy-MM-dd')
  const thirtyDaysAgoStr = format(subDays(today, 30), 'yyyy-MM-dd')

  // All 6 calls are independent — fire them in parallel so the user only
  // pays for ONE round-trip's worth of latency, not 6.
  const [company, mtd, open, overdue, estimatesMtd, estimatesAll] = await Promise.all([
    client.getCompany(),
    client.listInvoices({
      date_after: monthStart,
      status: 'open,closed,draft',
    }),
    client.listInvoices({
      status: 'open',
    }),
    client.listInvoices({
      status: 'open',
      dueDate_before: thirtyDaysAgoStr,
    }),
    // V2 — estimates
    client.listEstimates({
      date_after: monthStart,
    }),
    client.listEstimates({}),
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
    // V2 — estimates
    // IMPORTANT: /estimates does NOT support `date_after` (only exact
    // `date`), so the API ignores it and returns the top-30 most recent
    // cotizaciones regardless of month. We MUST filter client-side with
    // filterEstimatesByDateRange, otherwise the KPI sums cotizaciones from
    // previous months and labels them as "este mes".
    //
    // Limitation after the fix: if the account has >30 cotizaciones in
    // a single month, only the 30 most recent (DESC) are summed —
    // subreports if the count exceeds 30/month. Acceptable for V2.
    // `estimatesActive` uses `result.total` from metadata, which IS the
    // exact count regardless of pagination.
    estimatesMtd: fmt(
      sumEstimates(
        filterEstimatesByDateRange(estimatesMtd.data, monthStart, null),
        'total',
      ),
    ),
    estimatesActive: estimatesAll.total,
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
          <p className="text-muted-foreground">
            Resumen de facturación — datos en vivo desde Alegra
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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
