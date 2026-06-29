/**
 * Totals card on the estimate detail page.
 *
 * V1 shows only what Alegra provides directly for estimates:
 *   - Total (from Alegra — authoritative)
 *
 * Estimates don't have balance/totalPaid/retentions — those are invoice-only
 * concepts. We don't compute a subtotal/tax breakdown from items in V1
 * (same rationale as the invoice totals card).
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Wallet } from 'lucide-react'
import { formatCurrency } from '@/lib/alegra/transformers'
import type { EstimateDetail } from '@/lib/alegra/types'

interface EstimateTotalsCardProps {
  estimate: EstimateDetail
  currencyCode: string
}

export function EstimateTotalsCard({ estimate, currencyCode }: EstimateTotalsCardProps) {
  const fmt = (n: number) => formatCurrency(n, currencyCode)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="h-4 w-4 text-muted-foreground" />
          Total
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline justify-between rounded-md bg-sky-50 px-3 py-2 dark:bg-sky-950/40">
          <span className="text-sm font-medium">Total cotizado</span>
          <span className="font-mono text-lg font-bold tabular-nums text-sky-700 dark:text-sky-300">
            {fmt(estimate.total)}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}