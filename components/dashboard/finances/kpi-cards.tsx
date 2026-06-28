/**
 * KPI cards for the Finances home page.
 *
 * Server Component (pure display, no interactivity in V1).
 *
 * Shows 4 cards:
 *   - Facturado mes actual: sum of total of invoices this month
 *   - Por cobrar (abiertas): sum of balance of all open invoices
 *   - Vencido >30 días:     sum of balance of open invoices past 30 days
 *   - Facturas abiertas:    count of open invoices
 *
 * All values are pre-formatted by the parent (page.tsx) using
 * `formatCurrency()` from lib/alegra/transformers.
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
} from 'lucide-react'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface FinancesKpis {
  mtdBilled: string
  openReceivables: string
  overdue30: string
  openCount: number
  currencyCode: string
}

// -----------------------------------------------------------------------------
// Display component
// -----------------------------------------------------------------------------

export function KpiCards({ kpis }: { kpis: FinancesKpis }) {
  const items = [
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
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {items.map(({ label, value, description, icon: Icon, accent, accentBg }) => (
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
            <div className="text-2xl font-bold tracking-tight">{value}</div>
            <CardDescription className="mt-1">{description}</CardDescription>
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
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
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
