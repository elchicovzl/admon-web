import { normalizeSearchText } from "@/lib/whatsapp/search"

/**
 * Output guard (AI-3, AI-4, AI-15): the last check before a model reply reaches a client. Pure.
 *
 * The model must end its turn with the terminal `sendReply` tool, typed ANSWER (facts from the
 * knowledge base, with the ids of the chunks it used), CLARIFY or SMALLTALK. The guard does not
 * trust the type: a "clarification" that is long or states facts (numbers, prices, dates) is an
 * answer and needs sources. An answer without sources, or citing chunks that were not retrieved in
 * this turn (an injected or invented id), is replaced by the fallback and counts as a failure.
 * Injected instructions can change what the model writes, never what passes this check.
 */

export const FALLBACK_TEXT = "no tengo esa información, ¿desea que lo comunique con un asesor?"
export const MAX_REPLY_LENGTH = 1000
/** Longer than this, a clarification or greeting is treated as an answer. */
const SHORT_REPLY_LENGTH = 300

export type ReplyType = "ANSWER" | "CLARIFY" | "SMALLTALK"

export interface TerminalReply {
  type: ReplyType
  text: string
  sourceIds: string[]
}

export type GuardDecision =
  | { kind: "SEND"; type: ReplyType; text: string; sourceIds: string[] }
  | { kind: "FALLBACK"; text: string; reason: "NO_TOOL_CALL" | "EMPTY" | "NO_SOURCES" | "FOREIGN_SOURCE"; failure: true }

const MONTHS = /\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b/

/** Numbers, money, percentages and dates are facts the model must not state from memory. */
function looksFactual(text: string): boolean {
  return /\d|\$|%/.test(text) || MONTHS.test(normalizeSearchText(text))
}

/** WhatsApp renders *bold*; everything else in markdown would show as stray symbols. */
function toWhatsAppText(text: string): string {
  return text
    .replace(/```[^\n]*\n?([\s\S]*?)```/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/(\*\*|__)(?=\S)(.+?)(?<=\S)\1/g, "*$2*")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, "$1 ($2)")
    .replace(/(^|[^\p{L}\p{N}_])_(?=\S)([^_\n]+?)(?<=\S)_(?=$|[^\p{L}\p{N}_])/gmu, "$1$2")
    .replace(/(^|[^\p{L}\p{N}~])~(?=\S)([^~\n]+?)(?<=\S)~(?=$|[^\p{L}\p{N}~])/gmu, "$1$2")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function capLength(text: string): string {
  if (text.length <= MAX_REPLY_LENGTH) return text
  const cut = text.slice(0, MAX_REPLY_LENGTH - 1)
  const boundary = cut.lastIndexOf(" ")
  return `${(boundary > 0 ? cut.slice(0, boundary) : cut).trimEnd()}…`
}

function fallback(reason: "NO_TOOL_CALL" | "EMPTY" | "NO_SOURCES" | "FOREIGN_SOURCE"): GuardDecision {
  return { kind: "FALLBACK", text: FALLBACK_TEXT, reason, failure: true }
}

/**
 * `reply` is the `sendReply` call of the turn (null when the model ended without it); `allowedSourceIds`
 * are the chunk ids `searchKnowledge` returned during this turn.
 */
export function guardModelOutput(reply: TerminalReply | null, allowedSourceIds: ReadonlySet<string>): GuardDecision {
  if (!reply) return fallback("NO_TOOL_CALL")

  const text = toWhatsAppText(reply.text)
  if (!/[\p{L}\p{N}]/u.test(text)) return fallback("EMPTY")

  const isAnswer = reply.type === "ANSWER" || text.length > SHORT_REPLY_LENGTH || looksFactual(text)
  if (isAnswer) {
    if (reply.sourceIds.length === 0) return fallback("NO_SOURCES")
    if (reply.sourceIds.some((id) => !allowedSourceIds.has(id))) return fallback("FOREIGN_SOURCE")
  }
  return {
    kind: "SEND",
    type: isAnswer ? "ANSWER" : reply.type,
    text: capLength(text),
    sourceIds: isAnswer ? [...new Set(reply.sourceIds)] : [],
  }
}
