'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { MessageCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getClientConversations } from '@/lib/actions/whatsapp.actions'
import type { ClientConversationItem } from '@/lib/types/whatsapp.types'
import { STATUS_LABEL } from '@/lib/whatsapp/inbox'

type TabState =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'ready'; items: ClientConversationItem[] }

/**
 * WhatsApp tab of the client profile (CP-1): the client's conversations, newest first, each one
 * opening in the shared inbox. Loaded when the tab is shown, so the profile does not pay for it.
 */
export function ClientWhatsAppTab({ clientId }: { clientId: string }) {
  const [state, setState] = useState<TabState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    getClientConversations({ clientId })
      .then((result) => {
        if (cancelled) return
        setState(
          result.success && result.data
            ? { status: 'ready', items: result.data }
            : { status: 'error', error: result.error ?? 'No se pudieron cargar las conversaciones' }
        )
      })
      .catch(() => !cancelled && setState({ status: 'error', error: 'No se pudieron cargar las conversaciones' }))
    return () => {
      cancelled = true
    }
  }, [clientId])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conversaciones de WhatsApp</CardTitle>
        <CardDescription>Chats de los números vinculados a este cliente.</CardDescription>
      </CardHeader>
      <CardContent>
        {state.status === 'loading' ? (
          <div className="space-y-3">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : state.status === 'error' ? (
          <p className="text-sm text-destructive">{state.error}</p>
        ) : state.items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
            <MessageCircle className="h-8 w-8" aria-hidden />
            <p className="text-sm">Este cliente aún no tiene conversaciones de WhatsApp.</p>
          </div>
        ) : (
          <ul className="divide-y">
            {state.items.map((item) => (
              <li key={item.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{item.phone}</span>
                    {item.profileName && <span className="text-sm text-muted-foreground">{item.profileName}</span>}
                    <Badge variant={item.status === 'ESCALATED' ? 'destructive' : 'secondary'}>
                      {STATUS_LABEL[item.status]}
                    </Badge>
                    {item.aiPaused && <Badge variant="outline">IA pausada</Badge>}
                    {item.unreadCount > 0 && <Badge>{item.unreadCount} sin leer</Badge>}
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {item.preview ?? 'Sin mensajes'} ·{' '}
                    {formatDistanceToNow(new Date(item.lastMessageAt), { addSuffix: true, locale: es })}
                    {item.takenOverByName && ` · Atiende: ${item.takenOverByName}`}
                  </p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/dashboard/whatsapp?c=${item.id}`}>Abrir en la bandeja</Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
