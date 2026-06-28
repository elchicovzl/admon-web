/**
 * Payments section on the invoice detail page.
 * Shows a list of `payments[]` and a progress bar (paid vs total).
 *
 * If no payments yet, shows a friendly "Sin pagos registrados" message.
 */

import { Banknote, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, parseAlegraDate } from '@/lib/alegra/transformers'
import { format, isValid } from 'date-fns'
import { es } from 'date-fns/locale'
import type { InvoicePayment } from '@/lib/alegra/types'

interface PaymentsCardProps {
  payments: InvoicePayment[]
  total: number
  totalPaid: number
  currencyCode: string
}

export function PaymentsCard({
  payments,
  total,
  totalPaid,
  currencyCode,
}: PaymentsCardProps) {
  const fmt = (n: number) => formatCurrency(n, currencyCode)
  const progressPct = total > 0 ? Math.min(100, Math.round((totalPaid / total) * 100)) : 0
  const isFullyPaid = total > 0 && totalPaid >= total

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Banknote className="h-4 w-4 text-muted-foreground" />
          Pagos
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            {payments.length} {payments.length === 1 ? 'pago' : 'pagos'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div>
          <div className="mb-1.5 flex items-baseline justify-between text-sm">
            <span className="font-medium">
              {fmt(totalPaid)}{' '}
              <span className="text-muted-foreground">de {fmt(total)}</span>
            </span>
            <span
              className={
                isFullyPaid
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-muted-foreground'
              }
            >
              {progressPct}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full transition-all ${
                isFullyPaid ? 'bg-emerald-500' : 'bg-sky-500'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Payments list */}
        {payments.length === 0 ? (
          <p className="rounded-md bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
            Sin pagos registrados aún.
          </p>
        ) : (
          <ul className="divide-y">
            {payments.map((p) => {
              const dateObj = parseAlegraDate(p.date)
              return (
                <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-muted-foreground">
                      {dateObj && isValid(dateObj)
                        ? format(dateObj, "dd MMM yyyy", { locale: es })
                        : p.date}
                    </span>
                    {p.paymentMethod && (
                      <span className="text-xs text-muted-foreground">
                        ({p.paymentMethod})
                      </span>
                    )}
                  </div>
                  <span className="font-mono font-semibold tabular-nums">
                    {fmt(p.amount)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
