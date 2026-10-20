import { randomUUID } from "node:crypto"
import { getWhatsAppConfig } from "@/lib/config/runtime-config"
import prisma from "@/lib/db/prisma"
import { deleteObjects, putObject } from "@/lib/storage/r2"
import type { ActionResponse } from "@/lib/types/auth.types"
import { bytesMatchMime, validateAttachment, type AttachmentKind } from "./attachments"
import { ComposerError, evaluateResend, replyBlockedReason, resendNeedsConfirmation } from "./composer"
import { isWhatsAppEnabled } from "./ingest"
import { messagePreview } from "./inbound"
import { createOutboundMessage, enqueueOutboundSend, type OutboundFile, type OutboundInput } from "./send"
import { isTemplateKey, renderTemplateBody, resolveTemplate, validateTemplateParams, type TemplateKey } from "./templates"
import { applyTransition } from "./transitions"

/**
 * Dashboard sends (WI-6, WI-7, WI-10, WC-13, D6). The Server Actions and the attachment route
 * are thin: they authorize and validate, then call these functions, which are NOT exported from
 * a 'use server' file and so are not public endpoints.
 *
 * A reply is atomic with the conversation handoff: the DASHBOARD_REPLY transition (-> HUMAN) and
 * the outbox row are written in ONE transaction, so there is no moment where the message exists
 * but the AI may still answer, or the conversation moved without a message (CH-4). The job is
 * enqueued after the commit and carries the resulting state version, so a message that was
 * overtaken by a later handoff (close, return to AI) is cancelled instead of delivered.
 *
 * The 24 h window and the CLOSED rule are enforced here (and again by the send job) with the same
 * pure functions the composer uses (composer.ts).
 */

type Result<T> = ActionResponse<T>
export interface Sent {
  messageId: string
}

const NOT_FOUND = "Conversación no encontrada"
const GENERIC = "No se pudo enviar el mensaje"

/** Thrown inside a transaction to roll it back with a user-facing reason. */
class Abort extends Error {
  constructor(readonly userMessage: string) {
    super(userMessage)
  }
}

function fail<T>(error: string): Result<T> {
  return { success: false, error }
}

function transitionError(code: string): string {
  if (code === "CONFLICT") return "La conversación cambió mientras respondía. Intente de nuevo."
  if (code === "NOT_FOUND") return NOT_FOUND
  return ComposerError.CLOSED_CONVERSATION
}

type OutboundDraft =
  | { kind: "text"; text: string }
  | { kind: "template"; templateKey: TemplateKey; params: string[] }
  | { kind: "media"; mediaType: "IMAGE" | "DOCUMENT"; caption: string | null; file: OutboundFile }

/** Forward-only counters, like inbound and echoes: the list shows the reply and re-sorts. */
async function touchConversation(
  tx: Pick<typeof prisma, "conversation">,
  conversationId: string,
  draft: { type: Parameters<typeof messagePreview>[0]["type"]; text: string | null },
  now: Date
): Promise<void> {
  await tx.conversation.updateMany({
    where: { id: conversationId, lastMessageAt: { lte: now } },
    data: { lastMessageAt: now, lastMessagePreview: messagePreview(draft) },
  })
}

function previewShape(draft: OutboundDraft): { type: "TEXT" | "TEMPLATE" | "IMAGE" | "DOCUMENT"; text: string | null } {
  if (draft.kind === "text") return { type: "TEXT", text: draft.text }
  if (draft.kind === "template") return { type: "TEMPLATE", text: renderTemplateBody(draft.templateKey, draft.params) }
  return { type: draft.mediaType, text: draft.caption ?? null }
}

async function enqueue(messageId: string, expectedStateVersion: number): Promise<Result<Sent>> {
  try {
    await enqueueOutboundSend({ messageId, expectedStateVersion })
    return { success: true, data: { messageId } }
  } catch {
    // The row was already marked FAILED (QUEUE_UNAVAILABLE) and is resendable from the thread.
    console.error(`[whatsapp] could not enqueue message ${messageId}`)
    return fail(ComposerError.QUEUE_FAILED)
  }
}

