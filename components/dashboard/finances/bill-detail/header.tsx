/**
 * Header for the purchase invoice detail page.
 *
 * Shows the bill number, status badge, dates, and an overdue warning. The
 * warning wording is inverted vs the sales side: an overdue purchase invoice
 * means WE are late paying someone, which is a reputational and
 * cash-discipline problem rather than a collections one.
 */

import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Calendar } from 'lucide-react'
import type { BillDetail } from '@/lib/alegra/types'
import {
  formatBillNumber,
  getBillStatusBadgeClass,
  getBillStatusLabel,
  parseAlegraDate,
} from '@/lib/alegra/transformers'

export function BillDetailHeader({ bill }: { bill: BillDetail }) {
  const due = parseAlegraDate(bill.dueDate)
  const isOverdue =
    bill.status === 'open' && due !== null && due.getTime() < new Date().setHours(0, 0, 0, 0)

  const dateFmt = (s: string | null | undefined) => {
    const d = parseAlegraDate(s)
    return d ? format(d, "d 'de' MMMM yyyy", { locale: es }) : '—'
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight">
          Factura de compra{' '}
          <span className="font-mono text-2xl text-muted-foreground">
            {formatBillNumber(bill)}
          </span>
        </h1>
        <Badge variant="outline" className={getBillStatusBadgeClass(bill.status)}>
          {getBillStatusLabel(bill.status)}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          Emitida el {dateFmt(bill.date)}
        </span>
        {bill.dueDate && (
          <span
            className={`flex items-center gap-1.5 ${
              isOverdue ? 'font-medium text-rose-600 dark:text-rose-400' : ''
            }`}
          >
            {isOverdue && <AlertTriangle className="h-3.5 w-3.5" />}
            Vence el {dateFmt(bill.dueDate)}
            {isOverdue && ' — vencida sin pagar'}
          </span>
        )}
      </div>

      {bill.observations && (
        <p className="text-sm text-muted-foreground">{bill.observations}</p>
      )}
    </div>
  )
}
