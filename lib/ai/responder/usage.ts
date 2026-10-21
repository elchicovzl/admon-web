import prisma from "@/lib/db/prisma"

/**
 * AI usage records (AI-13): every model call leaves a row with model, size and an estimated
 * cost, never content. The responder (PR3.6) records CHAT_TURN rows; transcription records
 * TRANSCRIPTION rows. Cost is an estimate from list prices; unknown models record null.
 */

/** USD per minute of audio. OpenAI list prices, checked 2026-10-20 (partial minutes round up). */
const TRANSCRIPTION_USD_PER_MINUTE: Record<string, number> = {
  "gpt-4o-mini-transcribe": 0.003,
  "gpt-4o-transcribe": 0.006,
  "whisper-1": 0.006,
}

/** USD per million tokens [input, output]. Anthropic list prices, checked 2026-10-06. */
const CHAT_USD_PER_MILLION: Record<string, [number, number]> = {
  "claude-opus-5-5": [4, 20],
  "claude-sonnet-5-5": [2, 10],
  "claude-haiku-5-5": [0.1, 0.5],
}

const toMicroUsd = (usd: number) => Math.round(usd * 1_000_000) / 1_000_000

export function estimateTranscriptionCostUsd(model: string, audioSeconds: number | null): number | null {
  const perMinute = TRANSCRIPTION_USD_PER_MINUTE[model]
  if (perMinute === undefined || audioSeconds === null) return null
  return toMicroUsd(Math.max(1, Math.ceil(audioSeconds / 60)) * perMinute)
}

export function estimateChatCostUsd(model: string, inputTokens: number, outputTokens: number): number | null {
  const prices = CHAT_USD_PER_MILLION[model]
  if (!prices) return null
  return toMicroUsd((inputTokens * prices[0] + outputTokens * prices[1]) / 1_000_000)
}

export interface TranscriptionUsage {
  conversationId: string | null
  messageId: string
  model: string
  audioSeconds: number | null
  latencyMs: number
  /** Short code, never provider text (it can echo request details). */
  error?: string | null
}

/** Returns the record id, or null when it could not be written (usage never blocks the work). */
export async function recordTranscriptionUsage(usage: TranscriptionUsage): Promise<string | null> {
  try {
    const record = await prisma.aiUsageRecord.create({
      data: {
        kind: "TRANSCRIPTION",
        conversationId: usage.conversationId,
        messageId: usage.messageId,
        model: usage.model,
        audioSeconds: usage.audioSeconds,
        latencyMs: usage.latencyMs,
        estimatedCostUsd: usage.error ? null : estimateTranscriptionCostUsd(usage.model, usage.audioSeconds),
        error: usage.error ?? null,
      },
      select: { id: true },
    })
    return record.id
  } catch {
    console.error("[ai] could not record transcription usage")
    return null
  }
}
