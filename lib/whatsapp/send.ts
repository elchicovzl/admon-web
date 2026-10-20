import type { Job } from "pg-boss"
import { Prisma, type MessageSource } from "@prisma/client"
import { getWhatsAppConfig } from "@/lib/config/runtime-config"
import prisma from "@/lib/db/prisma"
import { getBoss } from "@/lib/queue/boss"
import { QUEUES, QUEUE_DEFINITIONS } from "@/lib/queue/queues"
import { getObjectBytes } from "@/lib/storage/r2"
import { MAX_DOCUMENT_BYTES, bytesMatchMime } from "./attachments"
import { CloudApiError, sendMedia, sendTemplate, sendText } from "./cloud-api"
import { isWhatsAppEnabled } from "./ingest"
import { SendErrorCode } from "./send-errors"
import { applyStoredStatuses } from "./statuses"
import { renderTemplateBody, resolveTemplate } from "./templates"
import { isWindowOpen } from "./window"

/**
 * Outbox pipeline (design D6). Every outbound message is first inserted as OUT/QUEUED with
 * no wamid, then a `wa.message.send` job delivers it:
 *
 *   queueOutbound -> row QUEUED (wamid NULL) -> job -> Meta -> wamid + SENT -> stored statuses
 *
 * The job serializes sends per conversation with a transaction-scoped advisory lock and
 * re-checks everything that may have changed since queueing (message state, conversation
 * state version, 24 h window) immediately before calling Meta (CH-4, CH-5, WC-13).
 *
 * DELIVERY GUARANTEE: at-most-once. A WhatsApp message cannot be recalled, and Meta gives us
 * no idempotency key for sends, so a duplicate is worse than a missing message the dashboard
 * can show and a person can resend. The job therefore:
 *
 *   1. commits `sendAttemptedAt` on its OWN connection (outside the lock transaction)
 *      BEFORE it calls Meta;
 *   2. stores the wamid on that same autocommit connection right after Meta answers, so a
 *      failed transaction commit cannot lose it;
 *   3. treats any row that has `sendAttemptedAt` but no wamid on a later run as an unknown
 *      delivery (FAILED / UNKNOWN_DELIVERY): it is NEVER resent automatically and is surfaced
 *      in the thread for manual review. This covers a crash after Meta accepted, a lost
 *      wamid write, and ambiguous errors (timeouts, network, 5xx without a Meta error body).
 *
 * Only a definite rejection (HTTP 429, or any response carrying a Meta error code) clears the
 * marker so pg-boss can retry. `hooks` registered with `setOnSentHook` may run more than once
 * for the same message (a retry after a failed commit re-enters through the already-sent
 * path), so they must be idempotent.
 */

export type OutboundSource = Extract<MessageSource, "AI" | "DASHBOARD" | "SYSTEM">

interface OutboundBase {
  conversationId: string
  source: OutboundSource
  sentById?: string | null
  /** wamid of the client message being answered (quoted reply). */
  contextWamid?: string | null
  /** Knowledge chunks the answer was grounded on (AI-16). */
  sourceChunkIds?: string[]
  usageRecordId?: string | null
  /**
   * Conversation `stateVersion` the sender decided under. When set, the job aborts if the
   * version moved before delivery, so a stale AI reply never goes out after a handoff.
   */
  expectedStateVersion?: number
}

/** An attachment already stored in R2 (the composer uploads it before queueing the message). */
export interface OutboundFile {
  s3Key: string
  mimeType: string
  fileName: string | null
  sizeBytes: number
}

/** `WhatsAppMedia.metaMediaId` is required; outbound files have no Meta id until they are uploaded at send time. */
export const OUTBOUND_MEDIA_ID = "outbound"

export type OutboundInput =
  | (OutboundBase & { kind: "text"; text: string })
  | (OutboundBase & { kind: "template"; templateKey: string; params: string[] })
  | (OutboundBase & { kind: "media"; mediaType: "IMAGE" | "DOCUMENT"; caption?: string | null; file: OutboundFile })

