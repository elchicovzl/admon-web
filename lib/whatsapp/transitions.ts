import type { ConversationActor, Prisma } from "@prisma/client"
import prisma from "@/lib/db/prisma"
import {
  transition,
  type ConversationEventType,
  type TransitionRejectedReason,
  type TransitionResult,
} from "./state-machine"
import type { ApplyTransition } from "./transition-port"

/**
 * Applies state-machine transitions to a stored conversation (design D9, spec CH-1..CH-9).
 *
 * Concurrency: every change is `updateMany where { id, stateVersion }` plus a version bump,
 * so two simultaneous transitions (for example a dashboard reply and an AI escalation)
 * cannot both win. The loser re-reads the new state and re-evaluates once; it then either
 * applies cleanly on top of the winner or is rejected by the table, so the conversation ends
 * in exactly one state with a consistent audit trail (S-CH-9). HUMAN has no inactivity
 * timeout: nothing here moves a conversation out of HUMAN on its own (A15, S-CH-4).
 */

type Db = Pick<Prisma.TransactionClient, "conversation" | "conversationEvent">

/** One optimistic retry after losing the version race. */
const MAX_ATTEMPTS = 2

export interface TransitionInput {
  conversationId: string
  event: ConversationEventType
  actor: ConversationActor
  /** The person behind a USER action. */
  actorUserId?: string | null
  reason?: string | null
  /** REOPEN only: where the closed conversation goes. */
  target?: "AI" | "HUMAN"
  /** AI_ESCALATE only: why, and when somebody must look at it (out-of-hours handoff, D12). */
  escalation?: { reason: string; outOfHours?: boolean; attentionDueAt?: Date | null }
}

export interface TransitionOptions {
  /** Run inside the caller's transaction instead of opening one (inbound persistence). */
  db?: Db
  now?: () => Date
}

export type TransitionOutcome =
  | {
      ok: true
      from: TransitionResult["from"]
      to: TransitionResult["to"]
      /** False for valid events that leave the state as it is (no audit row, no version bump). */
      changed: boolean
      stateVersion: number
      scheduleAiTurn: boolean
      notifyActivity: boolean
    }
  | { ok: false; code: "NOT_FOUND" | "CONFLICT" | TransitionRejectedReason; message: string }

/**
 * Global AI eligibility (kill switches, D9): WHATSAPP_AI_ENABLED and WhatsAppSettings.aiEnabled.
 * The per-conversation `aiPaused` switch is applied on top of this by `applyTransition`.
 */
export async function isAiGloballyEnabled(): Promise<boolean> {
  if (process.env.WHATSAPP_AI_ENABLED?.trim() !== "true") return false
  const settings = await prisma.whatsAppSettings.findUnique({
    where: { id: "singleton" },
    select: { aiEnabled: true },
  })
  return settings?.aiEnabled === true
}

const CONFLICT = Symbol("version-conflict")

/** Columns that follow a state change. Kept next to the table so the two stay in step. */
function stateColumns(
  result: TransitionResult,
  input: TransitionInput,
  now: Date
): Prisma.ConversationUncheckedUpdateManyInput {
  const columns: Prisma.ConversationUncheckedUpdateManyInput = {}

  if (result.from === "CLOSED") {
    columns.closedAt = null
    columns.closedById = null
  }
  if (result.from === "ESCALATED") {
    columns.attentionDueAt = null
    columns.escalatedOutOfHours = false
  }

  switch (result.to) {
    case "ESCALATED":
      columns.escalatedAt = now
      columns.escalationReason = input.escalation?.reason ?? input.reason ?? null
      columns.escalatedOutOfHours = input.escalation?.outOfHours ?? false
      columns.attentionDueAt = input.escalation?.attentionDueAt ?? now
      break
    case "CLOSED":
      columns.closedAt = now
      columns.closedById = input.actorUserId ?? null
      break
    case "HUMAN":
      if (input.event === "TAKE" || input.event === "DASHBOARD_REPLY" || input.event === "HUMAN_ECHO") {
        columns.takenOverAt = now
        columns.takenOverById = input.actorUserId ?? null
      }
      break
    case "AI":
      columns.takenOverAt = null
      columns.takenOverById = null
      columns.consecutiveAiFailures = 0
      // A manual hand-back must not make the AI answer the backlog that built up meanwhile (CH-6).
      if (input.event === "RETURN_TO_AI" || input.event === "REOPEN") columns.aiCursorAt = now
      break
  }
  return columns
}

