/**
 * Purchase invoices (facturas de compra) list table — Server Component.
 *
 * Mirrors `invoice-table.tsx` in structure, but the semantics are inverted:
 * this is money we OWE, not money owed to us. Two deliberate differences:
 *
 *   - The counterparty column says "Proveedor", not "Cliente".
 *   - The balance column is styled as a liability. On a sales invoice an
 *     outstanding balance is an asset waiting to be collected; here it is a
 *     debt waiting to be paid. Same number, opposite meaning.
 */

import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from '@/components/ui/pagination'
import { ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react'
import type { BillListItem } from '@/lib/alegra/types'
import {
  formatBillNumber,
  formatCurrency,
  getBillStatusBadgeClass,
  getBillStatusLabel,
  parseAlegraDate,
} from '@/lib/alegra/transformers'

interface BillTableProps {
  bills: BillListItem[]
  total: number
  page: number
  perPage: number
  currencyCode: string
  prevSearch: string | null
  nextSearch: string | null
}

export function BillTable({
  bills,
  total,
  page,
  perPage,
  currencyCode,
  prevSearch,
  nextSearch,
}: BillTableProps) {
  const from = (page - 1) * perPage + 1
  const to = Math.min(page * perPage, total)

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-3 font-medium text-muted-foreground">#</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Fecha</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Vencimiento</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Proveedor</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Por pagar</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Estado</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((bill) => (
                <BillRow key={bill.id} bill={bill} currencyCode={currencyCode} />
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {total === 0
              ? 'Sin resultados'
              : `Mostrando ${from}–${to} de ${total.toLocaleString('es-CO')}`}
          </p>

          {(prevSearch !== null || nextSearch !== null) && (
            <Pagination className="mx-0 w-auto">
              <PaginationContent>
                <PaginationItem>
                  {prevSearch !== null ? (
                    <Button asChild variant="ghost" size="sm" className="gap-1">
                      <Link href={`/dashboard/finances/bills${prevSearch}`} scroll={false}>
                        <ChevronLeft className="h-4 w-4" />
                        <span>Anterior</span>
                      </Link>
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" disabled className="gap-1">
                      <ChevronLeft className="h-4 w-4" />
                      <span>Anterior</span>
                    </Button>
                  )}
                </PaginationItem>
                <PaginationItem>
                  <span className="px-3 text-sm text-muted-foreground">Página {page}</span>
                </PaginationItem>
                <PaginationItem>
                  {nextSearch !== null ? (
                    <Button asChild variant="ghost" size="sm" className="gap-1">
                      <Link href={`/dashboard/finances/bills${nextSearch}`} scroll={false}>
                        <span>Siguiente</span>
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" disabled className="gap-1">
                      <span>Siguiente</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  )}
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Row
// -----------------------------------------------------------------------------

function BillRow({ bill, currencyCode }: { bill: BillListItem; currencyCode: string }) {
  const number = formatBillNumber(bill)

  // An overdue PURCHASE invoice means we're late paying someone — worth
  // flagging just as loudly as an overdue sale, for the opposite reason.
  const due = parseAlegraDate(bill.dueDate)
  const isOverdue =
    bill.status === 'open' && due !== null && due.getTime() < new Date().setHours(0, 0, 0, 0)

  const dateFmt = (s: string | null | undefined) => {
    const d = parseAlegraDate(s)
    return d ? format(d, 'dd MMM yyyy', { locale: es }) : '—'
  }

  return (
    <tr className="border-b last:border-0 hover:bg-muted/30">
      <td className="px-4 py-3">
        <Link
          href={`/dashboard/finances/bills/${encodeURIComponent(bill.id)}`}
          className="font-mono text-sm font-medium text-primary hover:underline"
        >
          {number}
        </Link>
      </td>
      <td className="px-4 py-3 text-muted-foreground">{dateFmt(bill.date)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          {isOverdue && (
            <AlertTriangle className="h-3.5 w-3.5 text-rose-600" aria-label="Vencida sin pagar" />
          )}
          <span className={isOverdue ? 'text-rose-700 dark:text-rose-400' : 'text-muted-foreground'}>
            {dateFmt(bill.dueDate)}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <span className="font-medium">{bill.provider?.name ?? '—'}</span>
          {bill.provider?.identification && (
            <span className="text-xs text-muted-foreground">{bill.provider.identification}</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-right font-medium tabular-nums">
        {formatCurrency(bill.total, currencyCode)}
      </td>
      <td
        className={`px-4 py-3 text-right tabular-nums ${
          bill.balance > 0 ? 'font-semibold text-orange-600' : 'text-muted-foreground'
        }`}
      >
        {formatCurrency(bill.balance, currencyCode)}
      </td>
      <td className="px-4 py-3">
        <Badge variant="outline" className={getBillStatusBadgeClass(bill.status)}>
          {getBillStatusLabel(bill.status)}
        </Badge>
      </td>
    </tr>
  )
}
