'use client'

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { resendFailedMessage, sendReply, sendTemplate } from '@/lib/actions/whatsapp.actions'
import type { ThreadMessage } from '@/lib/types/whatsapp.types'
import { resendNeedsConfirmation } from '@/lib/whatsapp/composer'
import type { TemplateKey } from '@/lib/whatsapp/templates'

const SEND_ERROR = 'No se pudo enviar el mensaje'

interface Outcome {
  success: boolean
  error?: string
}

/**
 * Send, attach and resend for the open conversation. Every call ends with `onChanged` (an
 * immediate poll), also after a failure: a message that was stored but could not be queued
 * shows up as FAILED, ready for "Reintentar". Resending a message whose delivery is unconfirmed
 * waits for an explicit confirmation first (it may already have reached the customer).
 */
export function useThreadActions({
  conversationId,
  onChanged,
}: {
  conversationId: string | null
  onChanged: () => Promise<void>
}) {
  const [sending, setSending] = useState(false)
  const [confirming, setConfirming] = useState<ThreadMessage | null>(null)

  const run = useCallback(
    async (task: () => Promise<Outcome>): Promise<boolean> => {
      setSending(true)
      try {
        const result = await task()
        if (!result.success) toast.error(result.error ?? SEND_ERROR)
        await onChanged().catch(() => undefined)
        return result.success
      } catch {
        toast.error(SEND_ERROR)
        return false
      } finally {
        setSending(false)
      }
    },
    [onChanged]
  )

  const sendText = useCallback(
    (text: string) => (conversationId ? run(() => sendReply({ conversationId, text })) : Promise.resolve(false)),
    [conversationId, run]
  )

  const sendTemplateMessage = useCallback(
    (templateKey: TemplateKey, params: string[]) =>
      conversationId ? run(() => sendTemplate({ conversationId, templateKey, params })) : Promise.resolve(false),
    [conversationId, run]
  )

  const sendAttachment = useCallback(
    (file: File, caption: string) =>
      conversationId
        ? run(async () => {
            const form = new FormData()
            form.append('conversationId', conversationId)
            form.append('file', file)
            if (caption) form.append('caption', caption)
            const response = await fetch('/api/whatsapp/messages/media', { method: 'POST', body: form })
            // A proxy error page (413, 502) is not JSON.
            return (await response.json().catch(() => null)) ?? { success: false, error: SEND_ERROR }
          })
        : Promise.resolve(false),
    [conversationId, run]
  )

  const doResend = useCallback(
    (message: ThreadMessage, confirmUnknownDelivery: boolean) =>
      run(() => resendFailedMessage({ messageId: message.id, confirmUnknownDelivery })),
    [run]
  )

  const resend = useCallback(
    (message: ThreadMessage) => {
      if (resendNeedsConfirmation(message.errorCode)) {
        setConfirming(message)
        return
      }
      void doResend(message, false)
    },
    [doResend]
  )

  const confirmResend = useCallback(() => {
    const message = confirming
    setConfirming(null)
    if (message) void doResend(message, true)
  }, [confirming, doResend])

  const cancelResend = useCallback(() => setConfirming(null), [])

  return {
    sending,
    sendText,
    sendTemplate: sendTemplateMessage,
    sendAttachment,
    resend,
    confirming,
    confirmResend,
    cancelResend,
  }
}
