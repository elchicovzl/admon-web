import type { MessageDirection, MessageSource, MessageType } from "@prisma/client"
import { estimateTokens } from "@/lib/knowledge/chunk"

/**
 * Conversation history for the model (AI-2): the newest messages that fit 20 messages and ~6000
 * tokens, oldest first, starting with the client. Staff replies are marked "[Asesor humano]" so
 * the model does not contradict them; attachments become short placeholders (voice notes use
 * their transcript). System messages are internal and never sent. Tolerates an empty or short
 * history (retention may have purged older messages). Pure.
 */

export const HISTORY_LIMITS = { maxMessages: 20, maxTokens: 6000 } as const

export interface HistoryMessage {
  direction: MessageDirection
  source: MessageSource
  type: MessageType
  text: string | null
  transcript: string | null
  timestamp: Date
}

export interface HistoryTurn {
  role: "user" | "assistant"
  content: string
}

function clientContent(message: HistoryMessage): string {
  const caption = message.text?.trim()
  switch (message.type) {
    case "TEXT":
      return caption ?? ""
    case "AUDIO":
      return message.transcript?.trim() ? `[Nota de voz] ${message.transcript.trim()}` : "[Nota de voz sin transcripción]"
    case "IMAGE":
      return caption ? `[Imagen] ${caption}` : "[Imagen]"
    case "DOCUMENT":
      return caption ? `[Documento] ${caption}` : "[Documento]"
    default:
      return "[Mensaje no soportado]"
  }
}

function toTurn(message: HistoryMessage): HistoryTurn | null {
  if (message.source === "SYSTEM") return null
  if (message.direction === "IN") return { role: "user", content: clientContent(message) }
  const text = message.text?.trim() || (message.type === "TEMPLATE" ? "[Plantilla]" : "")
  if (!text) return null
  return { role: "assistant", content: message.source === "AI" ? text : `[Asesor humano] ${text}` }
}

export function buildHistory(messages: HistoryMessage[], limits = HISTORY_LIMITS): HistoryTurn[] {
  const turns = [...messages]
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    .map(toTurn)
    .filter((turn): turn is HistoryTurn => turn !== null && turn.content.length > 0)

  const kept: HistoryTurn[] = []
  let tokens = 0
  for (let i = turns.length - 1; i >= 0 && kept.length < limits.maxMessages; i--) {
    const cost = estimateTokens(turns[i].content)
    if (tokens + cost > limits.maxTokens) break
    tokens += cost
    kept.unshift(turns[i])
  }
  // The model expects the conversation to start with the client.
  while (kept.length > 0 && kept[0].role === "assistant") kept.shift()
  return kept
}
