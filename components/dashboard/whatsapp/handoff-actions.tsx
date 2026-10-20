'use client'

import { useState } from 'react'
import { Bot, ChevronDown, Hand, Loader2, MoreHorizontal, RotateCcw, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { ConversationSummary } from '@/lib/types/whatsapp.types'
import { CLOSE_REASON_MAX_LENGTH, handoffOptions } from '@/lib/whatsapp/handoff'
import { AiPauseToggle } from './ai-pause-toggle'
import { LinkClientDialog } from './link-client-dialog'
import { UnlinkClientDialog, type ContactDecision } from './unlink-client-dialog'
import type { HandoffActions as HandoffActionHandlers } from './use-handoff-actions'

interface HandoffActionsProps {
  conversation: ConversationSummary
  actions: HandoffActionHandlers
}

/**
 * Conversation header actions (WI-9): take, hand back to the AI, close, reopen, the per-chat AI
 * switch, and the contact decisions (link, unlink, confirm as unknown). Only the actions the
 * state machine allows from the current state are shown.
 */
export function HandoffActions({ conversation, actions }: HandoffActionsProps) {
  const options = handoffOptions(conversation)
  const { pending } = actions
  const [closing, setClosing] = useState(false)
  const [reason, setReason] = useState('')
  const [linking, setLinking] = useState(false)
  const [decision, setDecision] = useState<ContactDecision | null>(null)

  const submitClose = async () => {
    if (await actions.close(reason)) {
      setClosing(false)
      setReason('')
    }
  }

  const confirmDecision = (value: ContactDecision) => {
    setDecision(null)
    void (value === 'unlink' ? actions.unlink() : actions.confirmUnknown())
  }

  const hasContactMenu = options.link || options.unlink || options.confirmUnknown

  return (
    <div className="flex flex-wrap items-center gap-2">
      {options.pauseAi && (
        <AiPauseToggle
          conversationId={conversation.id}
          paused={conversation.aiPaused}
          disabled={pending}
          onChange={(paused) => void actions.setAiPaused(paused)}
        />
      )}

      {options.take && (
        <Button type="button" size="sm" disabled={pending} onClick={() => void actions.take()}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Hand className="h-4 w-4" />}
          Atender
        </Button>
      )}

      {options.returnToAi && (
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => void actions.returnToAi()}>
          <Bot className="h-4 w-4" />
          Devolver a la IA
        </Button>
      )}

      {options.reopen && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" size="sm" disabled={pending}>
              <RotateCcw className="h-4 w-4" />
              Reabrir
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => void actions.reopen('HUMAN')}>Reabrir y atender yo</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void actions.reopen('AI')}>Reabrir con la IA</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {(options.close || hasContactMenu) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" size="icon" variant="ghost" disabled={pending} aria-label="Más acciones">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {options.link && <DropdownMenuItem onSelect={() => setLinking(true)}>Vincular a un cliente</DropdownMenuItem>}
            {options.unlink && (
              <DropdownMenuItem onSelect={() => setDecision('unlink')}>Desvincular del cliente</DropdownMenuItem>
            )}
            {options.confirmUnknown && (
              <DropdownMenuItem onSelect={() => setDecision('confirmUnknown')}>
                No es ningún cliente (crear lead)
              </DropdownMenuItem>
            )}
            {options.close && hasContactMenu && <DropdownMenuSeparator />}
            {options.close && (
              <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setClosing(true)}>
                <XCircle className="h-4 w-4" />
                Cerrar conversación
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Dialog open={closing} onOpenChange={setClosing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cerrar conversación</DialogTitle>
            <DialogDescription>
              Si el cliente vuelve a escribir, la conversación se reabre sola.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="close-reason">Motivo (opcional)</Label>
            <Textarea
              id="close-reason"
              value={reason}
              maxLength={CLOSE_REASON_MAX_LENGTH}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ej.: consulta resuelta"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setClosing(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" disabled={pending} onClick={() => void submitClose()}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LinkClientDialog
        open={linking}
        onOpenChange={setLinking}
        phone={conversation.phone}
        pending={pending}
        onLink={actions.link}
      />
      <UnlinkClientDialog decision={decision} onConfirm={confirmDecision} onCancel={() => setDecision(null)} />
    </div>
  )
}
