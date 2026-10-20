import { AlertCircle, Check, CheckCheck, Clock } from 'lucide-react'
import type { MessageStatus } from '@prisma/client'
import { cn } from '@/lib/utils'
import { deliveryTick, tickColorClass, type TickIcon } from '@/lib/whatsapp/delivery-ticks'

const ICONS: Record<TickIcon, typeof Check> = {
  clock: Clock,
  check: Check,
  'check-check': CheckCheck,
  alert: AlertCircle,
}

/** WhatsApp-style mark for an outgoing message; the status text stays as label and tooltip. */
export function DeliveryTicks({ status, onPrimary }: { status: MessageStatus; onPrimary: boolean }) {
  const tick = deliveryTick(status)
  if (!tick) return null
  const Icon = ICONS[tick.icon]
  return (
    <span role="img" aria-label={tick.label} title={tick.label} className="inline-flex">
      <Icon className={cn('size-3.5', tickColorClass(tick.tone, onPrimary))} aria-hidden />
    </span>
  )
}
