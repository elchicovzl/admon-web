/**
 * DIAN events timeline on the invoice detail page.
 *
 * Renders the `events[]` array as a vertical timeline with color-coded icons
 * based on status. Handles both date formats Alegra uses (YYYY-MM-DD HH:MM:SS
 * and DD-MM-YYYY HH:MM:SS) via `parseAlegraDateTime()`.
 *
 * If no events, renders nothing (returns null) — the absence of events on a
 * Colombian invoice is significant but we don't want to clutter the page.
 */

import {
  CheckCircle2,
  XCircle,
  Send,
  Mail,
  Eye,
  AlertTriangle,
  Clock,
  Circle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { format, isValid } from 'date-fns'
import { es } from 'date-fns/locale'
import { parseAlegraDateTime } from '@/lib/alegra/transformers'
import type { InvoiceEvent } from '@/lib/alegra/types'

interface DianEventsTimelineProps {
  events: InvoiceEvent[]
}

interface IconChoice {
  Icon: React.ComponentType<{ className?: string }>
  color: string
  label: string
}

function chooseIcon(event: InvoiceEvent): IconChoice {
  const status = event.status.toUpperCase()
  const type = event.type.toUpperCase()

  // Acceptance outcomes
  if (status.includes('ACCEPTED') || status.includes('ACKNOWLEDGED')) {
    return { Icon: CheckCircle2, color: 'text-emerald-600', label: 'Aceptada por el cliente' }
  }
  if (status.includes('REJECTED')) {
    return { Icon: XCircle, color: 'text-rose-600', label: 'Rechazada por el cliente' }
  }

  // Email lifecycle (per Colombian DIAN CLIENT_EMAILS)
  if (type.includes('CLIENT_EMAILS') || type.includes('EMAIL')) {
    if (status === 'SENT') return { Icon: Send, color: 'text-sky-600', label: 'Enviada por email' }
    if (status === 'DELIVERED') return { Icon: Mail, color: 'text-sky-700', label: 'Email entregado' }
    if (status === 'OPENED') return { Icon: Eye, color: 'text-sky-700', label: 'Email abierto' }
    if (status === 'BOUNCED' || status === 'FAILED') {
      return { Icon: AlertTriangle, color: 'text-rose-600', label: 'Email rebotado' }
    }
  }

  // Acceptance waiting
  if (status.includes('WAITING') || status.includes('PENDING')) {
    return { Icon: Clock, color: 'text-amber-600', label: 'Esperando' }
  }

  // Fallback
  return { Icon: Circle, color: 'text-muted-foreground', label: event.status }
}

export function DianEventsTimeline({ events }: DianEventsTimelineProps) {
  if (events.length === 0) return null

  // Sort by date ascending (earliest first). Events with unparseable dates
  // fall to the BOTTOM (Number.MAX_SAFE_INTEGER) so they don't show as
  // "from 1970" at the top — better to have them stay at the end with
  // their raw date string visible than to be visually wrong.
  const sorted = [...events].sort((a, b) => {
    const da = parseAlegraDateTime(a.date)?.getTime() ?? Number.MAX_SAFE_INTEGER
    const db = parseAlegraDateTime(b.date)?.getTime() ?? Number.MAX_SAFE_INTEGER
    return da - db
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          Eventos DIAN
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="relative space-y-4 pl-6">
          {/* Vertical line */}
          <span
            aria-hidden
            className="absolute left-[0.6875rem] top-2 bottom-2 w-px bg-border"
          />
          {sorted.map((event, idx) => {
            const { Icon, color, label } = chooseIcon(event)
            const dateObj = parseAlegraDateTime(event.date)
            return (
              <li key={`${event.date}-${idx}`} className="relative">
                {/* Dot */}
                <span
                  className={`absolute -left-6 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-background ${color}`}
                  aria-hidden
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">
                    {dateObj && isValid(dateObj)
                      ? format(dateObj, "dd MMM yyyy 'a las' HH:mm", { locale: es })
                      : event.date}
                    {event.type && (
                      <span className="ml-1 font-mono">· {event.type}</span>
                    )}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      </CardContent>
    </Card>
  )
}
