import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ThreadMessage } from '@/lib/types/whatsapp.types'
import { deliveryLabel, formatClock, messageTypeLabel, senderLabel } from '@/lib/whatsapp/inbox'
import { MessageMedia } from './message-media'

const SOURCE_STYLE: Record<ThreadMessage['source'], string> = {
  CLIENT: 'bg-muted',
  AI: 'bg-violet-100 text-violet-950 dark:bg-violet-950/40 dark:text-violet-50',
  DASHBOARD: 'bg-primary text-primary-foreground',
  PHONE_APP: 'bg-emerald-100 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-50',
  SYSTEM: 'border border-dashed bg-background text-muted-foreground',
}

/** One message: source label, body (text, media or type placeholder), time and delivery state. */
export function MessageBubble({ message }: { message: ThreadMessage }) {
  const outgoing = message.direction === 'OUT'
  const failed = message.status === 'FAILED'
  const body = message.text ?? (message.templateName ? `Plantilla: ${message.templateName}` : null)

  return (
    <div className={cn('flex', outgoing ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[85%] space-y-1 rounded-lg px-3 py-2 text-sm sm:max-w-[70%]', SOURCE_STYLE[message.source])}>
        <p className="text-[11px] font-medium opacity-70">{senderLabel(message)}</p>

        {message.media && <MessageMedia messageId={message.id} type={message.type} media={message.media} />}
        {body ? (
          <p className="whitespace-pre-wrap break-words">{body}</p>
        ) : (
          !message.media && <p className="italic opacity-70">{messageTypeLabel(message.type)}</p>
        )}

        <p className="flex items-center justify-end gap-1 text-[11px] opacity-70">
          {failed && <AlertCircle className="h-3 w-3" aria-hidden />}
          <span>{formatClock(message.timestamp)}</span>
          {outgoing && <span>· {deliveryLabel(message.status)}</span>}
        </p>
        {failed && message.errorMessage && (
          <p className="text-[11px] font-medium">{message.errorMessage}</p>
        )}
      </div>
    </div>
  )
}
