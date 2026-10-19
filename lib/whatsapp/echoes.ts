import type { Job } from "pg-boss"
import prisma from "@/lib/db/prisma"
import { getBoss } from "@/lib/queue/boss"
import { QUEUES, QUEUE_SEND_DEFAULTS } from "@/lib/queue/queues"
import { normalizeWaId } from "@/lib/utils/phone"
import { upsertAndMatchContact } from "./contacts"
import {
  enqueueMediaDownload,
  getOrCreateConversation,
  messagePreview,
  parseInboundMessage,
  type ParsedInboundMessage,
} from "./inbound"
import { isWhatsAppEnabled } from "./ingest"
import { applyStoredStatuses } from "./statuses"
import { applyTransitionPort } from "./transition-port"
import { asRecord, isUniqueViolation } from "./utils"

/**
 * Coexistence echo reconciliation (design D7, WC-8, CH-9, CH-10). An echo is a message the
 * business sent that Meta mirrors back to us. Two very different things look alike:
 *
 *  - our own API sends (AI, dashboard, system), identified by their stored wamid;
 *  - messages typed on the phone app, which mean a person took over the chat.
 *
 * Only the second moves the conversation to HUMAN.
 *
 * ASSUMPTION (closed by task 1.4.8 on a live Coexistence number): the echo item arrives in
 * `smb_message_echoes` -> `value.message_echoes[]` with the customer in `to`, and Cloud API
 * sends may or may not be echoed. The rules below are correct either way.
 */

/** An unmatched echo with a queued outbound this young may be our own send whose wamid is not stored yet. */
export const ECHO_IN_FLIGHT_WINDOW_MS = 120_000
/** Re-checks before an unmatched echo is accepted as a phone-app message (wa.echo.reconcile: 5 s, max 3). */
export const ECHO_RECONCILE_MAX_ATTEMPTS = 3

/**
 * CH-9: a human echo takes over unless it is OLDER than the last AI send. An out-of-order
 * old echo is stored and audited but cannot undo a later AI turn's state.
 */
export function shouldEchoTakeOver(echoAt: Date, lastAiSentAt: Date | null): boolean {
  return lastAiSentAt === null || echoAt.getTime() >= lastAiSentAt.getTime()
}

export interface ReconcileJobData {
  eventId: string
  /** 1-based re-check number; the first pass (attempt 0) runs in the event processor. */
  attempt: number
}

export type EchoOutcome =
  /** The wamid is already stored: our own send, or a redelivery. No transition (CH-10, S-CH-3). */
  | "own"
  /** A queued send may be this echo; a `wa.echo.reconcile` re-check was scheduled. */
  | "reconcile-scheduled"
  /** Stored as OUT/PHONE_APP and the conversation moved to HUMAN (S-WC-6, S-CH-1). */
  | "stored-takeover"
  /** Stored as OUT/PHONE_APP without a state change (older echo, or already HUMAN/CLOSED). */
  | "stored"
  | "skipped"

export interface ProcessEchoOptions {
  eventId: string
  /** 0 for the first pass, 1..ECHO_RECONCILE_MAX_ATTEMPTS for `wa.echo.reconcile` re-checks. */
  attempt?: number
  receivedAt?: Date
  now?: Date
}

async function scheduleReconcile(data: ReconcileJobData): Promise<void> {
  const boss = await getBoss()
  await boss.send(QUEUES.ECHO_RECONCILE, data, {
    ...QUEUE_SEND_DEFAULTS[QUEUES.ECHO_RECONCILE],
    singletonKey: `${data.eventId}:${data.attempt}`,
  })
}

/**
 * Classifies and applies one stored echo. Idempotent: safe to run again after a partial
 * failure (the transition is guarded, the insert is keyed by wamid). Throws on I/O errors
 * so the raw event is retried.
 */
