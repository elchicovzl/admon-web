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
 * 7 parallel reads via `Promise.all`:
 *
 *   INGRESOS
 *   - company       : company config (currency, locale)
 *   - mtd           : sales invoices this month, any status
 *   - open          : all open sales invoices (data + exact count)
 *   - overdue30     : open sales invoices past 30 days
 *   - estimatesMtd  : paginated walk of this month's estimates. Backs BOTH
 *                     "Cotizado mes" (summed) and "Cotizaciones activas"
 *                     (its `metadata.total`, which is account-wide).
 *
 *   EGRESOS
 *   - billsMtd        : paginated walk of this month's purchase invoices
 *   - paymentsOutMtd  : paginated walk of this month's outgoing payments
 *
 * ⚠️ The two expense reads are two LENSES on the same money (accrual vs
 * cash), not two pools. They are never summed — see the note next to the
 * KPI assembly below.
 *
 * The three walks are 1..N upstream requests each depending on volume;
 * every other entry is exactly one.
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
  getCachedBillsInRange,
  getCachedCompany,
  getCachedEstimatesInRange,
  getCachedInvoices,
  getCachedPaymentsInRange,
} from '@/lib/alegra/cache'
import {
  sumInvoices,
  sumEstimates,
  sumBills,
  sumPayments,
  sumStandaloneExpenses,
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
  const [company, mtd, open, overdue, estimatesMtd, billsMtd, paymentsOutMtd] =
    await Promise.all([
      // --- INGRESOS ------------------------------------------------------
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
      // Estimates. Paginates until the month is fully covered instead of
      // trusting one 30-row page — see lib/alegra/date-range-walk.ts.
      //
      // This ALSO covers the "Cotizaciones activas" count: the walk reads
      // `metadata.total` off its first page, and since it sends no filters
      // that total is already account-wide. A separate request just to read
      // the same integer would be a wasted round trip.
      getCachedEstimatesInRange({ dateFrom: monthStart, dateTo: null }, ALEGRA_TTL.kpis),

      // --- EGRESOS -------------------------------------------------------
      // Two reads because there are two QUESTIONS, not because there are two
      // pools of money. See the arithmetic note below before touching either.
      getCachedBillsInRange({ dateFrom: monthStart, dateTo: null }, ALEGRA_TTL.kpis),
      getCachedPaymentsInRange(
        { dateFrom: monthStart, dateTo: null, type: 'out' },
        ALEGRA_TTL.kpis,
      ),
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
    estimatesMtd: fmt(sumEstimates(estimatesMtd.items, 'total')),
    estimatesMtdTruncated: estimatesMtd.truncated,
    estimatesActive: estimatesMtd.total,

    // -----------------------------------------------------------------------
    // EGRESOS — ⚠️ READ THIS BEFORE ADDING ANY EXPENSE ARITHMETIC HERE.
    //
    // `billedExpensesMtd` and `paidExpensesMtd` are the SAME MONEY seen at two
    // moments. A purchase invoice is the obligation; a payment against it is
    // that obligation being settled. Alegra's own docs call this out as a
    // double-counting hazard.
    //
    //     ❌ total de gastos = billed + paid          ← counts twice
    //     ✅ total sin duplicar = billed + standalone  ← if you ever need one
    //
    // We deliberately do NOT compute a combined "total expenses" figure. Two
    // labelled numbers that the operator can reason about beat one blended
    // number whose definition nobody remembers in three months.
    //
    // `standaloneExpensesMtd` is the only cash-side amount with no accrual
    // counterpart: outgoing payments with no bill behind them. Note that
    // `classifyPaymentAssociation` returns 'unknown' — and is therefore
    // EXCLUDED from this sum — when `associations` is missing from the
    // response, which is why the client forces `fields=associations`.
    // -----------------------------------------------------------------------
    billedExpensesMtd: fmt(sumBills(billsMtd.items, 'total')),
    paidExpensesMtd: fmt(sumPayments(paymentsOutMtd.items)),
    standaloneExpensesMtd: fmt(sumStandaloneExpenses(paymentsOutMtd.items)),
    expensesTruncated: billsMtd.truncated || paymentsOutMtd.truncated,

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