async function queueDashboardMessage(input: {
  conversationId: string
  userId: string
  draft: OutboundDraft
  now?: Date
}): Promise<Result<Sent>> {
  const now = input.now ?? new Date()
  const template = input.draft.kind === "template"

  try {
    const committed = await prisma.$transaction(async (tx) => {
      const conversation = await tx.conversation.findUnique({
        where: { id: input.conversationId },
        select: { status: true, lastInboundAt: true },
      })
      if (!conversation) throw new Abort(NOT_FOUND)

      const blocked = replyBlockedReason({ ...conversation, now, template })
      if (blocked) throw new Abort(blocked)

      const handoff = await applyTransition(
        { conversationId: input.conversationId, event: "DASHBOARD_REPLY", actor: "USER", actorUserId: input.userId },
        { db: tx, now: () => now }
      )
      if (!handoff.ok) throw new Abort(transitionError(handoff.code))

      const message = await createOutboundMessage(
        {
          ...input.draft,
          conversationId: input.conversationId,
          source: "DASHBOARD",
          sentById: input.userId,
          expectedStateVersion: handoff.stateVersion,
        } satisfies OutboundInput,
        tx
      )
      await touchConversation(tx, input.conversationId, previewShape(input.draft), now)
      return { messageId: message.id, stateVersion: handoff.stateVersion }
    })

    return enqueue(committed.messageId, committed.stateVersion)
  } catch (error) {
    if (error instanceof Abort) return fail(error.userMessage)
    console.error("[whatsapp] dashboard send failed")
    return fail(GENERIC)
  }
}

/** Free-text reply (WI-6, WI-7). */
export async function sendReplyMessage(input: {
  conversationId: string
  userId: string
  text: string
}): Promise<Result<Sent>> {
  if (!isWhatsAppEnabled()) return fail(ComposerError.CHANNEL_DISABLED)
  return queueDashboardMessage({
    conversationId: input.conversationId,
    userId: input.userId,
    draft: { kind: "text", text: input.text.trim() },
  })
}

/** Approved template (WI-10, S-WI-8). Unknown or unapproved templates never reach the outbox. */
export async function sendTemplateMessage(input: {
  conversationId: string
  userId: string
  templateKey: string
  params: string[]
}): Promise<Result<Sent>> {
  if (!isWhatsAppEnabled()) return fail(ComposerError.CHANNEL_DISABLED)

  let template
  try {
    template = resolveTemplate(input.templateKey, getWhatsAppConfig().templates)
  } catch {
    return fail("La configuración de plantillas no es válida")
  }
  if (!template || !isTemplateKey(input.templateKey)) return fail("Plantilla no disponible")

  const params = validateTemplateParams(template.key, input.params)
  if (!params.ok) return fail(params.error)

  return queueDashboardMessage({
    conversationId: input.conversationId,
    userId: input.userId,
    draft: { kind: "template", templateKey: template.key, params: params.params },
  })
}

const MEDIA_TYPE: Record<AttachmentKind, "IMAGE" | "DOCUMENT"> = { image: "IMAGE", document: "DOCUMENT" }

/** Image or PDF attachment with an optional caption (WC-10); inside the 24 h window only. */
export async function sendMediaReply(input: {
  conversationId: string
  userId: string
  caption?: string | null
  file: { name: string | null; type: string | null; size: number; bytes: () => Promise<Uint8Array> }
}): Promise<Result<Sent>> {
  if (!isWhatsAppEnabled()) return fail(ComposerError.CHANNEL_DISABLED)

  const checked = validateAttachment({ mimeType: input.file.type, sizeBytes: input.file.size, fileName: input.file.name })
  if (!checked.ok) return fail(checked.error)
  const { attachment } = checked

  // Cheap pre-check so a closed window or conversation does not cost an upload; the transaction re-checks.
  const conversation = await prisma.conversation.findUnique({
    where: { id: input.conversationId },
    select: { status: true, lastInboundAt: true },
  })
  if (!conversation) return fail(NOT_FOUND)
  const blocked = replyBlockedReason({ ...conversation, now: new Date(), template: false })
  if (blocked) return fail(blocked)

  const bytes = await input.file.bytes()
  // The declared type is a claim; the bytes decide (a renamed HTML or script is refused here).
  if (bytes.byteLength !== input.file.size || !bytesMatchMime(attachment.mimeType, bytes)) {
    return fail("El contenido del archivo no coincide con su tipo")
  }

  const s3Key = `whatsapp/${input.conversationId}/out/${randomUUID()}.${attachment.extension}`
  try {
    await putObject(s3Key, bytes, attachment.mimeType)
  } catch {
    console.error("[whatsapp] could not store an outbound attachment")
    return fail("No se pudo guardar el archivo")
  }

  const result = await queueDashboardMessage({
    conversationId: input.conversationId,
    userId: input.userId,
    draft: {
      kind: "media",
      mediaType: MEDIA_TYPE[attachment.kind],
      caption: input.caption?.trim() || null,
      file: { s3Key, mimeType: attachment.mimeType, fileName: attachment.fileName, sizeBytes: bytes.byteLength },
    },
  })
  // A row exists only when the transaction committed; otherwise the object is an orphan.
  if (!result.success && !(await messageUsesKey(s3Key))) {
    await deleteObjects([s3Key]).catch(() => undefined)
  }
  return result
}

