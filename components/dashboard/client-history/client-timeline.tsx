import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Clock } from 'lucide-react'
import type { TimelineEvent, TimelineVariant } from '@/lib/types/client-history.types'

const dotColors: Record<TimelineVariant, string> = {
  default: 'bg-primary',
  success: 'bg-green-500',
  info: 'bg-blue-500',
  warning: 'bg-amber-500',
  muted: 'bg-muted-foreground/40',
}

interface ClientTimelineProps {
  events: TimelineEvent[]
}

export function ClientTimeline({ events }: ClientTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
        <Clock className="mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Sin actividad registrada.</p>
      </div>
    )
  }

  return (
    <ol className="relative space-y-6 border-l pl-6">
      {events.map((event) => (
        <li key={event.id} className="relative">
          <span
            className={cn(
              'absolute -left-[1.6875rem] top-1 h-3 w-3 rounded-full ring-4 ring-background',
              dotColors[event.variant]
            )}
          />
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{event.title}</span>
              {event.affiliationNumber && (
                <Badge variant="outline" className="text-[10px]">
                  {event.affiliationNumber}
                </Badge>
              )}
            </div>
            {event.description && (
              <p className="text-sm text-muted-foreground">{event.description}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {format(new Date(event.date), "d 'de' MMMM, yyyy · HH:mm", { locale: es })}
              {event.actor ? ` · ${event.actor}` : ''}
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}
