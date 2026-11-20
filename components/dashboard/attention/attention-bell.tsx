'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { Bell, CheckCheck, CornerDownRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { ATTENTION_TEXT_MAX } from '@/lib/validations/attention-request.schema'
import type { AttentionFeedItem } from '@/lib/types/attention-request.types'
import { cn } from '@/lib/utils'
import { useAttentionFeed } from './use-attention-feed'

function formatBadge(count: number): string {
  return count > 99 ? '99+' : String(count)
}

/**
 * Process attention bell in the dashboard header, separate from the WhatsApp bell. Shows requests
 * other users sent me about my sub-processes (with an inline reply box) and replies to my requests.
 * Every item links to its sub-process.
 */
export function AttentionBell() {
  const [open, setOpen] = useState(false)
  const { feed, refresh, markRead, markAllRead, reply } = useAttentionFeed()

  const unread = feed?.unreadCount ?? 0
  const hasUnread = unread > 0

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) void refresh()
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={hasUnread ? `Solicitudes de atención, ${unread} sin leer` : 'Solicitudes de atención'}
        >
          <Bell className={cn('size-5', hasUnread && 'text-amber-600 motion-safe:animate-pulse motion-reduce:animate-none')} />
          {hasUnread && (
            <span className="pointer-events-none absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] leading-none font-semibold text-white">
              {formatBadge(unread)}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <p className="text-sm font-semibold">Solicitudes de atención</p>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => void markAllRead()}
            disabled={!hasUnread}
            aria-label="Marcar todas como leídas"
            title="Marcar todas como leídas"
          >
            <CheckCheck className="size-4" />
          </Button>
        </div>

        <div className="max-h-[28rem] overflow-y-auto" role="list" aria-live="polite">
          {!feed && <p className="px-3 py-6 text-center text-sm text-muted-foreground">Cargando...</p>}
          {feed && feed.items.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">No tiene solicitudes</p>
          )}
          {feed?.items.map((item) => (
            <AttentionItem
              key={`${item.kind}-${item.id}`}
              item={item}
              onNavigate={() => {
                setOpen(false)
                if (!item.read) void markRead(item.id)
              }}
              onMarkRead={() => void markRead(item.id)}
              onReply={async (text) => {
                const result = await reply(item.id, text)
                if (result.success) toast.success('Respuesta enviada')
                else toast.error(result.error ?? 'No se pudo enviar la respuesta')
                return result.success
              }}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

interface AttentionItemProps {
  item: AttentionFeedItem
  onNavigate: () => void
  onMarkRead: () => void
  onReply: (text: string) => Promise<boolean>
}

function AttentionItem({ item, onNavigate, onMarkRead, onReply }: AttentionItemProps) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const isRequest = item.kind === 'REQUEST'

  const submit = async () => {
    const value = text.trim()
    if (!value || sending) return
    setSending(true)
    const ok = await onReply(value)
    setSending(false)
    if (ok) setText('')
  }

  return (
    <div
      role="listitem"
      className={cn(
        'flex gap-2 border-b px-3 py-2 text-sm last:border-b-0',
        !item.read && 'bg-amber-50/70 dark:bg-amber-950/20'
      )}
      onFocusCapture={() => {
        if (!item.read && isRequest) onMarkRead()
      }}
    >
      <span
        aria-hidden
        className={cn('mt-1.5 size-2 shrink-0 rounded-full', item.read ? 'bg-transparent' : 'bg-amber-600')}
      />
      <div className="min-w-0 flex-1 space-y-1">
        <p className={cn('truncate', !item.read && 'font-semibold')}>
          {isRequest ? `${item.counterpartName} solicita tu atención` : `${item.counterpartName} respondió tu solicitud`}
        </p>
        <Link href={item.link} onClick={onNavigate} className="block truncate text-xs font-medium text-primary hover:underline">
          {item.subProcessLabel}
        </Link>
        <p className="whitespace-pre-wrap break-words text-muted-foreground">{item.message}</p>
        {item.reply && (
          <p className="flex gap-1 whitespace-pre-wrap break-words">
            <CornerDownRight aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <span>{item.reply}</span>
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(item.eventAt), { addSuffix: true, locale: es })}
        </p>
        {item.canReply && (
          <div className="space-y-1 pt-1">
            <Textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault()
                  void submit()
                }
              }}
              maxLength={ATTENTION_TEXT_MAX}
              rows={2}
              placeholder="Responder..."
              aria-label={`Responder a ${item.counterpartName}`}
              className="min-h-14 text-sm"
            />
            <div className="flex justify-end">
              <Button size="sm" onClick={() => void submit()} disabled={!text.trim() || sending}>
                {sending && <Loader2 className="size-4 animate-spin" />}
                Responder
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
