import type { Job } from "pg-boss"
import { Prisma, type MessageSource } from "@prisma/client"
import { getWhatsAppConfig } from "@/lib/config/runtime-config"
import prisma from "@/lib/db/prisma"
import { getBoss } from "@/lib/queue/boss"
import { QUEUES, QUEUE_DEFINITIONS } from "@/lib/queue/queues"
import { CloudApiError, sendTemplate, sendText } from "./cloud-api"
import { isWhatsAppEnabled } from "./ingest"
import { applyStoredStatuses } from "./statuses"
import { resolveTemplate } from "./templates"
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

export type OutboundInput =
  | (OutboundBase & { kind: "text"; text: string })
  | (OutboundBase & { kind: "template"; templateKey: string; params: string[] })

export interface SendJobData {
  messageId: string
  expectedStateVersion?: number
}

export class TemplateNotApprovedError extends Error {
  readonly name = "TemplateNotApprovedError"
  constructor(key: string) {
    super(`Template "${key}" is not approved or not configured`)
  }
}

/** Error codes stored on FAILED outbound messages (alongside Meta's numeric codes). */
export const SendErrorCode = {
  WINDOW_CLOSED: "WINDOW_CLOSED",
  STALE_STATE: "STALE_STATE",
  RETRIES_EXHAUSTED: "RETRIES_EXHAUSTED",
  QUEUE_UNAVAILABLE: "QUEUE_UNAVAILABLE",
  INVALID_MESSAGE: "INVALID_MESSAGE",
} as const

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

  // Templates are validated here too, so an unapproved template never reaches the outbox (WI-10).
  const template = resolveTemplate(input.templateKey, getWhatsAppConfig().templates)
  if (!template) throw new TemplateNotApprovedError(input.templateKey)
  if (input.params.length !== template.paramCount || input.params.some((param) => !param.trim())) {
    throw new Error(`Template "${template.key}" expects ${template.paramCount} non-empty parameter(s)`)
  }
  return db.whatsAppMessage.create({
    data: { ...base, type: "TEMPLATE", templateName: template.name, templateParams: input.params },
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
  | { kind: "sent"; wamid: string }

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
          conversation: { select: { stateVersion: true, lastInboundAt: true, contact: { select: { waId: true } } } },
        },
      })
      if (!message || message.direction !== "OUT") return { kind: "skipped" }
      // A redelivered job for a message that already left: never send twice.
      if (message.wamid) return { kind: "already-sent", wamid: message.wamid }
      if (message.status !== "QUEUED") return { kind: "skipped" }

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

      const to = conversation.contact.waId
      try {
        if (message.type === "TEXT" && message.text?.trim()) {
          const { wamid } = await sendText(to, message.text, { contextWamid: message.contextWamid })
          return { kind: "sent", wamid }
        }
        if (message.type === "TEMPLATE" && message.templateName) {
          const params = Array.isArray(message.templateParams)
            ? message.templateParams.filter((param): param is string => typeof param === "string")
            : []
          const { wamid } = await sendTemplate(to, {
            name: message.templateName,
            language: getWhatsAppConfig().templates.language,
            params,
          })
          return { kind: "sent", wamid }
        }
        await markFailed(tx, message.id, SendErrorCode.INVALID_MESSAGE, "El mensaje no se puede enviar por este canal.")
        return { kind: "failed" }
      } catch (error) {
        if (!(error instanceof CloudApiError)) throw error
        if (error.retryable && !context.isLastAttempt) throw error // pg-boss retries with backoff
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
    return
  }
  if (outcome.kind !== "sent") return

  const persisted = await persistSent(data.messageId, outcome.wamid, now())
  if (!persisted) return

  await applyStoredStatuses(outcome.wamid)
  if (onSentHook) {
    try {
      await onSentHook(data.messageId)
    } catch {
      console.error(`[whatsapp] onSent hook failed for message ${data.messageId}`)
    }
  }
}

/**
 * Records the wamid Meta returned (WC-11). Runs AFTER the send, outside the lock: if this
 * keeps failing the job must not throw, because a retry would send the message twice.
 * At-most-once is the safer failure mode; the id is logged so an operator can reconcile.
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