export interface SendJobData {
  messageId: string
  expectedStateVersion?: number
}

export { SendErrorCode }

export class TemplateNotApprovedError extends Error {
  readonly name = "TemplateNotApprovedError"
  constructor(key: string) {
    super(`Template "${key}" is not approved or not configured`)
  }
}

const MAX_ERROR_LENGTH = 300
/** Holds the per-conversation lock across one Meta call; far above the client's 30 s timeout. */
const SEND_TX_TIMEOUT_MS = 45_000
const PERSIST_ATTEMPTS = 3

type Db = Pick<typeof prisma, "whatsAppMessage">

/**
 * Inserts the OUT/QUEUED outbox row without enqueueing, so a caller can do it inside its own
 * transaction (a dashboard reply must be atomic with the HUMAN transition, WI-7) and enqueue
 * after commit with `enqueueOutboundSend`.
 */
export async function createOutboundMessage(input: OutboundInput, db: Db = prisma): Promise<{ id: string }> {
  const base = {
    conversationId: input.conversationId,
    direction: "OUT" as const,
    source: input.source,
    status: "QUEUED" as const,
    statusRank: 0,
    timestamp: new Date(),
    sentById: input.sentById ?? null,
    contextWamid: input.contextWamid ?? null,
    sourceChunkIds: input.sourceChunkIds ?? [],
    usageRecordId: input.usageRecordId ?? null,
  }

  if (input.kind === "text") {
    if (!input.text.trim()) throw new Error("Outbound text must not be empty")
    return db.whatsAppMessage.create({ data: { ...base, type: "TEXT", text: input.text }, select: { id: true } })
  }

  if (input.kind === "media") {
    if (!input.file.s3Key) throw new Error("Outbound media needs a stored file")
    return db.whatsAppMessage.create({
      data: {
        ...base,
        type: input.mediaType,
        text: input.caption?.trim() || null,
        media: {
          create: {
            metaMediaId: OUTBOUND_MEDIA_ID,
            mimeType: input.file.mimeType,
            sizeBytes: input.file.sizeBytes,
            fileName: input.file.fileName,
            s3Key: input.file.s3Key,
            status: "STORED",
          },
        },
      },
      select: { id: true },
    })
  }

  // Templates are validated here too, so an unapproved template never reaches the outbox (WI-10).
  const template = resolveTemplate(input.templateKey, getWhatsAppConfig().templates)
  if (!template) throw new TemplateNotApprovedError(input.templateKey)
  if (input.params.length !== template.paramCount || input.params.some((param) => !param.trim())) {
    throw new Error(`Template "${template.key}" expects ${template.paramCount} non-empty parameter(s)`)
  }
  return db.whatsAppMessage.create({
    data: {
      ...base,
      type: "TEMPLATE",
      templateName: template.name,
      templateParams: input.params,
      // What the customer reads, so the thread shows the message instead of a template name.
      text: renderTemplateBody(template.key, input.params),
    },
    select: { id: true },
  })
}

/**
 * Enqueues delivery for an existing outbox row. If the queue is unavailable the row is
 * marked FAILED (visible and resendable in the thread) instead of staying QUEUED forever.
 */
export async function enqueueOutboundSend(data: SendJobData): Promise<void> {
  try {
    const boss = await getBoss()
    await boss.send(QUEUES.MESSAGE_SEND, data, { singletonKey: data.messageId })
  } catch (error) {
    await markFailed(prisma, data.messageId, SendErrorCode.QUEUE_UNAVAILABLE, "No se pudo encolar el envío.")
    throw error
  }
}

/** Inserts the outbox row and enqueues its delivery (WC-10, WC-11). */
export async function queueOutbound(input: OutboundInput): Promise<{ id: string }> {
  const { id } = await createOutboundMessage(input)
  await enqueueOutboundSend({ messageId: id, expectedStateVersion: input.expectedStateVersion })
  return { id }
}