async function attempt(
  db: Db,
  input: TransitionInput,
  globalAi: boolean,
  now: Date
): Promise<TransitionOutcome | typeof CONFLICT> {
  const current = await db.conversation.findUnique({
    where: { id: input.conversationId },
    select: { status: true, stateVersion: true, aiPaused: true },
  })
  if (!current) return { ok: false, code: "NOT_FOUND", message: "Conversation not found" }

  const result = transition(
    current.status,
    input.event,
    { aiEffective: globalAi && !current.aiPaused, target: input.target },
    input.actor
  )
  if (!result.ok) return { ok: false, code: result.reason, message: result.message }

  const base = {
    ok: true as const,
    from: result.from,
    to: result.to,
    scheduleAiTurn: result.scheduleAiTurn,
    notifyActivity: result.notifyActivity,
  }
  if (!result.changed) return { ...base, changed: false, stateVersion: current.stateVersion }

  const updated = await db.conversation.updateMany({
    where: { id: input.conversationId, stateVersion: current.stateVersion },
    data: { status: result.to, stateVersion: { increment: 1 }, ...stateColumns(result, input, now) },
  })
  if (updated.count === 0) return CONFLICT

  await db.conversationEvent.create({
    data: {
      conversationId: input.conversationId,
      fromStatus: result.from,
      toStatus: result.to,
      event: result.auditEvent,
      actor: input.actor,
      actorUserId: input.actorUserId ?? null,
      reason: input.reason ?? input.escalation?.reason ?? null,
    },
  })
  return { ...base, changed: true, stateVersion: current.stateVersion + 1 }
}

/**
 * Runs one event against a stored conversation. Never throws for a rejected or lost
 * transition: the outcome says what happened so callers (actions, workers) can react.
 * Pass `options.db` to take part in the caller's transaction.
 */
export async function applyTransition(
  input: TransitionInput,
  options: TransitionOptions = {}
): Promise<TransitionOutcome> {
  const now = (options.now ?? (() => new Date()))()
  // Only inbound traffic depends on AI eligibility; skip the settings read for everything else.
  const globalAi = input.event === "INBOUND" ? await isAiGloballyEnabled() : false

  for (let tries = 0; tries < MAX_ATTEMPTS; tries++) {
    const outcome = options.db
      ? await attempt(options.db, input, globalAi, now)
      : await prisma.$transaction((tx) => attempt(tx, input, globalAi, now))
    if (outcome !== CONFLICT) return outcome
  }
  return { ok: false, code: "CONFLICT", message: "The conversation changed while the transition was applied" }
}

export interface AiPausedInput {
  conversationId: string
  paused: boolean
  actorUserId: string
}

export type AiPausedOutcome = { ok: true; changed: boolean } | { ok: false; code: "NOT_FOUND" }

/**
 * Per-conversation AI kill switch (WI-9, D9). It is orthogonal to the state: nothing moves and
 * `stateVersion` stays, but the change is audited (AI_PAUSED / AI_RESUMED, actor USER). A paused
 * AI conversation is not `aiEffective`, so it gets no AI turns and behaves like HUMAN for
 * replies. Resuming sets `aiCursorAt` so the AI does not answer what piled up while paused.
 * Repeating the current value is a no-op without an audit row.
 */
export async function setConversationAiPaused(
  input: AiPausedInput,
  options: { now?: () => Date } = {}
): Promise<AiPausedOutcome> {
  const now = (options.now ?? (() => new Date()))()
  return prisma.$transaction(async (tx): Promise<AiPausedOutcome> => {
    const conversation = await tx.conversation.findUnique({
      where: { id: input.conversationId },
      select: { status: true },
    })
    if (!conversation) return { ok: false, code: "NOT_FOUND" }

    const updated = await tx.conversation.updateMany({
      where: { id: input.conversationId, aiPaused: !input.paused },
      data: input.paused
        ? { aiPaused: true, aiPausedById: input.actorUserId, aiPausedAt: now }
        : { aiPaused: false, aiPausedById: null, aiPausedAt: null, aiCursorAt: now },
    })
    if (updated.count === 0) return { ok: true, changed: false }

    await tx.conversationEvent.create({
      data: {
        conversationId: input.conversationId,
        fromStatus: conversation.status,
        toStatus: conversation.status,
        event: input.paused ? "AI_PAUSED" : "AI_RESUMED",
        actor: "USER",
        actorUserId: input.actorUserId,
      },
    })
    return { ok: true, changed: true }
  })
}

/**
 * The real implementation behind `transition-port.ts` (`setApplyTransitionPort`): echo
 * reconciliation asks for HUMAN_ECHO and gets the full state machine, version check and audit.
 * Resolves true only when the conversation actually changed state.
 */
export const applyTransitionForPort: ApplyTransition = async (request) => {
  const outcome = await applyTransition({
    conversationId: request.conversationId,
    event: request.event,
    actor: request.actor,
    reason: request.reason,
  })
  return outcome.ok && outcome.changed
}
