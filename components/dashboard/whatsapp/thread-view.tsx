'use client'

import { useEffect, useRef } from 'react'
import { ArrowLeft, Loader2, MessageCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { ConversationSummary, ThreadMessage } from '@/lib/types/whatsapp.types'
import { composerMode, resendAction } from '@/lib/whatsapp/composer'
import { MARKER_LABEL, STATUS_LABEL, attentionLabel } from '@/lib/whatsapp/inbox'
import { ConversationAvatar } from './conversation-avatar'
import { Composer, type ComposerHandlers } from './composer'
import { HandoffActions } from './handoff-actions'
import type { HandoffActions as HandoffActionHandlers } from './use-handoff-actions'
import { MessageBubble } from './message-bubble'
import { ThreadSkeleton } from './inbox-skeletons'
import { WindowCountdown } from './window-countdown'

export interface ThreadState {
  conversationId: string
  messages: ThreadMessage[]
  hasMore: boolean
  status: 'loading' | 'ready' | 'error'
  error: string | null
}

interface ThreadViewProps {
  conversation: ConversationSummary | null
  thread: ThreadState | null
  now: Date | null
  loadingOlder: boolean
  onBack: () => void
  onLoadOlder: () => void
  onRetry: () => void
  composer: ComposerHandlers
  onResend: (message: ThreadMessage) => void
  handoff: HandoffActionHandlers
}

/** Pixels from the bottom within which a new message keeps the view pinned to the end. */
const STICK_THRESHOLD = 120

export function ThreadView({
  conversation,
  thread,
  now,
  loadingOlder,
  onBack,
  onLoadOlder,
  onRetry,
  composer,
  onResend,
  handoff,
}: ThreadViewProps) {
  const scroller = useRef<HTMLDivElement | null>(null)
  const pinned = useRef(true)
  const lastId = useRef<string | null>(null)
  const messages = thread?.messages

  // Follow the conversation unless the user scrolled up to read history.
  useEffect(() => {
    const node = scroller.current
    if (!node || !messages?.length) return
    const newest = messages[messages.length - 1].id
    if (newest !== lastId.current && (pinned.current || lastId.current === null)) {
      node.scrollTop = node.scrollHeight
    }
    lastId.current = newest
  }, [messages])

  useEffect(() => {
    pinned.current = true
    lastId.current = null
  }, [thread?.conversationId])

  if (!conversation) {
    // Deep link to a conversation that is not in the loaded page yet: its thread is on the way.
    if (thread?.status === 'loading') return <ThreadSkeleton />
    if (thread?.status === 'error') {
      return (
        <div className="space-y-2 p-4 text-sm">
          <p className="text-destructive">{thread.error ?? 'No se pudo cargar la conversación'}</p>
          <Button type="button" size="sm" variant="outline" onClick={onRetry}>
            Reintentar
          </Button>
        </div>
      )
    }
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
        <MessageCircle className="h-10 w-10" aria-hidden />
        <p className="text-sm">Selecciona una conversación para verla.</p>
      </div>
    )
  }

  const attention = now ? attentionLabel(conversation, now) : null
  const lastInboundAt = conversation.lastInboundAt ? new Date(conversation.lastInboundAt) : null
  const mode = now ? composerMode({ status: conversation.status, lastInboundAt, now }) : null

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-start gap-2 border-b p-3">
        <Button type="button" size="icon" variant="ghost" className="md:hidden" onClick={onBack} aria-label="Volver a la lista">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <ConversationAvatar name={conversation.displayName} seed={conversation.id} />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-semibold">{conversation.displayName}</h2>
            <Badge variant={conversation.status === 'ESCALATED' ? 'destructive' : 'secondary'}>
              {STATUS_LABEL[conversation.status]}
            </Badge>
            {conversation.aiPaused && <Badge variant="outline">IA pausada</Badge>}
            {conversation.markers.map((marker) => (
              <Badge key={marker} variant="outline">
                {MARKER_LABEL[marker]}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {conversation.phone}
            {conversation.takenOverByName && ` · Atiende: ${conversation.takenOverByName}`}
            {attention && <span className="font-medium text-destructive"> · {attention}</span>}
          </p>
          <WindowCountdown now={now} lastInboundAt={conversation.lastInboundAt} />
          <HandoffActions conversation={conversation} actions={handoff} />
        </div>
      </header>

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto" onScroll={(event) => {
        const node = event.currentTarget
        pinned.current = node.scrollHeight - node.scrollTop - node.clientHeight < STICK_THRESHOLD
      }}>
        {!thread || thread.status === 'loading' ? (
          <ThreadSkeleton />
        ) : thread.status === 'error' ? (
          <div className="space-y-2 p-4 text-sm">
            <p className="text-destructive">{thread.error ?? 'No se pudo cargar la conversación'}</p>
            <Button type="button" size="sm" variant="outline" onClick={onRetry}>
              Reintentar
            </Button>
          </div>
        ) : (
          <div className="space-y-2 p-4">
            {thread.hasMore && (
              <div className="text-center">
                <Button type="button" size="sm" variant="ghost" disabled={loadingOlder} onClick={onLoadOlder}>
                  {loadingOlder && <Loader2 className="h-4 w-4 animate-spin" />}
                  Ver mensajes anteriores
                </Button>
              </div>
            )}
            {thread.messages.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">Aún no hay mensajes.</p>
            )}
            {thread.messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                contactName={conversation.displayName}
                onResend={onResend}
                resend={
                  now
                    ? resendAction({ message, conversationStatus: conversation.status, lastInboundAt, now })
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </div>

      <Composer
        key={conversation.id}
        mode={thread?.status === 'ready' ? mode : null}
        displayName={conversation.displayName}
        {...composer}
      />
    </div>
  )
}
