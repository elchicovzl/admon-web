import { tool } from "ai"
import { z } from "zod"
import type { RetrievalResult } from "@/lib/knowledge/retrieve"
import { EscalationReason } from "./escalation"

/**
 * The responder's tools (AI-6). Exactly three: a read-only knowledge search and two terminal
 * tools with no `execute`, so the turn ends when the model calls them and the code decides what
 * happens. There is deliberately no tool to create or change clients, affiliations or payments
 * (S-LD-6, S-AD-5). All are `strict` so arguments always match the schema; length limits live in
 * the guard, not the schema (strict mode supports a limited JSON Schema subset).
 */

export const RESPONDER_TOOL_NAMES = ["searchKnowledge", "escalateToHuman", "sendReply"] as const

export type SearchToolResult =
  | { status: "OK"; results: { sourceId: string; document: string; section: string | null; text: string }[] }
  | { status: "NO_MATCH"; results: [] }

/** What the model sees from retrieval: chunk ids as sourceIds, no scores or internal states. */
export function toolResultForModel(result: RetrievalResult): SearchToolResult {
  if (result.status !== "OK") return { status: "NO_MATCH", results: [] }
  return {
    status: "OK",
    results: result.chunks.map((chunk) => ({
      sourceId: chunk.id,
      document: chunk.documentTitle,
      section: chunk.heading,
      text: chunk.content,
    })),
  }
}

/** Reasons the model may give; the rest (forbidden topic, failures) are decided by code. */
export const MODEL_ESCALATION_REASONS = [
  EscalationReason.USER_REQUEST,
  EscalationReason.COMPLAINT,
  EscalationReason.OUT_OF_SCOPE,
  EscalationReason.LOW_CONFIDENCE,
  EscalationReason.DOCUMENT_REVIEW,
] as const

export function buildResponderTools(deps: { searchKnowledge: (query: string) => Promise<SearchToolResult> }) {
  return {
    searchKnowledge: tool({
      description:
        "Busca en la base de conocimiento de Administración Segura. Devuelve fragmentos con su sourceId; cite en sendReply los sourceId que use.",
      inputSchema: z.object({ query: z.string().describe("La pregunta del cliente, en español y con sus palabras clave") }),
      strict: true,
      execute: async ({ query }) => deps.searchKnowledge(query),
    }),
    escalateToHuman: tool({
      description: "Termina el turno pasando la conversación a un asesor humano.",
      inputSchema: z.object({
        reason: z.enum(MODEL_ESCALATION_REASONS),
        summary: z.string().describe("Resumen breve para el asesor de lo que necesita el cliente"),
      }),
      strict: true,
    }),
    sendReply: tool({
      description: "Termina el turno enviando la respuesta al cliente por WhatsApp.",
      inputSchema: z.object({
        type: z.enum(["ANSWER", "CLARIFY", "SMALLTALK"]),
        text: z.string().describe("El mensaje para el cliente"),
        sourceIds: z.array(z.string()).describe("Los sourceId de searchKnowledge que respaldan la respuesta (vacío si no es ANSWER)"),
      }),
      strict: true,
    }),
  }
}
