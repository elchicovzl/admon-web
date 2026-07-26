/**
 * Totals card on the purchase invoice detail page.
 *
 * Shows only what Alegra provides directly (total / totalPaid / balance) —
 * no locally computed subtotal or tax breakdown, for the same reason as the
 * sales side: recomputing risks silently disagreeing with Alegra's rounding.
 *
 * The label wording is the point of this component existing separately from
 * the invoice one. "Saldo" on a sale is money we expect to RECEIVE; here it
 * is money we still have to PAY. Reusing the sales card would put an asset
 * label on a liability.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Wallet } from 'lucide-react'
import { formatCurrency } from '@/lib/alegra/transformers'
import type { BillDetail } from '@/lib/alegra/types'

interface BillTotalsCardProps {
  bill: BillDetail
  currencyCode: string
}

export function BillTotalsCard({ bill, currencyCode }: BillTotalsCardProps) {
  const fmt = (n: number) => formatCurrency(n, currencyCode)
  const owes = bill.balance > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="h-4 w-4 text-muted-foreground" />
          Totales
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between border-t pt-2">
          <span className="text-sm text-muted-foreground">Total facturado</span>
          <span className="text-lg font-bold tabular-nums">{fmt(bill.total)}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Pagado</span>
          <span className="tabular-nums text-emerald-600">{fmt(bill.totalPaid)}</span>
        </div>

        <div className="flex items-center justify-between border-t pt-2">
          <span className="text-sm font-medium">Por pagar</span>
          <span
            className={`text-lg font-bold tabular-nums ${
              owes ? 'text-orange-600' : 'text-muted-foreground'
            }`}
          >
            {fmt(bill.balance)}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
