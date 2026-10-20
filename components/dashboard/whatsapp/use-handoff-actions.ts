'use client'

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import {
  closeConversation,
  confirmContactAsUnknown,
  linkContactToClient,
  reopenConversation,
  returnToAi,
  setConversationAiPaused,
  takeConversation,
  unlinkContactFromClient,
} from '@/lib/actions/whatsapp.actions'
import type { ActionResponse } from '@/lib/types/auth.types'
import type { ConversationSummary } from '@/lib/types/whatsapp.types'

const ACTION_ERROR = 'No se pudo completar la acción'

/**
 * Header actions for the open conversation. A success merges the fresh summary returned by the
 * action right away (`onUpdated`), so the header and the list reflect the change without waiting
 * for the next poll; other users see it on their next poll through `updatedAt`.
 */
export function useHandoffActions({
  conversationId,
  onUpdated,
}: {
  conversationId: string | null
  onUpdated: (conversation: ConversationSummary) => void
}) {
  const [pending, setPending] = useState(false)

  const run = useCallback(
    async (task: () => Promise<ActionResponse<ConversationSummary>>, success: string): Promise<boolean> => {
      setPending(true)
      try {
        const result = await task()
        if (!result.success || !result.data) {
          toast.error(result.error ?? ACTION_ERROR)
          return false
        }
        onUpdated(result.data)
        toast.success(success)
        return true
      } catch {
        toast.error(ACTION_ERROR)
        return false
      } finally {
        setPending(false)
      }
    },
    [onUpdated]
  )

  const withId = useCallback(
    (task: (id: string) => Promise<ActionResponse<ConversationSummary>>, success: string) =>
      conversationId ? run(() => task(conversationId), success) : Promise.resolve(false),
    [conversationId, run]
  )

  return {
    pending,
    take: () => withId((id) => takeConversation({ conversationId: id }), 'Ahora atiende esta conversación'),
    returnToAi: () => withId((id) => returnToAi({ conversationId: id }), 'Conversación devuelta a la IA'),
    close: (reason: string) =>
      withId((id) => closeConversation({ conversationId: id, reason }), 'Conversación cerrada'),
    reopen: (target: 'AI' | 'HUMAN') =>
      withId((id) => reopenConversation({ conversationId: id, target }), 'Conversación reabierta'),
    setAiPaused: (paused: boolean) =>
      withId(
        (id) => setConversationAiPaused({ conversationId: id, paused }),
        paused ? 'IA pausada en esta conversación' : 'IA reanudada en esta conversación'
      ),
    link: (clientId: string) =>
      withId((id) => linkContactToClient({ conversationId: id, clientId }), 'Contacto vinculado al cliente'),
    unlink: () => withId((id) => unlinkContactFromClient({ conversationId: id }), 'Contacto desvinculado'),
    confirmUnknown: () =>
      withId((id) => confirmContactAsUnknown({ conversationId: id }), 'Contacto confirmado como nuevo lead'),
  }
}

export type HandoffActions = ReturnType<typeof useHandoffActions>
