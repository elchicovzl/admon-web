/**
 * KPI cards for the Finances home page.
 *
 * Server Component (pure display, no interactivity in V1).
 *
 * Shows 6 cards (V1: 4 invoices + V2: 2 estimates):
 *   - Facturado mes actual:      sum of total of invoices this month
 *   - Por cobrar (abiertas):     sum of balance of all open invoices
 *   - Vencido >30 días:          sum of balance of open invoices past 30 days
 *   - Facturas abiertas:         count of open invoices
 *   - Cotizado mes actual (V2):  sum of total of estimates created this month
 *   - Cotizaciones activas (V2): total count of all estimates in the account
 *
 * All values are pre-formatted by the parent (page.tsx) using
 * `formatCurrency()` from lib/alegra/transformers.
 *
 * Grid: 1 col mobile → 2 cols md → 3 cols lg (so 6 cards = 2 rows of 3).
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Banknote,
  Clock,
  AlertTriangle,
  FileText,
  ScrollText,
  Layers,
  ReceiptText,
  Wallet,
  HelpCircle,
  type LucideIcon,
} from 'lucide-react'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface FinancesKpis {
  // -- INGRESOS ---------------------------------------------------------
  // V1 — invoices
  mtdBilled: string
  openReceivables: string
  overdue30: string
  openCount: number
  // V2 — estimates
  estimatesMtd: string
  /**
   * True when the estimates walk hit its page cap before covering the month,
   * i.e. `estimatesMtd` is a FLOOR rather than the real total.
   *
   * Surfaced in the UI on purpose: the bug this replaced was a silently short
   * sum presented as the month's total, and an operator has no way to catch
   * that by looking at it.
   */
  estimatesMtdTruncated?: boolean
  estimatesActive: number

  // -- EGRESOS ----------------------------------------------------------
  //
  // ⚠️ `billedExpensesMtd` and `paidExpensesMtd` MUST NOT be added together.
  //
  // They are the same money seen through two lenses:
  //   billedExpensesMtd → accrual. What providers invoiced us this month.
  //   paidExpensesMtd   → cash.    What actually left the account this month.
  //
  // A payment settling a purchase invoice appears in BOTH. Summing them
  // double-counts every expense that was invoiced and paid in the same
  // period. The two cards are labelled "(facturado)" and "(caja)" precisely
  // so nobody reads them as two separate pools.
  //
  // `standaloneExpensesMtd` is the ONE figure that exists only on the cash
  // side: outgoing payments with no bill behind them.
  billedExpensesMtd: string
  paidExpensesMtd: string
  standaloneExpensesMtd: string
  /** Set when either expense walk hit its page cap — figures are floors. */
  expensesTruncated?: boolean

  currencyCode: string
}

// -----------------------------------------------------------------------------
// Display component
// -----------------------------------------------------------------------------

interface KpiItem {
  label: string
  value: string
  description: string
  icon: LucideIcon
  accent: string
  accentBg: string
  /** Renders the value as a lower bound instead of an exact figure. */
  warn?: boolean
}