async function messageUsesKey(s3Key: string): Promise<boolean> {
  try {
    return (await prisma.whatsAppMedia.count({ where: { s3Key } })) > 0
  } catch {
    // Unknown: keep the object rather than risk deleting a file a message points to.
    return true
  }
}

/**
 * Sends a FAILED dashboard message again (S-WI-9, D6). The same row goes back to QUEUED with its
 * error and attempt marker cleared (the at-most-once marker is what would otherwise turn the
 * retry into an UNKNOWN_DELIVERY), and `resendCount` counts the manual retries. A message whose
 * delivery is unconfirmed may already have reached the customer, so it needs `confirmUnknownDelivery`.
 *
 * A row that already carries a wamid (Meta accepted it and reported a later failure) gets the
 * wamid cleared, because the send job treats any row with a wamid as already sent.
 */
export async function resendMessage(input: {
  messageId: string
  userId: string
  confirmUnknownDelivery: boolean
  now?: Date
}): Promise<Result<Sent>> {
  if (!isWhatsAppEnabled()) return fail(ComposerError.CHANNEL_DISABLED)
  const now = input.now ?? new Date()

  try {
    const committed = await prisma.$transaction(async (tx) => {
      const message = await tx.whatsAppMessage.findUnique({
        where: { id: input.messageId },
        select: {
          id: true,
          conversationId: true,
          direction: true,
          source: true,
          status: true,
          type: true,
          text: true,
          errorCode: true,
          conversation: { select: { status: true, lastInboundAt: true } },
        },
      })
      if (!message) throw new Abort("Mensaje no encontrado")

      const decision = evaluateResend({
        message,
        conversationStatus: message.conversation.status,
        lastInboundAt: message.conversation.lastInboundAt,
        now,
      })
      if (!decision.ok) throw new Abort(decision.message)
      if (resendNeedsConfirmation(message.errorCode) && !input.confirmUnknownDelivery) {
        throw new Abort("Este mensaje pudo haber sido entregado. Confirme que desea enviarlo de nuevo.")
      }

      // Guarded on FAILED so a double click (or two people) queues it once.
      const reset = await tx.whatsAppMessage.updateMany({
        where: { id: message.id, direction: "OUT", source: "DASHBOARD", status: "FAILED" },
        data: {
          status: "QUEUED",
          statusRank: 0,
          errorCode: null,
          errorMessage: null,
          sendAttemptedAt: null,
          wamid: null,
          sentAt: null,
          timestamp: now,
          sentById: input.userId,
          resendCount: { increment: 1 },
        },
      })
      if (reset.count === 0) throw new Abort("El mensaje ya no está fallido")

      const handoff = await applyTransition(
        { conversationId: message.conversationId, event: "DASHBOARD_REPLY", actor: "USER", actorUserId: input.userId },
        { db: tx, now: () => now }
      )
      if (!handoff.ok) throw new Abort(transitionError(handoff.code))

      await touchConversation(tx, message.conversationId, { type: message.type, text: message.text }, now)
      return { messageId: message.id, stateVersion: handoff.stateVersion }
    })

    return enqueue(committed.messageId, committed.stateVersion)
  } catch (error) {
    if (error instanceof Abort) return fail(error.userMessage)
    console.error("[whatsapp] resend failed")
    return fail(GENERIC)
  }
}
