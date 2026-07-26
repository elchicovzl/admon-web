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
  type LucideIcon,
} from 'lucide-react'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface FinancesKpis {
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
  const items: KpiItem[] = [
    {
      label: 'Facturado mes actual',
      value: kpis.mtdBilled,
      description: 'Facturas emitidas este mes',
      icon: Banknote,
      accent: 'text-emerald-600',
      accentBg: 'bg-emerald-50 dark:bg-emerald-950',
    },
    {
      label: 'Por cobrar',
      value: kpis.openReceivables,
      description: `${kpis.openCount} factura${kpis.openCount === 1 ? '' : 's'} abierta${kpis.openCount === 1 ? '' : 's'}`,
      icon: Clock,
      accent: 'text-sky-600',
      accentBg: 'bg-sky-50 dark:bg-sky-950',
    },
    {
      label: 'Vencido > 30 días',
      value: kpis.overdue30,
      description: 'Facturas abiertas con más de 30 días de mora',
      icon: AlertTriangle,
      accent: 'text-rose-600',
      accentBg: 'bg-rose-50 dark:bg-rose-950',
    },
    {
      label: 'Facturas abiertas',
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

  return (
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
  )
}

// -----------------------------------------------------------------------------
// Loading skeleton (used as Suspense fallback)
// -----------------------------------------------------------------------------

export function KpiCardsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
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
  )
}