export function KpiCards({ kpis }: { kpis: FinancesKpis }) {
  // Every income label now says VENTA explicitly. "Facturado mes actual" read
  // as either direction depending on who was looking at it — which is the
  // ambiguity this whole split exists to remove.
  const incomeItems: KpiItem[] = [
    {
      label: 'Ventas del mes',
      value: kpis.mtdBilled,
      description: 'Facturas de venta emitidas este mes',
      icon: Banknote,
      accent: 'text-emerald-600',
      accentBg: 'bg-emerald-50 dark:bg-emerald-950',
    },
    {
      label: 'Por cobrar',
      value: kpis.openReceivables,
      description: `${kpis.openCount} factura${kpis.openCount === 1 ? '' : 's'} de venta abierta${kpis.openCount === 1 ? '' : 's'}`,
      icon: Clock,
      accent: 'text-sky-600',
      accentBg: 'bg-sky-50 dark:bg-sky-950',
    },
    {
      label: 'Por cobrar vencido > 30 días',
      value: kpis.overdue30,
      description: 'Ventas abiertas con más de 30 días de mora',
      icon: AlertTriangle,
      accent: 'text-rose-600',
      accentBg: 'bg-rose-50 dark:bg-rose-950',
    },
    {
      label: 'Facturas de venta abiertas',
      value: kpis.openCount.toLocaleString('es-CO'),
      description: `Total en estado abierto (${kpis.currencyCode})`,
      icon: FileText,
      accent: 'text-violet-600',
      accentBg: 'bg-violet-50 dark:bg-violet-950',
    },
    // V2 — estimates. Both figures are now exact in the normal case:
    // estimatesActive comes from the metadata envelope, and estimatesMtd is
    // summed over a full paginated walk of the month. The only inexact case
    // is an account busy enough to hit the page cap — and that one announces
    // itself rather than rounding down in silence.
    {
      label: 'Cotizado mes actual',
      value: kpis.estimatesMtd,
      description: kpis.estimatesMtdTruncated
        ? 'Mínimo — hay más cotizaciones este mes de las que se pudieron sumar'
        : 'Cotizaciones creadas este mes',
      icon: ScrollText,
      accent: 'text-teal-600',
      accentBg: 'bg-teal-50 dark:bg-teal-950',
      warn: kpis.estimatesMtdTruncated ?? false,
    },
    {
      label: 'Cotizaciones activas',
      value: kpis.estimatesActive.toLocaleString('es-CO'),
      description: `Total registradas en Alegra`,
      icon: Layers,
      accent: 'text-indigo-600',
      accentBg: 'bg-indigo-50 dark:bg-indigo-950',
    },
  ]

  // ---------------------------------------------------------------------------
  // EGRESOS
  //
  // Two cards, two lenses, never a sum. The "(facturado)" / "(caja)" suffixes
  // are not stylistic — they are what stops an operator from mentally adding
  // the two and doubling the month's expenses.
  // ---------------------------------------------------------------------------
  const expenseItems: KpiItem[] = [
    {
      label: 'Gastos del mes (facturado)',
      value: kpis.billedExpensesMtd,
      description: kpis.expensesTruncated
        ? 'Mínimo — hay más facturas de compra de las que se pudieron sumar'
        : 'Facturas de compra recibidas este mes',
      icon: ReceiptText,
      accent: 'text-orange-600',
      accentBg: 'bg-orange-50 dark:bg-orange-950',
      warn: kpis.expensesTruncated ?? false,
    },
    {
      label: 'Pagos del mes (caja)',
      value: kpis.paidExpensesMtd,
      description: kpis.expensesTruncated
        ? 'Mínimo — no sumar con «Gastos del mes»: es la misma plata'
        : 'Plata que salió este mes — no sumar con «Gastos del mes»',
      icon: Wallet,
      accent: 'text-amber-600',
      accentBg: 'bg-amber-50 dark:bg-amber-950',
      warn: kpis.expensesTruncated ?? false,
    },
    {
      label: 'Gastos sin factura',
      value: kpis.standaloneExpensesMtd,
      description: 'Pagos del mes que no tienen factura de compra detrás',
      icon: HelpCircle,
      accent: 'text-slate-600',
      accentBg: 'bg-slate-100 dark:bg-slate-900',
    },
  ]

  return (
    <div className="space-y-8">
      <KpiSection title="Ingresos" items={incomeItems} />
      <KpiSection title="Egresos" items={expenseItems} />
    </div>
  )
}

// -----------------------------------------------------------------------------
// Section
// -----------------------------------------------------------------------------

function KpiSection({ title, items }: { title: string; items: KpiItem[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map(({ label, value, description, icon: Icon, accent, accentBg, warn }) => (
        <Card key={label}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {label}
            </CardTitle>
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${accentBg}`}>
              <Icon className={`h-5 w-5 ${accent}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-1.5">
              {/* The "≥" is the honest part: it tells the operator at a glance
                  that the real figure is higher, without them having to read
                  the description or know about Alegra's pagination limits. */}
              {warn && (
                <span
                  className="text-2xl font-bold tracking-tight text-amber-600"
                  aria-label="al menos"
                >
                  ≥
                </span>
              )}
              <span className="text-2xl font-bold tracking-tight">{value}</span>
            </div>
            <CardDescription
              className={`mt-1 ${warn ? 'text-amber-600 dark:text-amber-500' : ''}`}
            >
              {description}
            </CardDescription>
          </CardContent>
        </Card>
        ))}
      </div>
    </section>
  )
}

// -----------------------------------------------------------------------------
// Loading skeleton (used as Suspense fallback)
// -----------------------------------------------------------------------------

export function KpiCardsSkeleton() {
  // Mirrors the real 6 + 3 split across two sections so the streaming swap
  // doesn't reflow the page.
  return (
    <div className="space-y-8">
      <SkeletonSection count={6} />
      <SkeletonSection count={3} />
    </div>
  )
}

function SkeletonSection({ count }: { count: number }) {
  return (
    <section className="space-y-3">
      <Skeleton className="h-3 w-20" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-10 rounded-xl" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-7 w-32" />
              <Skeleton className="mt-2 h-3 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
