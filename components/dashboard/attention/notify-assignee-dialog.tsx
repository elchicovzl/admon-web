'use client'

import { useEffect, useState, useTransition, type MouseEvent } from 'react'
import { useRouter } from 'next/navigation'
import { BellRing, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { AffiliationSubProcessType } from '@prisma/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { sendAttentionRequest } from '@/lib/actions/attention-request.actions'
import { SubProcessTypeLabels } from '@/lib/types/affiliation.types'
import { ATTENTION_TEXT_MAX } from '@/lib/validations/attention-request.schema'

/** Minimal sub-process data the dialog needs; every list in the app already loads it. */
export interface AttentionTarget {
  id: string
  type: AffiliationSubProcessType
  assignedToId: string | null
  assignedTo?: { name: string | null; email: string } | null
  employee?: { fullName: string } | null
}

function assigneeName(target: AttentionTarget): string | null {
  return target.assignedTo ? target.assignedTo.name || target.assignedTo.email : null
}

function targetLabel(target: AttentionTarget): string {
  const parts = [SubProcessTypeLabels[target.type]]
  if (target.employee?.fullName) parts.push(target.employee.fullName)
  return parts.join(' · ')
}

/** Why a sub-process cannot be notified, or null when it can. Mirrors the server checks. */
function unavailableReason(target: AttentionTarget, currentUserId?: string | null): string | null {
  if (!target.assignedToId) return 'Sin responsable asignado'
  if (currentUserId && target.assignedToId === currentUserId) return 'Eres el responsable'
  return null
}

interface NotifyAssigneeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** One sub-process (kanban, detail) or all sub-processes of an affiliation (list menu). */
  targets: AttentionTarget[]
  currentUserId?: string | null
}

/** Sends an attention request to the assignee of the chosen sub-process (S1, S2). */
export function NotifyAssigneeDialog({ open, onOpenChange, targets, currentUserId }: NotifyAssigneeDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [subProcessId, setSubProcessId] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!open) return
    const firstAvailable = targets.find((target) => !unavailableReason(target, currentUserId))
    setSubProcessId(firstAvailable?.id ?? '')
    setMessage('')
  }, [open, targets, currentUserId])

  const selected = targets.find((target) => target.id === subProcessId)
  const canSend = Boolean(selected) && message.trim().length > 0 && !isPending

  const submit = () => {
    if (!selected || !canSend) return
    startTransition(async () => {
      const result = await sendAttentionRequest({ subProcessId: selected.id, message })
      if (result.success) {
        toast.success(result.message ?? 'Solicitud enviada al responsable')
        onOpenChange(false)
        router.refresh()
      } else {
        toast.error(result.error ?? 'No se pudo enviar la solicitud')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClick={(event) => event.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Notificar responsable</DialogTitle>
          <DialogDescription>
            El responsable del sub-proceso recibirá el mensaje en sus notificaciones y podrá responderte.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {targets.length > 1 ? (
            <div className="space-y-2">
              <Label htmlFor="attention-subprocess">Sub-proceso</Label>
              <Select value={subProcessId} onValueChange={setSubProcessId}>
                <SelectTrigger id="attention-subprocess">
                  <SelectValue placeholder="Seleccionar sub-proceso..." />
                </SelectTrigger>
                <SelectContent>
                  {targets.map((target) => {
                    const reason = unavailableReason(target, currentUserId)
                    return (
                      <SelectItem key={target.id} value={target.id} disabled={Boolean(reason)}>
                        {targetLabel(target)} — {reason ?? assigneeName(target)}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          ) : (
            targets[0] && (
              <p className="text-sm">
                <span className="font-medium">{targetLabel(targets[0])}</span>
                {' — '}
                {unavailableReason(targets[0], currentUserId) ?? assigneeName(targets[0])}
              </p>
            )
          )}

          {!selected && (
            <p className="text-sm text-muted-foreground">Ningún sub-proceso tiene un responsable al que notificar.</p>
          )}

          <div className="space-y-2">
            <Label htmlFor="attention-message">Mensaje</Label>
            <Textarea
              id="attention-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={ATTENTION_TEXT_MAX}
              rows={4}
              placeholder="Ej: El cliente escribió por WhatsApp preguntando por su afiliación."
              disabled={!selected}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!canSend}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface NotifyAssigneeButtonProps {
  target: AttentionTarget
  currentUserId?: string | null
  /** `icon` for table rows, `full` for cards. */
  variant?: 'icon' | 'full'
}

/** Button + dialog for a single sub-process. Stops click propagation so clickable rows do not navigate. */
export function NotifyAssigneeButton({ target, currentUserId, variant = 'icon' }: NotifyAssigneeButtonProps) {
  const [open, setOpen] = useState(false)
  const reason = unavailableReason(target, currentUserId)

  const onClick = (event: MouseEvent) => {
    event.stopPropagation()
    setOpen(true)
  }

  return (
    // Portaled dialog events (including overlay clicks) still bubble through the React tree;
    // stop them here so a clickable row or card around the button never navigates.
    <span className={variant === 'full' ? 'block' : 'inline-flex'} onClick={(event) => event.stopPropagation()}>
      {variant === 'icon' ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onClick}
          disabled={Boolean(reason)}
          aria-label="Notificar responsable"
          title={reason ?? 'Notificar responsable'}
        >
          <BellRing className="h-4 w-4" />
        </Button>
      ) : (
        <Button variant="outline" className="w-full" onClick={onClick} disabled={Boolean(reason)} title={reason ?? undefined}>
          <BellRing className="h-4 w-4" />
          Notificar responsable
        </Button>
      )}
      <NotifyAssigneeDialog open={open} onOpenChange={setOpen} targets={[target]} currentUserId={currentUserId} />
    </span>
  )
}
