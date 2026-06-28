/**
 * Totals card on the invoice detail page.
 *
 * V1 shows only what Alegra provides directly:
 *   - Retentions (list, if present)
 *   - Total (from Alegra — authoritative)
 *   - Pagado (totalPaid)
 *   - Saldo (balance, highlighted in rose when > 0)
 *
 * We do NOT compute subtotal/tax breakdown from items in V1 — we'd risk
 * silently disagreeing with Alegra's rounding rules. V2 can add a proper
 * breakdown once we know exactly how Alegra calculates items × tax.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Wallet } from 'lucide-react'
import { formatCurrency } from '@/lib/alegra/transformers'
import type { InvoiceDetail } from '@/lib/alegra/types'

interface TotalsCardProps {
  invoice: InvoiceDetail
  currencyCode: string
}

export function TotalsCard({ invoice, currencyCode }: TotalsCardProps) {
  const fmt = (n: number) => formatCurrency(n, currencyCode)
  const retentions = invoice.retentions ?? []
  const hasBalance = invoice.balance > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="h-4 w-4 text-muted-foreground" />
          Totales
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Retentions — only if any */}
        {retentions.length > 0 && (
          <div className="space-y-1 rounded-md bg-muted/40 px-3 py-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Retenciones
            </p>
            {retentions.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <span>
                  {r.name}
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({r.percentage}%)
                  </span>
                </span>
                <span className="font-mono">−{fmt(r.amount)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Total — big, bold */}
        <Row label="Total" value={fmt(invoice.total)} emphasis />

        {/* Paid */}
        <Row label="Pagado" value={fmt(invoice.totalPaid)} />

        {/* Balance — highlighted when > 0 */}
        <div
          className={`flex items-baseline justify-between rounded-md px-3 py-2 ${
            hasBalance
              ? 'bg-rose-50 dark:bg-rose-950/40'
              : 'bg-emerald-50 dark:bg-emerald-950/40'
          }`}
        >
          <span className="text-sm font-medium">Saldo</span>
          <span
            className={`font-mono text-lg font-bold tabular-nums ${
              hasBalance ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'
            }`}
          >
            {fmt(invoice.balance)}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

function Row({
  label,
  value,
  emphasis,
}: {
  label: string
  value: string
  emphasis?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between px-3 py-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={`font-mono tabular-nums ${
          emphasis ? 'text-lg font-bold' : 'font-medium'
        }`}
      >
        {value}
      </span>
    </div>
  )
}
