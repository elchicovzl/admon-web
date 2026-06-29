/**
 * Estimate detail header.
 *
 * Renders the estimate number, dates, seller, and observations.
 * No status badge — estimates don't have a status field.
 *
 * NOTE: the "Volver al listado" back link is rendered by the parent page
 * (app/dashboard/finances/estimates/[id]/page.tsx) OUTSIDE the Suspense
 * boundary, so it appears immediately even before the estimate data loads.
 * Do not add a duplicate back link here.
 */

import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { FileText, User } from 'lucide-react'
import type { EstimateListItem } from '@/lib/alegra/types'
import { formatEstimateNumber } from '@/lib/alegra/transformers'

interface EstimateDetailHeaderProps {
  estimate: EstimateListItem
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

export function EstimateDetailHeader({ estimate }: EstimateDetailHeaderProps) {
  const number = formatEstimateNumber(estimate)

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6 text-muted-foreground" />
          <h1 className="font-mono text-3xl font-bold tracking-tight">Cotización {number}</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          <span>Emitida el {formatDate(estimate.date)}</span>
          {estimate.dueDate && (
            <>
              <span className="mx-1.5">·</span>
              <span>Vence el {formatDate(estimate.dueDate)}</span>
            </>
          )}
        </p>
        {estimate.seller && (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <User className="h-3.5 w-3.5" />
            <span>Vendedor: {estimate.seller.name}</span>
          </p>
        )}
      </div>

      {(estimate.observations || estimate.anotation) && (
        <div className="space-y-1 rounded-md bg-muted/40 px-3 py-2 text-sm">
          {estimate.observations && (
            <p className="text-muted-foreground italic">
              <span className="not-italic font-medium text-foreground">Observaciones: </span>
              &ldquo;{estimate.observations}&rdquo;
            </p>
          )}
          {estimate.anotation && (
            <p className="text-muted-foreground italic">
              <span className="not-italic font-medium text-foreground">Notas internas: </span>
              &ldquo;{estimate.anotation}&rdquo;
            </p>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Para el PDF oficial de esta cotización, abrila en Alegra web.
      </p>
    </div>
  )
}