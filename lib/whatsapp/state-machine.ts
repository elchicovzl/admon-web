import type { ConversationActor, ConversationStatus } from "@prisma/client"

/**
 * The conversation state machine (design D9, spec CH-1..CH-11). Pure: no I/O, so every row of
 * the transition table is unit tested. `transitions.ts` applies the result under an
 * optimistic version check and writes the audit trail.
 *
 *  from              event            to
 *  (none)            INBOUND          AI if aiEffective else HUMAN        (CH-1)
 *  (none)            HUMAN_ECHO       HUMAN                               (a person wrote first)
 *  CLOSED            INBOUND          AI if aiEffective else HUMAN        (auto-reopen, CH-2, CH-11)
 *  AI                INBOUND          AI    (a turn is scheduled only when aiEffective)
 *  HUMAN             INBOUND          HUMAN
 *  ESCALATED         INBOUND          ESCALATED (never answered by the AI, CH-7; staff are notified)
 *  AI | ESCALATED    HUMAN_ECHO       HUMAN                               (CH-2, CH-9)
 *  AI | ESCALATED    DASHBOARD_REPLY  HUMAN                               (WI-7, CH-4)
 *  AI | ESCALATED    TAKE             HUMAN  ("Atender")                  (CH-2)
 *  AI                AI_ESCALATE      ESCALATED                           (CH-2, CH-3)
 *  HUMAN             RETURN_TO_AI     AI     (manual only, PA2/CH-6)
 *  AI|HUMAN|ESCALATED CLOSE           CLOSED                              (manual)
 *  CLOSED            REOPEN(target)   AI | HUMAN                          (manual, CH-2)
 *
 * Everything else is rejected. In particular ESCALATED never goes straight to AI (it must
 * pass through HUMAN), and the AI can only ever move AI -> ESCALATED (CH-3, S-CH-8).
 */
export type ConversationEventType =
  | "INBOUND"
  | "HUMAN_ECHO"
  | "DASHBOARD_REPLY"
  | "TAKE"
  | "AI_ESCALATE"
  | "RETURN_TO_AI"
  | "CLOSE"
  | "REOPEN"

/** Who may raise each event. The AI is confined to AI_ESCALATE (CH-3). */
export const EVENT_ACTORS: Record<ConversationEventType, readonly ConversationActor[]> = {
  INBOUND: ["CLIENT"],
  HUMAN_ECHO: ["PHONE_APP"],
  DASHBOARD_REPLY: ["USER"],
  TAKE: ["USER"],
  AI_ESCALATE: ["AI"],
  RETURN_TO_AI: ["USER"],
  CLOSE: ["USER", "SYSTEM"],
  REOPEN: ["USER"],
}

export interface TransitionContext {
  /** WHATSAPP_AI_ENABLED && WhatsAppSettings.aiEnabled && !conversation.aiPaused (D9). */
  aiEffective: boolean
  /** Required by REOPEN: where the closed conversation goes. */
  target?: "AI" | "HUMAN"
}

export interface TransitionResult {
  ok: true
  from: ConversationStatus | null
  to: ConversationStatus
  /** False when the event is valid but leaves the state as it is (no audit row, no version bump). */
  changed: boolean
  /** Name written to the audit trail; keeps the PR1.3 names for first contact and reopen. */
  auditEvent: string
  /** An inbound landed on an AI conversation that the AI may answer: schedule a debounced turn. */
  scheduleAiTurn: boolean
  /** An inbound landed on an ESCALATED conversation: staff get one deduped activity notice. */
  notifyActivity: boolean
}

export type TransitionRejectedReason =
  | "ACTOR_NOT_ALLOWED"
  | "INVALID_FROM_STATE"
  | "TARGET_REQUIRED"

export interface TransitionRejected {
  ok: false
  reason: TransitionRejectedReason
  message: string
}

function moved(
  from: ConversationStatus | null,
  to: ConversationStatus,
  auditEvent: string,
  extra: Partial<Pick<TransitionResult, "scheduleAiTurn" | "notifyActivity">> = {}
): TransitionResult {
  return { ok: true, from, to, changed: from !== to, auditEvent, scheduleAiTurn: false, notifyActivity: false, ...extra }
}

function rejected(reason: TransitionRejectedReason, message: string): TransitionRejected {
  return { ok: false, reason, message }
}

function invalid(from: ConversationStatus | null, event: ConversationEventType): TransitionRejected {
  return rejected("INVALID_FROM_STATE", `${event} is not allowed from ${from ?? "no conversation"}`)
}

/** Applies one event to a state. `actor` is checked against EVENT_ACTORS before the table. */
export function transition(
  from: ConversationStatus | null,
  event: ConversationEventType,
  context: TransitionContext,
  actor?: ConversationActor
): TransitionResult | TransitionRejected {
  if (actor !== undefined && !EVENT_ACTORS[event].includes(actor)) {
    return rejected("ACTOR_NOT_ALLOWED", `${actor} cannot raise ${event}`)
  }

  switch (event) {
    case "INBOUND": {
      const entry = context.aiEffective ? "AI" : "HUMAN"
      switch (from) {
        case null:
          return moved(null, entry, "INBOUND_FIRST_CONTACT")
        case "CLOSED":
          return moved("CLOSED", entry, "INBOUND_REOPEN")
        case "AI":
          return moved("AI", "AI", "INBOUND", { scheduleAiTurn: context.aiEffective })
        case "HUMAN":
          return moved("HUMAN", "HUMAN", "INBOUND")
        case "ESCALATED":
          return moved("ESCALATED", "ESCALATED", "INBOUND", { notifyActivity: true })
      }
      return invalid(from, event)
    }

    case "HUMAN_ECHO":
      if (from === null) return moved(null, "HUMAN", "ECHO_FIRST_CONTACT")
      // A phone echo on a CLOSED chat is stored but does not reopen it: reopening is manual (CH-2).
      return moved(from, from === "CLOSED" ? "CLOSED" : "HUMAN", event)

    case "DASHBOARD_REPLY":
    case "TAKE":
      if (from === "AI" || from === "ESCALATED") return moved(from, "HUMAN", event)
      // Idempotent: replying again, or a second "Atender" click, keeps HUMAN.
      if (from === "HUMAN") return moved("HUMAN", "HUMAN", event)
      // A closed chat must be reopened first, so the reply and the reopen are separate decisions.
      return invalid(from, event)

    case "AI_ESCALATE":
      if (from === "AI") return moved("AI", "ESCALATED", event)
      return invalid(from, event) // HUMAN, CLOSED, ESCALATED (CH-3, S-CH-8)

    case "RETURN_TO_AI":
      if (from === "HUMAN") return moved("HUMAN", "AI", event)
      return invalid(from, event) // ESCALATED must pass through HUMAN first

    case "CLOSE":
      if (from === "AI" || from === "HUMAN" || from === "ESCALATED") return moved(from, "CLOSED", event)
      return invalid(from, event)

    case "REOPEN":
      if (from !== "CLOSED") return invalid(from, event)
      if (context.target !== "AI" && context.target !== "HUMAN") {
        return rejected("TARGET_REQUIRED", "REOPEN needs a target of AI or HUMAN")
      }
      return moved("CLOSED", context.target, event)
  }
}
