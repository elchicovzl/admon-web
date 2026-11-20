'use client'

import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { BellRing, CornerDownRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { AttentionRequestView } from '@/lib/types/attention-request.types'
import { NotifyAssigneeButton, type AttentionTarget } from './notify-assignee-dialog'

interface SubProcessAttentionSectionProps {
  target: AttentionTarget
  requests: AttentionRequestView[]
  currentUserId?: string | null
}

function formatDate(date: Date | string): string {
  return format(new Date(date), "d MMM yyyy, HH:mm", { locale: es })
}

/** History of attention requests of one sub-process (S6), with the button to send a new one. */
export function SubProcessAttentionSection({ target, requests, currentUserId }: SubProcessAttentionSectionProps) {
  const canNotify = Boolean(target.assignedToId) && target.assignedToId !== currentUserId

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <BellRing className="h-5 w-5" />
          Solicitudes de atención
        </CardTitle>
        <CardDescription>Mensajes enviados al responsable de este sub-proceso y sus respuestas.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {canNotify && <NotifyAssigneeButton target={target} currentUserId={currentUserId} variant="full" />}

        {requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay solicitudes de atención.</p>
        ) : (
          <ul className="space-y-3">
            {requests.map((request) => (
              <li key={request.id} className="space-y-2 rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p>
                    <span className="font-medium">{request.senderName}</span>
                    <span className="text-muted-foreground"> → {request.recipientName}</span>
                  </p>
                  {request.status === 'ANSWERED' ? (
                    <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                      Respondida
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                      Pendiente
                    </Badge>
                  )}
                </div>
                <p className="whitespace-pre-wrap break-words">{request.message}</p>
                <p className="text-xs text-muted-foreground">{formatDate(request.createdAt)}</p>
                {request.reply && (
                  <div className="flex gap-2 rounded-md bg-muted/50 p-2">
                    <CornerDownRight aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 space-y-1">
                      <p className="whitespace-pre-wrap break-words">{request.reply}</p>
                      {request.repliedAt && (
                        <p className="text-xs text-muted-foreground">
                          {request.recipientName} · {formatDate(request.repliedAt)}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
