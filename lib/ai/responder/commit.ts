import { Prisma } from "@prisma/client"
import prisma from "@/lib/db/prisma"
import { getNotifyPort } from "@/lib/notifications/port"
import { touchConversation } from "@/lib/whatsapp/outbound"
import { createOutboundMessage, enqueueOutboundSend } from "@/lib/whatsapp/send"
import { applyTransition } from "@/lib/whatsapp/transitions"
import { prefixConsent } from "./consent"
import type { EscalationReason } from "./escalation"

/**
 * The only place an AI turn writes (CH-5, S-CH-2, S-AI-8). The model call happens outside any
 * transaction; its result is committed here under `SELECT … FOR UPDATE` on the conversation, and
 * only if nothing changed while the model was thinking: still AI, same `stateVersion` (a person
 * taking over, a pause or a close bumps it), AI still on, and no newer client message. Otherwise
 * the reply is discarded and nothing is sent. The outbound row carries the decided version, so
 * the send job also drops it if the state moves before delivery. Jobs and notifications run only
 * after the commit.
 */

export interface TurnSnapshot {
  conversationId: string
  /** `stateVersion` read before the model call. */
  stateVersion: number
  /** Timestamp of the newest client message this turn answers; becomes `aiCursorAt`. */
  newestPendingAt: Date
}

export type DiscardReason = "NOT_AI" | "VERSION" | "PAUSED" | "AI_OFF" | "NEWER_INBOUND"

interface LockedConversation {
  status: string
  stateVersion: number
  aiPaused: boolean
  consentNoticeSentAt: Date | null
}

type Tx = Prisma.TransactionClient

async function lockConversation(tx: Tx, conversationId: string): Promise<LockedConversation | null> {
  const rows = await tx.$queryRaw<LockedConversation[]>(Prisma.sql`
    SELECT id, status, "stateVersion", "aiPaused", "consentNoticeSentAt"
    FROM conversations WHERE id = ${conversationId} FOR UPDATE`)
  return rows[0] ?? null
}

async function checkStillOurs(
  tx: Tx,
  snapshot: TurnSnapshot,
  options: { globalAi: boolean; ignoreNewerInbound: boolean; checkVersion: boolean }
): Promise<{ ok: true; conversation: LockedConversation } | { ok: false; reason: DiscardReason }> {
  const conversation = await lockConversation(tx, snapshot.conversationId)
  if (!conversation || conversation.status !== "AI") return { ok: false, reason: "NOT_AI" }
  if (options.checkVersion && conversation.stateVersion !== snapshot.stateVersion) return { ok: false, reason: "VERSION" }
  if (conversation.aiPaused) return { ok: false, reason: "PAUSED" }
  if (!options.globalAi) return { ok: false, reason: "AI_OFF" }
  if (!options.ignoreNewerInbound) {
    const newer = await tx.whatsAppMessage.count({
      where: { conversationId: snapshot.conversationId, direction: "IN", timestamp: { gt: snapshot.newestPendingAt } },
    })
    if (newer > 0) return { ok: false, reason: "NEWER_INBOUND" }
  }
  return { ok: true, conversation }
}

/** Writes the AI message (with the consent prefix while the notice was never delivered). */
async function writeAiMessage(
  tx: Tx,
  input: {
    snapshot: TurnSnapshot
    conversation: LockedConversation
    text: string
    sourceChunkIds: string[]
    usageRecordId: string | null
    expectedStateVersion: number
    siteUrl: string
    now: Date
    extraConversationData?: Prisma.ConversationUpdateInput
  }
): Promise<string> {
  const text = prefixConsent(input.text, input.conversation.consentNoticeSentAt, input.siteUrl)
  const carriesNotice = input.conversation.consentNoticeSentAt === null
  const message = await createOutboundMessage(
    {
      kind: "text",
      conversationId: input.snapshot.conversationId,
      source: "AI",
      text,
      sourceChunkIds: input.sourceChunkIds,
      usageRecordId: input.usageRecordId,
      expectedStateVersion: input.expectedStateVersion,
    },
    tx
  )
  await tx.conversation.update({
    where: { id: input.snapshot.conversationId },
    data: {
      aiCursorAt: input.snapshot.newestPendingAt,
      ...input.extraConversationData,
      ...(carriesNotice ? { consentNoticeMessageId: message.id } : {}),
    },
  })
  await touchConversation(tx, input.snapshot.conversationId, { type: "TEXT", text }, input.now)
  return message.id
}

