import { normalizeSearchText } from "@/lib/whatsapp/search"

/**
 * Escalation rules the responder applies before and after the model (AI-8, MH-4). Pure.
 * Reasons are stored as strings (`Conversation.escalationReason`), so adding one needs no migration.
 */

export const EscalationReason = {
  USER_REQUEST: "USER_REQUEST",
  COMPLAINT: "COMPLAINT",
  OUT_OF_SCOPE: "OUT_OF_SCOPE",
  FORBIDDEN_TOPIC: "FORBIDDEN_TOPIC",
  LOW_CONFIDENCE: "LOW_CONFIDENCE",
  REPEATED_FAILURE: "REPEATED_FAILURE",
  DOCUMENT_REVIEW: "DOCUMENT_REVIEW",
  AI_FAILURE: "AI_FAILURE",
  /** AI_MAX_TURNS_PER_DAY reached for the conversation. */
  TURN_LIMIT: "TURN_LIMIT",
} as const

export type EscalationReason = (typeof EscalationReason)[keyof typeof EscalationReason]

/** A person asking for a person: deterministic, no model needed. */
export const HUMAN_REQUEST_KEYWORDS = ["asesor", "persona", "humano", "hablar con alguien", "gerente"]

/** Whole-word (or whole-phrase) match on accent- and case-folded text. */
function containsPhrase(folded: string, phrase: string): boolean {
  const needle = normalizeSearchText(phrase)
  if (!needle) return false
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, "u").test(folded)
}

/**
 * Checks an inbound text before any model call. A forbidden topic (AI_FORBIDDEN_TOPICS) wins over
 * a request for a person: both escalate, but the reason tells staff why.
 */
export function detectEscalation(text: string, forbiddenTopics: readonly string[]): EscalationReason | null {
  const folded = normalizeSearchText(text)
  if (forbiddenTopics.some((topic) => containsPhrase(folded, topic))) return EscalationReason.FORBIDDEN_TOPIC
  if (HUMAN_REQUEST_KEYWORDS.some((keyword) => containsPhrase(folded, keyword))) return EscalationReason.USER_REQUEST
  return null
}

/**
 * After a failed turn: `count` is the number of consecutive failures including this one. At the
 * cap (AI_MAX_CONSECUTIVE_FAILURES, 2) the conversation goes to a person; if the last failure was
 * about an attachment the assistant could not read, staff are asked to review the document.
 */
export function nextFailureState(
  count: number,
  cap: number,
  lastWasMedia: boolean
): { escalate: false } | { escalate: true; reason: "REPEATED_FAILURE" | "DOCUMENT_REVIEW" } {
  if (count < cap) return { escalate: false }
  return { escalate: true, reason: lastWasMedia ? EscalationReason.DOCUMENT_REVIEW : EscalationReason.REPEATED_FAILURE }
}