export async function processEcho(payload: unknown, options: ProcessEchoOptions): Promise<EchoOutcome> {
  const attempt = options.attempt ?? 0
  const receivedAt = options.receivedAt ?? new Date()
  const now = options.now ?? new Date()

  const context = asRecord(payload)
  const raw = asRecord(context?.item)
  const customerWaId = normalizeWaId(typeof raw?.to === "string" ? raw.to : null)
  // The echo's `from` is the business number; parseInboundMessage only needs some sender to accept the item.
  const echo = parseInboundMessage(raw ? { ...raw, from: raw.from ?? raw.to } : null, receivedAt)
  if (!echo || !customerWaId) {
    console.warn("[whatsapp] echo item has no id or recipient; skipped")
    return "skipped"
  }

  // 1. A stored wamid is either our own send (no transition, CH-10) or a phone echo that an
  //    earlier run already inserted but may not have finished (crash between insert and
  //    takeover). Only the second is finished again; both are idempotent.
  const known = await findStoredEcho(echo.wamid)
  if (known) {
    return known.source === "PHONE_APP" ? finishStoredEcho(known, echo) : "own"
  }

  // 2. Resolve the chat. A person may write first from the phone, so the contact and its
  //    conversation can be created here (HUMAN: a human already started it).
  const contact =
    (await prisma.whatsAppContact.findUnique({ where: { waId: customerWaId } })) ??
    (await upsertAndMatchContact({ waId: customerWaId, seenAt: echo.timestamp }))
  const conversation = await getOrCreateConversation(contact, echo.timestamp, {
    status: "HUMAN",
    event: "ECHO_FIRST_CONTACT",
    actor: "PHONE_APP",
  })

  // 3. A queued send of ours that has no wamid yet may be this very message. Wait and re-check.
  const inFlight = await prisma.whatsAppMessage.findFirst({
    where: {
      conversationId: conversation.id,
      direction: "OUT",
      status: "QUEUED",
      wamid: null,
      createdAt: { gte: new Date(now.getTime() - ECHO_IN_FLIGHT_WINDOW_MS) },
    },
    select: { id: true },
  })
  if (inFlight && attempt < ECHO_RECONCILE_MAX_ATTEMPTS) {
    await scheduleReconcile({ eventId: options.eventId, attempt: attempt + 1 })
    return "reconcile-scheduled"
  }

  // 4. Insert first. The unique wamid is the arbiter between "phone echo" and "our own send":
  //    if our send stored its wamid after the checks above (the race between the known-wamid
  //    lookup and the in-flight lookup), the insert hits P2002 and we are done without a
  //    takeover. Only a successful insert proves this is a phone-app message.
  let messageId: string
  try {
    const created = await prisma.whatsAppMessage.create({
      data: {
        conversationId: conversation.id,
        wamid: echo.wamid,
        direction: "OUT",
        source: "PHONE_APP",
        type: echo.type,
        text: echo.text,
        status: "SENT",
        statusRank: 1,
        contextWamid: echo.contextWamid,
        timestamp: echo.timestamp,
        sentAt: echo.timestamp,
        ...(echo.media
          ? {
              media: {
                create: {
                  metaMediaId: echo.media.metaMediaId,
                  mimeType: echo.media.mimeType,
                  sha256: echo.media.sha256,
                  fileName: echo.media.fileName,
                  status: "PENDING",
                },
              },
            }
          : {}),
      },
      select: { id: true },
    })
    messageId = created.id
  } catch (error) {
    if (!isUniqueViolation(error)) throw error
    // Someone stored this wamid first: our own send, or a concurrent delivery of this very echo.
    const winner = await findStoredEcho(echo.wamid)
    return winner?.source === "PHONE_APP" ? finishStoredEcho(winner, echo) : "own"
  }

  // 5. The takeover. If the process dies between the insert and here, the redelivery lands in
  //    step 1, sees our PHONE_APP row and finishes the takeover (the transition is guarded).
  const movedToHuman = await completeEcho(conversation, messageId, echo)

  if (!shouldEchoTakeOver(echo.timestamp, conversation.lastAiSentAt) && (conversation.status === "AI" || conversation.status === "ESCALATED")) {
    // Older than the last AI send (S-CH-1 / CH-9): kept and audited, but the state stays.
    await prisma.conversationEvent.create({
      data: {
        conversationId: conversation.id,
        fromStatus: conversation.status,
        toStatus: conversation.status,
        event: "ECHO_OUT_OF_ORDER",
        actor: "PHONE_APP",
        reason: `echo:${echo.wamid}`,
      },
    })
  }

  return movedToHuman ? "stored-takeover" : "stored"
}

type ParsedEcho = ParsedInboundMessage

interface StoredEcho {
  id: string
  source: string
  conversation: { id: string; status: string; lastAiSentAt: Date | null }
}

async function findStoredEcho(wamid: string): Promise<StoredEcho | null> {
  const stored = await prisma.whatsAppMessage.findUnique({
    where: { wamid },
    select: { id: true, source: true, conversation: { select: { id: true, status: true, lastAiSentAt: true } } },
  })
  return stored as StoredEcho | null
}

/** Re-runs the idempotent tail for a phone echo that was inserted by an earlier or concurrent run. */
async function finishStoredEcho(stored: StoredEcho, echo: ParsedEcho): Promise<EchoOutcome> {
  const moved = await completeEcho(stored.conversation, stored.id, echo)
  return moved ? "stored-takeover" : "stored"
}

/**
 * Everything that follows the insert of a phone echo, all idempotent: the guarded HUMAN
 * transition, forward-only counters, stored statuses and the media job (singleton per message).
 * Returns true when this call moved the conversation to HUMAN.
 */
async function completeEcho(
  conversation: { id: string; lastAiSentAt: Date | null },
  messageId: string,
  echo: ParsedEcho
): Promise<boolean> {
  let movedToHuman = false
  if (shouldEchoTakeOver(echo.timestamp, conversation.lastAiSentAt)) {
    movedToHuman = await applyTransitionPort({
      conversationId: conversation.id,
      event: "HUMAN_ECHO",
      actor: "PHONE_APP",
      reason: `echo:${echo.wamid}`,
    })
  }

  // Counters only move forward, like inbound; an echo never touches unreadCount or the 24 h window.
  await prisma.conversation.updateMany({
    where: { id: conversation.id, lastMessageAt: { lte: echo.timestamp } },
    data: { lastMessageAt: echo.timestamp, lastMessagePreview: messagePreview(echo) },
  })

  // A status (delivered/read) may have arrived before the echo created its message row.
  await applyStoredStatuses(echo.wamid)
  if (echo.media) await enqueueMediaDownload(messageId)
  return movedToHuman
}

/** `wa.echo.reconcile` handler: re-runs the classification for a stored echo event. */
export async function handleEchoReconcileJobs(jobs: Job<ReconcileJobData>[]): Promise<void> {
  if (!isWhatsAppEnabled()) return
  for (const job of jobs) {
    const event = await prisma.whatsAppWebhookEvent.findUnique({
      where: { id: job.data.eventId },
      select: { payload: true },
    })
    if (!event) continue
    await processEcho(event.payload, { eventId: job.data.eventId, attempt: job.data.attempt })
  }
}
