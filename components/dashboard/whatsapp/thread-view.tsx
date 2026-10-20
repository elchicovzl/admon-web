'use client'

import { useEffect, useRef } from 'react'
import { ArrowLeft, Loader2, MessageCircle, Send } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { ConversationSummary, ThreadMessage } from '@/lib/types/whatsapp.types'
import { MARKER_LABEL, STATUS_LABEL, attentionLabel, windowState } from '@/lib/whatsapp/inbox'
import { MessageBubble } from './message-bubble'
import { ThreadSkeleton } from './inbox-skeletons'

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

  const window = now ? windowState(now, conversation.lastInboundAt) : null
  const attention = now ? attentionLabel(conversation, now) : null

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-start gap-2 border-b p-3">
        <Button type="button" size="icon" variant="ghost" className="md:hidden" onClick={onBack} aria-label="Volver a la lista">
          <ArrowLeft className="h-4 w-4" />
        </Button>
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
          {window && (
            <p className={window.open ? 'text-xs text-emerald-600 dark:text-emerald-400' : 'text-xs text-amber-600 dark:text-amber-400'}>
              {window.label}
            </p>
          )}
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
              <MessageBubble key={message.id} message={message} />
            ))}
          </div>
        )}
      </div>

      {/* Placeholder: sending arrives with the composer (PR2.3). */}
      <footer className="border-t p-3">
        <div className="flex items-end gap-2">
          <Textarea
            disabled
            rows={1}
            placeholder="El envío de mensajes estará disponible próximamente"
            aria-label="Escribir mensaje (no disponible)"
            className="min-h-9 resize-none"
          />
          <Button type="button" size="icon" disabled aria-label="Enviar (no disponible)">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </footer>
    </div>
  )
}