async function markFailed(
  db: Db,
  messageId: string,
  errorCode: string,
  errorMessage: string
): Promise<void> {
  // Guarded on QUEUED: a message that already left (or failed) is never rewritten.
  await db.whatsAppMessage.updateMany({
    where: { id: messageId, status: "QUEUED" },
    data: { status: "FAILED", statusRank: 4, errorCode, errorMessage: errorMessage.slice(0, MAX_ERROR_LENGTH) },
  })
}

/** Hook for features that need to react to a delivered message (PR3.6b: consent evidence). */
export type OnSentHook = (messageId: string) => Promise<void>

let onSentHook: OnSentHook | undefined

/** Registers the post-SENT hook; pass nothing to clear it. */
export function setOnSentHook(hook?: OnSentHook): void {
  onSentHook = hook
}

type TxOutcome =
  | { kind: "skipped" }
  | { kind: "already-sent"; wamid: string }
  | { kind: "failed" }
  | { kind: "sent"; wamid: string; persisted: boolean }

/**
 * True when Meta definitely did not accept the message, so retrying cannot duplicate it:
 * any response that carried a Meta error code, HTTP 429, or any other 4xx except 408
 * (a gateway 401/403, or a 400 with an unparseable body, still rejected the request).
 * Timeouts (408), network failures and bare 5xx responses are ambiguous: Meta may have
 * accepted the message before failing.
 */
export function isDefiniteRejection(error: CloudApiError): boolean {
  if (error.code !== null) return true
  const { status } = error
  return status !== null && status >= 400 && status < 500 && status !== 408
}

export interface SendContext {
  /** True when pg-boss will not retry this job again. */
  isLastAttempt: boolean
  now?: () => Date
}

/**
 * Delivers one queued message. Retryable provider errors are rethrown so pg-boss retries;
 * on the final attempt they become a FAILED message. Permanent errors mark FAILED and
 * return normally (no pointless retries).
 */
