'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { BellRing, CheckCheck, MessageCircle, Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { WHATSAPP_INBOX_PATH } from '@/lib/notifications/present'
import { cn } from '@/lib/utils'
import { useNotificationFeed } from './use-notification-feed'

function formatBadge(count: number): string {
  return count > 99 ? '99+' : String(count)
}

/**
 * WhatsApp icon at the top-right of the dashboard header (in-app notifications only, no email).
 * Shows the unread counter, pulses while there is something unread (respecting
 * prefers-reduced-motion) and opens the list of notifications. Rendered only for users with
 * WhatsApp access; the server actions check that again on every call.
 */
export function NotificationBell({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false)
  const { feed, muted, setMuted, permission, enableBrowserNotifications, markRead, markAllRead } =
    useNotificationFeed(userId)

  const unread = feed?.unreadCount ?? 0
  const hasUnread = unread > 0

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={hasUnread ? `Notificaciones de WhatsApp, ${unread} sin leer` : 'Notificaciones de WhatsApp'}
        >
          <MessageCircle
            className={cn(
              'size-5',
              hasUnread && 'text-emerald-600 motion-safe:animate-pulse motion-reduce:animate-none'
            )}
          />
          {hasUnread && (
            <span className="pointer-events-none absolute -top-0.5 -right-0.5 flex size-4 min-w-4 items-center justify-center">
              <span className="absolute inline-flex size-full rounded-full bg-red-500/60 motion-safe:animate-ping motion-reduce:animate-none" />
              <span className="relative inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] leading-none font-semibold text-white">
                {formatBadge(unread)}
              </span>
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <p className="text-sm font-semibold">Notificaciones</p>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => setMuted(!muted)}
              aria-pressed={muted}
              aria-label={muted ? 'Activar sonido' : 'Silenciar sonido'}
              title={muted ? 'Activar sonido' : 'Silenciar sonido'}
            >
              {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </Button>
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
        </div>

        {permission === 'default' && (
          <div className="border-b px-3 py-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => void enableBrowserNotifications()}
            >
              <BellRing className="size-4" />
              Activar notificaciones del navegador
            </Button>
          </div>
        )}
        {permission === 'denied' && (
          <p className="border-b px-3 py-2 text-xs text-muted-foreground">
            Las notificaciones del navegador están bloqueadas. Puede habilitarlas desde la configuración del sitio.
          </p>
        )}

        <div className="max-h-80 overflow-y-auto" role="list" aria-live="polite">
          {!feed && <p className="px-3 py-6 text-center text-sm text-muted-foreground">Cargando...</p>}
          {feed && feed.items.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">No tiene notificaciones</p>
          )}
          {feed?.items.map((item) => (
            <Link
              key={item.id}
              href={item.link}
              role="listitem"
              onClick={() => {
                setOpen(false)
                if (!item.read) void markRead(item.id)
              }}
              className={cn(
                'flex gap-2 border-b px-3 py-2 text-sm last:border-b-0 hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
                !item.read && 'bg-emerald-50/60 dark:bg-emerald-950/20'
              )}
            >
              <span
                aria-hidden
                className={cn('mt-1.5 size-2 shrink-0 rounded-full', item.read ? 'bg-transparent' : 'bg-emerald-600')}
              />
              <span className="min-w-0 flex-1">
                <span className={cn('block truncate', !item.read && 'font-semibold')}>{item.title}</span>
                <span className="block text-muted-foreground">{item.body}</span>
                <span className="block text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: es })}
                </span>
              </span>
            </Link>
          ))}
        </div>

        <div className="border-t px-3 py-2">
          <Link
            href={WHATSAPP_INBOX_PATH}
            onClick={() => setOpen(false)}
            className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
          >
            Abrir WhatsApp
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
