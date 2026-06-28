/**
 * Invoice detail header.
 *
 * Renders the invoice number, dates, status badge, and a back link.
 * The "open in Alegra" external link is omitted in V1 (placeholder text only).
 */

import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { ArrowLeft, FileText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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

function formatDateTime(s: string): string {
  // Alegra sometimes returns 'YYYY-MM-DD HH:MM:SS', sometimes with 'T'.
  // parseISO handles both. Falls back to the raw string if unparseable.
  try {
    return format(parseISO(s.replace(' ', 'T')), "dd MMM yyyy 'a las' HH:mm", { locale: es })
  } catch {
    return s
  }
}

export function DetailHeader({ invoice }: DetailHeaderProps) {
  const number = formatInvoiceNumber(invoice.numberTemplate as NumberTemplate | null)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="gap-1 text-muted-foreground">
          <Link href="/dashboard/finances/invoices">
            <ArrowLeft className="h-4 w-4" />
            Volver al listado
          </Link>
        </Button>
        <div className="ml-auto">
          <Badge variant="outline" className={getInvoiceStatusBadgeClass(invoice.status)}>
            {getInvoiceStatusLabel(invoice.status)}
          </Badge>
        </div>
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
