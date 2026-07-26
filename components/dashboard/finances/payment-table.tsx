/**
 * Payments list table — Server Component.
 *
 * The column that matters most here is "Concepto": what the payment settles.
 * A payment against a bill is money already counted in /bills; a payment with
 * no document behind it is an expense that exists nowhere else. Surfacing
 * that distinction in the table is what stops someone from eyeballing this
 * list, adding it to the purchase-invoice total, and double counting.
 *
 * Amount colour follows direction: `in` is money arriving, `out` is money
 * leaving. Never neutral — the sign is the whole point of the row.
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
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { PaymentListItem } from '@/lib/alegra/types'
import {
  classifyPaymentAssociation,
  describePaymentAssociation,
  formatCurrency,
  getPaymentTypeBadgeClass,
  getPaymentTypeLabel,
  parseAlegraDate,
} from '@/lib/alegra/transformers'

interface PaymentTableProps {
  payments: PaymentListItem[]
  total: number
  page: number
  perPage: number
  currencyCode: string
  prevSearch: string | null
  nextSearch: string | null
}

export function PaymentTable({
  payments,
  total,
  page,
  perPage,
  currencyCode,
  prevSearch,
  nextSearch,
}: PaymentTableProps) {
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
                <th className="px-4 py-3 font-medium text-muted-foreground">Tipo</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Contraparte</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Concepto</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Método</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Monto</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <PaymentRow key={p.id} payment={p} currencyCode={currencyCode} />
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
                      <Link href={`/dashboard/finances/payments${prevSearch}`} scroll={false}>
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
                      <Link href={`/dashboard/finances/payments${nextSearch}`} scroll={false}>
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

function PaymentRow({
  payment,
  currencyCode,
}: {
  payment: PaymentListItem
  currencyCode: string
}) {
  const d = parseAlegraDate(payment.date)
  const dateStr = d ? format(d, 'dd MMM yyyy', { locale: es }) : '—'

  const kind = classifyPaymentAssociation(payment)
  const isIncoming = payment.type === 'in'

  return (
    <tr className="border-b last:border-0 hover:bg-muted/30">
      <td className="px-4 py-3 font-mono text-sm text-muted-foreground">
        {payment.number ?? '—'}
      </td>
      <td className="px-4 py-3 text-muted-foreground">{dateStr}</td>
      <td className="px-4 py-3">
        <Badge variant="outline" className={getPaymentTypeBadgeClass(payment.type)}>
          {getPaymentTypeLabel(payment.type)}
        </Badge>
      </td>
      <td className="px-4 py-3">
        <span className="font-medium">{payment.client?.name ?? '—'}</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <span className="text-muted-foreground">{describePaymentAssociation(payment)}</span>
          {/* A standalone outgoing payment is the one expense that appears in
              NO purchase invoice. Worth calling out so it isn't mistaken for
              a duplicate of something already in /bills. */}
          {kind === 'standalone' && payment.type === 'out' && (
            <span className="text-xs text-amber-600 dark:text-amber-500">
              Gasto sin factura
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-muted-foreground">{payment.paymentMethod ?? '—'}</td>
      <td
        className={`px-4 py-3 text-right font-semibold tabular-nums ${
          isIncoming ? 'text-emerald-600' : 'text-orange-600'
        }`}
      >
        {isIncoming ? '+' : '−'}
        {formatCurrency(payment.amount, currencyCode)}
      </td>
    </tr>
  )
}
