/**
 * Finances Home Page — Overview with KPI cards.
 *
 * Server Component that calls Alegra directly (on-demand, no cache).
 * 3 parallel requests via `Promise.all`:
 *   - mtd       : invoices this month, any status (open/closed/draft)
 *   - open      : all open invoices  (data + total count for the 4th KPI)
 *   - overdue30 : open invoices past 30 days
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
import { sumInvoices, formatCurrency } from '@/lib/alegra/transformers'
import { KpiCards, KpiCardsSkeleton } from '@/components/dashboard/finances/kpi-cards'

export const metadata: Metadata = {
  title: 'Finanzas | Dashboard',
  description: 'Resumen financiero — facturas, cobros y vencidos (Alegra)',
}

// The page depends on external API state (Alegra) and is read-only-on-demand;
// skip build-time prerendering — render per request so the env-var check in the
// AlegraClient constructor runs only when the user actually opens the page.
export const dynamic = 'force-dynamic'

// -----------------------------------------------------------------------------
// Data fetch (async server component inside Suspense)
// -----------------------------------------------------------------------------

async function FinancesKpis() {
  const client = getAlegraClient()
  const today = new Date()
  const monthStart = format(startOfMonth(today), 'yyyy-MM-dd')
  const todayStr = format(today, 'yyyy-MM-dd')
  const thirtyDaysAgoStr = format(subDays(today, 30), 'yyyy-MM-dd')

  // All 4 calls are independent — fire them in parallel so the user only
  // pays for ONE round-trip's worth of latency, not 4.
  const [company, mtd, open, overdue] = await Promise.all([
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
  ])

  const fmt = (amount: number) => formatCurrency(amount, company.currency.code)

  const kpis = {
    mtdBilled: fmt(sumInvoices(mtd.data, 'total')),
    openReceivables: fmt(sumInvoices(open.data, 'balance')),
    overdue30: fmt(sumInvoices(overdue.data, 'balance')),
    // After the InvoiceListResponseSchema transform, the count is at .total
    // (top level), NOT .metadata.total — the metadata object is stripped
    // during normalization. Originally I wrote .metadata.total which would
    // also work on the raw Alegra response but breaks the contract.
    openCount: open.total,
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
        <Button asChild>
          <Link href="/dashboard/finances/invoices">
            Ver todas las facturas
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      {/* KPI cards — streamed in via Suspense */}
      <Suspense fallback={<KpiCardsSkeleton />}>
        <FinancesKpis />
      </Suspense>

      {/* Future: aquí irían los gráficos de tendencia (V2) */}
    </div>
  )
}