export async function sendOutboundMessage(data: SendJobData, context: SendContext): Promise<void> {
  const queued = await prisma.whatsAppMessage.findUnique({
    where: { id: data.messageId },
    select: { conversationId: true },
  })
  if (!queued) return

  const now = context.now ?? (() => new Date())

  const outcome = await prisma.$transaction(
    async (tx): Promise<TxOutcome> => {
      // Serializes sends within one conversation; released automatically at commit/rollback.
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`wa.send:${queued.conversationId}`}))`)

      const message = await tx.whatsAppMessage.findUnique({
        where: { id: data.messageId },
        select: {
          id: true,
          direction: true,
          status: true,
          wamid: true,
          type: true,
          text: true,
          templateName: true,
          templateParams: true,
          contextWamid: true,
          sendAttemptedAt: true,
          media: { select: { status: true, s3Key: true, mimeType: true, fileName: true } },
          conversation: { select: { stateVersion: true, lastInboundAt: true, contact: { select: { waId: true } } } },
        },
      })
      if (!message || message.direction !== "OUT") return { kind: "skipped" }
      // A redelivered job for a message that already left: never send twice.
      if (message.wamid) return { kind: "already-sent", wamid: message.wamid }
      if (message.status !== "QUEUED") return { kind: "skipped" }

      // A previous run committed its attempt marker but never stored a wamid: Meta may have
      // accepted the message. Never resend (at-most-once); surface it for manual review.
      if (message.sendAttemptedAt) {
        await markFailed(
          tx,
          message.id,
          SendErrorCode.UNKNOWN_DELIVERY,
          "No se pudo confirmar si el mensaje fue entregado. Revise el chat de WhatsApp antes de reenviarlo."
        )
        console.error(`[whatsapp] message ${message.id} has an unconfirmed delivery; not resending`)
        return { kind: "failed" }
      }

      const { conversation } = message

      // Version re-check: the sender decided under a conversation state that has since changed (CH-4, CH-5).
      if (data.expectedStateVersion !== undefined && conversation.stateVersion !== data.expectedStateVersion) {
        await markFailed(tx, message.id, SendErrorCode.STALE_STATE, "Cancelado: la conversación cambió de estado antes del envío.")
        return { kind: "failed" }
      }

      // Defense in depth for WC-13: only templates may leave once the 24 h window is closed.
      if (message.type !== "TEMPLATE" && !isWindowOpen(now(), conversation.lastInboundAt)) {
        await markFailed(
          tx,
          message.id,
          SendErrorCode.WINDOW_CLOSED,
          "La ventana de 24 horas está cerrada; solo se pueden enviar plantillas."
        )
        return { kind: "failed" }
      }

      const isText = message.type === "TEXT" && Boolean(message.text?.trim())
      const isTemplate = message.type === "TEMPLATE" && Boolean(message.templateName)
      const stored = message.media
      const isMedia =
        (message.type === "IMAGE" || message.type === "DOCUMENT") &&
        stored?.status === "STORED" &&
        Boolean(stored.s3Key)
      if (!isText && !isTemplate && !isMedia) {
        await markFailed(tx, message.id, SendErrorCode.INVALID_MESSAGE, "El mensaje no se puede enviar por este canal.")
        return { kind: "failed" }
      }

      // Read the attachment BEFORE the attempt marker: a storage failure sends nothing, so the
      // job can safely retry (and fails visibly on its last attempt).
      let file: { bytes: Uint8Array; mimeType: string; fileName: string | null } | null = null
      if (isMedia && stored?.s3Key) {
        try {
          const bytes = await getObjectBytes(stored.s3Key, MAX_DOCUMENT_BYTES)
          if (!bytesMatchMime(stored.mimeType, bytes)) {
            await markFailed(tx, message.id, SendErrorCode.INVALID_MESSAGE, "El archivo adjunto no es válido.")
            return { kind: "failed" }
          }
          file = { bytes, mimeType: stored.mimeType, fileName: stored.fileName }
        } catch {
          if (!context.isLastAttempt) throw new Error(`Could not read the attachment of message ${message.id}`)
          await markFailed(tx, message.id, SendErrorCode.MEDIA_UNAVAILABLE, "No se pudo leer el archivo adjunto.")
          return { kind: "failed" }
        }
      }

      // Commit the attempt BEFORE Meta is called, on a separate connection: it must survive a
      // rollback or crash of this transaction. If this write fails nothing was sent and the
      // error propagates, so pg-boss retries safely.
      const claimed = await prisma.whatsAppMessage.updateMany({
        where: { id: message.id, wamid: null, status: "QUEUED", sendAttemptedAt: null },
        data: { sendAttemptedAt: now() },
      })
      if (claimed.count === 0) return { kind: "skipped" }

      const to = conversation.contact.waId
      try {
        let wamid: string
        if (file) {
          wamid = (
            await sendMedia(
              to,
              {
                kind: message.type === "IMAGE" ? "image" : "document",
                bytes: file.bytes,
                mimeType: file.mimeType,
                fileName: file.fileName,
                caption: message.text,
              },
              { contextWamid: message.contextWamid }
            )
          ).wamid
        } else if (isText) {
          wamid = (await sendText(to, message.text as string, { contextWamid: message.contextWamid })).wamid
        } else {
          const params = Array.isArray(message.templateParams)
            ? message.templateParams.filter((param): param is string => typeof param === "string")
            : []
          wamid = (
            await sendTemplate(to, {
              name: message.templateName as string,
              language: getWhatsAppConfig().templates.language,
              params,
            })
          ).wamid
        }
        // Store the wamid immediately on the autocommit connection, not at transaction commit.
        const persisted = await persistSent(message.id, wamid, now())
        return { kind: "sent", wamid, persisted }
      } catch (error) {
        if (!(error instanceof CloudApiError)) throw error
        if (!isDefiniteRejection(error)) {
          // Ambiguous: Meta may have accepted it. Keep the marker, never resend, surface it.
          await markFailed(
            tx,
            message.id,
            SendErrorCode.UNKNOWN_DELIVERY,
            "No se pudo confirmar si el mensaje fue entregado. Revise el chat de WhatsApp antes de reenviarlo."
          )
          console.error(`[whatsapp] send of message ${message.id} ended with an ambiguous error; not resending`)
          return { kind: "failed" }
        }
        // Definite rejection: nothing was sent, so the marker can be cleared and a retry is safe.
        if (error.retryable && !context.isLastAttempt) {
          await clearAttempt(message.id)
          throw error // pg-boss retries with backoff
        }
        const code = error.code ?? (error.retryable ? SendErrorCode.RETRIES_EXHAUSTED : String(error.status ?? "UNKNOWN"))
        await markFailed(tx, message.id, code, error.message)
        return { kind: "failed" }
      }
    },
    { timeout: SEND_TX_TIMEOUT_MS, maxWait: 10_000 }
  )

  if (outcome.kind === "already-sent") {
    // Re-applies stored statuses in case the previous attempt died between SENT and this step.
    await applyStoredStatuses(outcome.wamid)
    await runOnSentHook(data.messageId)
    return
  }
  if (outcome.kind !== "sent") return
  if (!outcome.persisted) {
    // Accepted by Meta but the wamid is lost: leave the row visible for manual review instead
    // of QUEUED forever. The wamid goes in the message so an operator can reconcile it.
    await markFailed(
      prisma,
      data.messageId,
      SendErrorCode.UNKNOWN_DELIVERY,
      `Meta aceptó el mensaje pero no se pudo registrar su id (${outcome.wamid}). No se reenviará automáticamente.`
    ).catch(() => undefined)
    return
  }

  await applyStoredStatuses(outcome.wamid)
  await runOnSentHook(data.messageId)
}

async function runOnSentHook(messageId: string): Promise<void> {
  if (!onSentHook) return
  try {
    await onSentHook(messageId)
  } catch {
    console.error(`[whatsapp] onSent hook failed for message ${messageId}`)
  }
}

/** A definite rejection leaves nothing to reconcile, so the next attempt may send. Best effort: a failure here only makes the retry an UNKNOWN_DELIVERY. */
async function clearAttempt(messageId: string): Promise<void> {
  try {
    await prisma.whatsAppMessage.updateMany({
      where: { id: messageId, wamid: null, status: "QUEUED" },
      data: { sendAttemptedAt: null },
    })
  } catch {
    console.error(`[whatsapp] could not clear the send attempt of message ${messageId}`)
  }
}

/**
 * Records the wamid Meta returned (WC-11), right after the send and on its own connection.
 * It must not throw: a retry would find the attempt marker and (correctly) refuse to resend,
 * so the id is logged for an operator instead. Returns false when it could not be stored.
 */
async function persistSent(messageId: string, wamid: string, sentAt: Date): Promise<boolean> {
  for (let attempt = 1; attempt <= PERSIST_ATTEMPTS; attempt++) {
    try {
      await prisma.whatsAppMessage.updateMany({
        where: { id: messageId, wamid: null, status: "QUEUED" },
        data: { wamid, status: "SENT", statusRank: 1, sentAt, errorCode: null, errorMessage: null },
      })
      return true
    } catch {
      // Retry the write only; the message itself was already accepted by Meta.
    }
  }
  console.error(`[whatsapp] message ${messageId} was accepted by Meta but its wamid could not be stored`)
  return false
}

function retryLimitFor(queue: string): number {
  return QUEUE_DEFINITIONS.find((definition) => definition.name === queue)?.retryLimit ?? 0
}

/** `wa.message.send` handler. */
export async function handleSendJobs(jobs: Job<SendJobData>[]): Promise<void> {
  if (!isWhatsAppEnabled()) return // WC-12: never send while the channel is store-only
  const retryLimit = retryLimitFor(QUEUES.MESSAGE_SEND)
  for (const job of jobs) {
    await sendOutboundMessage(job.data, { isLastAttempt: job.retryCount >= retryLimit })
  }
}
