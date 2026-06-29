/**
 * Retentions section on the invoice detail page.
 * Only renders if the invoice has at least one retention.
 *
 * (The TotalsCard already shows the retentions list compactly; this section
 * gives them more visual weight when there are many of them.)
 */

import { Receipt } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/alegra/transformers'
import type { InvoiceRetention } from '@/lib/alegra/types'

interface RetentionsCardProps {
  retentions: InvoiceRetention[]
  currencyCode: string
}

export function RetentionsCard({ retentions, currencyCode }: RetentionsCardProps) {
  if (retentions.length === 0) return null

  const fmt = (n: number) => formatCurrency(n, currencyCode)
  const total = retentions.reduce((acc, r) => acc + r.amount, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Receipt className="h-4 w-4 text-muted-foreground" />
          Retenciones
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            Total: {fmt(total)}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="border-y bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-2 font-medium text-muted-foreground">Tipo</th>
              <th className="px-4 py-2 text-right font-medium text-muted-foreground">%</th>
              <th className="px-4 py-2 text-right font-medium text-muted-foreground">Monto</th>
            </tr>
          </thead>
          <tbody>
            {retentions.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="px-4 py-2.5">{r.name}</td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                  {r.percentage}%
                </td>
                <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums">
                  {fmt(r.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
