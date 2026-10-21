import prisma from "@/lib/db/prisma"

/**
 * `onSent` hook for AI messages (registered by `registerAiTurnWorkers`). The send job calls it
 * after a message reaches SENT, possibly more than once, so both writes are guarded and
 * idempotent:
 * - `lastAiSentAt` only moves forward (echo takeover compares phone echoes against it);
 * - consent evidence (AI-5, S-AI-12): `consentNoticeSentAt` is set once, and only when the message
 *   that carried the notice was sent. A carrier that FAILED never gets here, so the next turn
 *   prefixes the notice again.
 */
export async function recordAiMessageSent(messageId: string): Promise<void> {
  const message = await prisma.whatsAppMessage.findUnique({
    where: { id: messageId },
    select: { id: true, source: true, conversationId: true, sentAt: true },
  })
  if (!message || message.source !== "AI") return
  const sentAt = message.sentAt ?? new Date()

  await prisma.conversation.updateMany({
    where: { id: message.conversationId, OR: [{ lastAiSentAt: null }, { lastAiSentAt: { lt: sentAt } }] },
    data: { lastAiSentAt: sentAt },
  })
  await prisma.conversation.updateMany({
    where: { id: message.conversationId, consentNoticeMessageId: message.id, consentNoticeSentAt: null },
    data: { consentNoticeSentAt: sentAt },
  })
}
