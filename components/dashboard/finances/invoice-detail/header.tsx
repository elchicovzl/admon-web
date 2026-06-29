/**
 * Invoice detail header.
 *
 * Renders the invoice number, dates, and status badge.
 *
 * NOTE: the "Volver al listado" back link is rendered by the parent page
 * (app/dashboard/finances/invoices/[id]/page.tsx) OUTSIDE the Suspense
 * boundary, so it appears immediately even before the invoice data loads.
 * Do not add a duplicate back link here — that would render two of them.
 */

import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { FileText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { InvoiceListItem, NumberTemplate } from '@/lib/alegra/types'
import {
  formatInvoiceNumber,
  getInvoiceStatusBadgeClass,
  getInvoiceStatusLabel,
} from '@/lib/alegra/transformers'

interface DetailHeaderProps {
  invoice: InvoiceListItem
}

const DATE_FORMAT = "dd 'de' MMMM 'de' yyyy"

function formatDate(s: string | null): string {
  if (!s) return '—'
  try {
    return format(parseISO(s), DATE_FORMAT, { locale: es })
  } catch {
    return s
  }
}

export function DetailHeader({ invoice }: DetailHeaderProps) {
  const number = formatInvoiceNumber(invoice.numberTemplate as NumberTemplate | null)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <Badge variant="outline" className={getInvoiceStatusBadgeClass(invoice.status)}>
          {getInvoiceStatusLabel(invoice.status)}
        </Badge>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6 text-muted-foreground" />
          <h1 className="font-mono text-3xl font-bold tracking-tight">{number}</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          <span>Emitida el {formatDate(invoice.date)}</span>
          {invoice.dueDate && (
            <>
              <span className="mx-1.5">·</span>
              <span>Vence el {formatDate(invoice.dueDate)}</span>
            </>
          )}
        </p>
        {invoice.observations && (
          <p className="mt-1 text-sm text-muted-foreground italic">
            &ldquo;{invoice.observations}&rdquo;
          </p>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Para el PDF/XML oficial con número de resolución DIAN, abrí esta factura en Alegra web.
      </p>
    </div>
  )
}