async function enqueueAfterCommit(messageId: string, expectedStateVersion: number): Promise<void> {
  try {
    await enqueueOutboundSend({ messageId, expectedStateVersion })
  } catch {
    // The row is already FAILED (QUEUE_UNAVAILABLE) and shows in the thread for staff.
    console.error(`[ai] could not enqueue AI message ${messageId}`)
  }
}

export type CommitResult = { status: "QUEUED"; messageId: string } | { status: "DISCARDED"; reason: DiscardReason }

/** Commits a reply (an answer, a clarification, the guard fallback or a deterministic text). */
export async function commitAiReply(input: {
  snapshot: TurnSnapshot
  text: string
  sourceChunkIds: string[]
  usageRecordId: string | null
  /** Consecutive failures after this turn: 0 for a good reply, +1 for the fallback. */
  consecutiveFailures: number
  globalAi: boolean
  /** After two discards in a row the turn answers anyway, so a chatty client still gets a reply. */
  ignoreNewerInbound: boolean
  siteUrl: string
  now: Date
}): Promise<CommitResult> {
  const result = await prisma.$transaction(async (tx): Promise<CommitResult> => {
    const check = await checkStillOurs(tx, input.snapshot, {
      globalAi: input.globalAi,
      ignoreNewerInbound: input.ignoreNewerInbound,
      checkVersion: true,
    })
    if (!check.ok) return { status: "DISCARDED", reason: check.reason }
    const messageId = await writeAiMessage(tx, {
      ...input,
      conversation: check.conversation,
      expectedStateVersion: input.snapshot.stateVersion,
      extraConversationData: { consecutiveAiFailures: input.consecutiveFailures },
    })
    return { status: "QUEUED", messageId }
  })
  if (result.status === "QUEUED") await enqueueAfterCommit(result.messageId, input.snapshot.stateVersion)
  return result
}

export type EscalationResult = { status: "ESCALATED"; messageId: string } | { status: "DISCARDED"; reason: DiscardReason }

/**
 * Hands the conversation to staff (AI-9): AI_ESCALATE through the state machine (only from AI,
 * S-CH-8), the handoff text under the new version, then the staff notification. A newer client
 * message does not stop an escalation: it reaches the same person.
 */
export async function commitAiEscalation(input: {
  snapshot: TurnSnapshot
  reason: EscalationReason
  outOfHours: boolean
  attentionDueAt: Date
  text: string
  usageRecordId: string | null
  globalAi: boolean
  siteUrl: string
  now: Date
}): Promise<EscalationResult> {
  const result = await prisma.$transaction(async (tx): Promise<(EscalationResult & { version?: number })> => {
    const check = await checkStillOurs(tx, input.snapshot, {
      // An AI failure still escalates while AI is being switched off, so the client is not left waiting.
      globalAi: input.globalAi || input.reason === "AI_FAILURE",
      ignoreNewerInbound: true,
      checkVersion: false,
    })
    if (!check.ok) return { status: "DISCARDED", reason: check.reason }
    const moved = await applyTransition(
      {
        conversationId: input.snapshot.conversationId,
        event: "AI_ESCALATE",
        actor: "AI",
        escalation: { reason: input.reason, outOfHours: input.outOfHours, attentionDueAt: input.attentionDueAt },
      },
      { db: tx, now: () => input.now }
    )
    if (!moved.ok) return { status: "DISCARDED", reason: "NOT_AI" }
    const messageId = await writeAiMessage(tx, {
      ...input,
      conversation: check.conversation,
      sourceChunkIds: [],
      expectedStateVersion: moved.stateVersion,
    })
    return { status: "ESCALATED", messageId, version: moved.stateVersion }
  })
  if (result.status !== "ESCALATED") return result

  await enqueueAfterCommit(result.messageId, result.version!)
  try {
    await getNotifyPort().notify(
      input.reason === "AI_FAILURE"
        ? { type: "AI_FAILURE", conversationId: input.snapshot.conversationId }
        : { type: "ESCALATION", conversationId: input.snapshot.conversationId, escalatedAt: input.now }
    )
  } catch {
    console.error("[ai] escalation notification failed; the conversation is escalated")
  }
  return { status: "ESCALATED", messageId: result.messageId }
}
