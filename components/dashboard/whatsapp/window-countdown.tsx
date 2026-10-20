import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { windowState } from '@/lib/whatsapp/inbox'

interface WindowCountdownProps {
  /** Null until the page has mounted, so server and client render the same markup. */
  now: Date | null
  lastInboundAt: string | null
  className?: string
}

/**
 * 24 h customer-service window (WI-8): "Ventana abierta · quedan 5 h 12 min" or
 * "Ventana cerrada · solo plantillas". Pure display; the clock comes from `useNow` (60 s) and
 * `lastInboundAt` from each poll, so it re-renders when either changes.
 */
export function WindowCountdown({ now, lastInboundAt, className }: WindowCountdownProps) {
  if (!now) return null
  const state = windowState(now, lastInboundAt)
  // Last hour: warn before the composer switches to templates.
  const closing = state.open && state.remainingMs < 60 * 60 * 1000

  return (
    <p
      className={cn(
        'flex items-center gap-1 text-xs',
        !state.open && 'text-amber-600 dark:text-amber-400',
        state.open && !closing && 'text-emerald-600 dark:text-emerald-400',
        closing && 'font-medium text-amber-600 dark:text-amber-400',
        className
      )}
    >
      <Clock className="h-3 w-3" aria-hidden />
      {state.label}
    </p>
  )
}
