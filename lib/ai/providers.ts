import { createAnthropic } from "@ai-sdk/anthropic"
import { createOpenAI } from "@ai-sdk/openai"
import { getAiConfig, type AiConfig } from "@/lib/config/runtime-config"

/**
 * Thin provider modules (A11, D20; user decision Q11): Claude through `@ai-sdk/anthropic` for
 * conversation and vision, OpenAI for embeddings and speech-to-text. Nothing is read or created
 * at import time; each call resolves the validated runtime config, so `next build` (no secrets)
 * and tests never touch provider credentials.
 *
 * Errors name the missing variable and never include a value.
 */

/** Dimensions of `knowledge_chunks.embedding` (`vector(1536)`); other sizes cannot be stored. */
export const EMBEDDING_COLUMN_DIMENSIONS = 1536

function required(value: string | undefined, variable: string): string {
  if (!value) throw new Error(`[ai] ${variable} is not configured`)
  return value
}

function openai(config: AiConfig) {
  return createOpenAI({ apiKey: required(config.openaiApiKey, "OPENAI_API_KEY") })
}

/** Claude chat model (`AI_CHAT_MODEL`). Only the AI responder uses it. */
export function chatModel(config: AiConfig = getAiConfig()) {
  const anthropic = createAnthropic({ apiKey: required(config.anthropicApiKey, "ANTHROPIC_API_KEY") })
  return anthropic(required(config.chatModel, "AI_CHAT_MODEL"))
}

/**
 * Embedding model (`AI_EMBEDDING_MODEL`). Knowledge-base ingestion needs it even while AI replies
 * are off, so it only requires the OpenAI key.
 */
export function embeddingModel(config: AiConfig = getAiConfig()) {
  if (config.embeddingDimensions !== EMBEDDING_COLUMN_DIMENSIONS) {
    throw new Error(
      `[ai] AI_EMBEDDING_DIMENSIONS must be ${EMBEDDING_COLUMN_DIMENSIONS} to match the knowledge_chunks.embedding column`
    )
  }
  return openai(config).embedding(config.embeddingModel)
}

/** Pass with `embed`/`embedMany` so OpenAI returns vectors of the configured size. */
export function embeddingProviderOptions(config: AiConfig = getAiConfig()) {
  return { openai: { dimensions: config.embeddingDimensions } }
}

/** Speech-to-text model (`AI_STT_MODEL`) for WhatsApp voice notes. */
export function transcriptionModel(config: AiConfig = getAiConfig()) {
  return openai(config).transcription(config.sttModel)
}
