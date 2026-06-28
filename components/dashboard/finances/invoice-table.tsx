/**
 * Invoices list table — Server Component.
 *
 * Pure display: renders the already-fetched invoices with formatting + status
 * badges. The invoice number column is a `<Link>` to the detail page.
 *
 * Pagination is rendered below via the project's `Pagination` UI primitive
 * (Anterior / Siguiente). `prev` / `next` are absolute URLs relative to the
 * invoices route, preserving all filters.
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
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react'
import type { InvoiceListItem } from '@/lib/alegra/types'
import {
  formatCurrency,
  formatInvoiceNumber,
  getInvoiceStatusBadgeClass,
  getInvoiceStatusLabel,
  daysOverdue,
} from '@/lib/alegra/transformers'

interface InvoiceTableProps {
  invoices: InvoiceListItem[]
  total: number
  page: number
  perPage: number
  currencyCode: string
  prevSearch: string | null
  nextSearch: string | null
}

export function InvoiceTable({
  invoices,
  total,
  page,
  perPage,
  currencyCode,
  prevSearch,
  nextSearch,
}: InvoiceTableProps) {
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
                <th className="px-4 py-3 font-medium text-muted-foreground">Cliente</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Saldo</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Estado</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <InvoiceRow key={inv.id} invoice={inv} currencyCode={currencyCode} />
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer: row count + pagination */}
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
                      <Link href={`/dashboard/finances/invoices${prevSearch}`} scroll={false}>
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
                  <span className="px-3 text-sm text-muted-foreground">
                    Página {page}
                  </span>
                </PaginationItem>
                <PaginationItem>
                  {nextSearch !== null ? (
                    <Button asChild variant="ghost" size="sm" className="gap-1">
                      <Link href={`/dashboard/finances/invoices${nextSearch}`} scroll={false}>
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
// Row (split out for readability)
// -----------------------------------------------------------------------------

function InvoiceRow({
  invoice,
  currencyCode,
}: {
  invoice: InvoiceListItem
  currencyCode: string
}) {
  const number = formatInvoiceNumber(invoice.numberTemplate)
  const overdue = daysOverdue(invoice)
  const isOverdue = overdue !== null && overdue > 0

  const dateFmt = (s: string | null) => {
    const d = s ? new Date(s + 'T00:00:00') : null
    return d && !isNaN(d.getTime()) ? format(d, 'dd MMM yyyy', { locale: es }) : '—'
  }

  return (
    <tr className="border-b last:border-0 hover:bg-muted/30">
      <td className="px-4 py-3">
        <Link
          href={`/dashboard/finances/invoices/${encodeURIComponent(invoice.id)}`}
          className="font-mono text-sm font-medium text-primary hover:underline"
        >
          {number}
        </Link>
      </td>
      <td className="px-4 py-3 text-muted-foreground">{dateFmt(invoice.date)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          {isOverdue && (
            <AlertTriangle className="h-3.5 w-3.5 text-rose-600" aria-label="Factura vencida" />
          )}
          <span className={isOverdue ? 'text-rose-700 dark:text-rose-400' : 'text-muted-foreground'}>
            {dateFmt(invoice.dueDate)}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <span className="font-medium">{invoice.client.name}</span>
          {invoice.client.identification && (
            <span className="text-xs text-muted-foreground">
              {invoice.client.identification}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-right font-medium tabular-nums">
        {formatCurrency(invoice.total, currencyCode)}
      </td>
      <td className={`px-4 py-3 text-right tabular-nums ${invoice.balance > 0 ? 'font-semibold text-rose-600' : 'text-muted-foreground'}`}>
        {formatCurrency(invoice.balance, currencyCode)}
      </td>
      <td className="px-4 py-3">
        <Badge variant="outline" className={getInvoiceStatusBadgeClass(invoice.status)}>
          {getInvoiceStatusLabel(invoice.status)}
        </Badge>
      </td>
    </tr>
  )
}
