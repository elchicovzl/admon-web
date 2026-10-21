import { transcribe } from "ai"
import prisma from "@/lib/db/prisma"
import { transcriptionModel } from "@/lib/ai/providers"
import { getAiConfig } from "@/lib/config/runtime-config"
import { aiRepliesLast24h, getAiLimits, isOverDailyBudget } from "@/lib/ai/limits"
import { StoredObjectError, getObjectBytes } from "@/lib/storage/r2"
import { MEDIA_POLICY_LIMITS, classifyMedia } from "./responder/media-policy"
import { recordTranscriptionUsage } from "./responder/usage"

/**
 * `ai.transcribe` (MH-3, MH-4, MH-10): speech-to-text for an inbound WhatsApp voice note.
 *
 * - Exactly one transcription per media: the job claims it with
 *   `updateMany where { id, transcriptStatus: null }`, so a redelivered or duplicated job finds it
 *   claimed and stops before calling the provider. Its own retries may continue a PENDING claim.
 * - Outcomes: DONE with the text, or FAILED. A failure never blocks the conversation: the
 *   responder asks the client to write instead (S-MH-2), and staff can still play the audio.
 * - Audio the media policy rejects, or a missing/oversized stored file, fails at once. Provider
 *   errors and empty transcripts retry (the queue retries twice), then FAIL on the last attempt.
 * - Runs only with WHATSAPP_AI_ENABLED (it is an AI call), and within the cost and abuse limits. Every state change also bumps the
 *   message's `updatedAt`, because the inbox polls messages by it.
 */

export type TranscribeOutcome = { status: "DONE" } | { status: "FAILED" } | { status: "SKIPPED" }

/** Thrown when the provider returns no text, so the job retries like on any provider error. */
class EmptyTranscriptError extends Error {
  constructor() {
    super("Transcription came back empty")
  }
}

async function touchMessage(messageId: string): Promise<void> {
  await prisma.whatsAppMessage.update({ where: { id: messageId }, data: { updatedAt: new Date() } })
}

/**
 * Cost and abuse limits (Configuración → WhatsApp): no transcription for an escalated
 * conversation, one past its AI replies per day, or once the daily spend cap is reached. A
 * conversation a person attends keeps transcribing, because the advisor reads the transcript.
 */
async function overLimits(conversationId: string, status: string, config: ReturnType<typeof getAiConfig>): Promise<boolean> {
  if (status === "ESCALATED") return true
  // An escalated chat reaches HUMAN with its counters full ("Atender" after TURN_LIMIT or
  // BUDGET_LIMIT): the limits stop AI work, never the advisor's transcripts.
  if (status === "HUMAN") return false
  const now = new Date()
  const limits = await getAiLimits(config)
  if ((await aiRepliesLast24h(conversationId, now)) >= limits.maxTurnsPerDay) return true
  return isOverDailyBudget(limits, now)
}

export async function transcribeAudioMessage(
  messageId: string,
  options: { isLastAttempt: boolean; isRetry: boolean }
): Promise<TranscribeOutcome> {
  const config = getAiConfig()
  if (!config.enabled) return { status: "SKIPPED" }

  const media = await prisma.whatsAppMedia.findUnique({
    where: { messageId },
    select: {
      id: true,
      status: true,
      s3Key: true,
      mimeType: true,
      sizeBytes: true,
      durationSec: true,
      message: { select: { id: true, conversationId: true, type: true, conversation: { select: { status: true } } } },
    },
  })
  if (!media || media.status !== "STORED" || !media.s3Key) return { status: "SKIPPED" }
  if (await overLimits(media.message.conversationId, media.message.conversation.status, config)) return { status: "SKIPPED" }

  const claimable = options.isRetry
    ? [{ transcriptStatus: null }, { transcriptStatus: "PENDING" as const }]
    : [{ transcriptStatus: null }]
  const claimed = await prisma.whatsAppMedia.updateMany({
    where: { id: media.id, OR: claimable },
    data: { transcriptStatus: "PENDING" },
  })
  if (claimed.count === 0) return { status: "SKIPPED" }
  await touchMessage(media.message.id)

  const fail = async (extra: { durationSec?: number } = {}): Promise<TranscribeOutcome> => {
    await prisma.whatsAppMedia.update({ where: { id: media.id }, data: { transcriptStatus: "FAILED", ...extra } })
    await touchMessage(media.message.id)
    return { status: "FAILED" }
  }

  const decision = classifyMedia({
    mimeType: media.mimeType,
    sizeBytes: media.sizeBytes,
    durationSec: media.durationSec,
    messageType: media.message.type,
  })
  if (decision !== "TRANSCRIBE") return fail()

  const usage = { conversationId: media.message.conversationId, messageId: media.message.id, model: config.sttModel }
  const startedAt = Date.now()
  try {
    const audio = await getObjectBytes(media.s3Key, MEDIA_POLICY_LIMITS.audioBytes)
    const result = await transcribe({
      model: transcriptionModel(config),
      audio,
      providerOptions: { openai: { language: "es" } },
      maxRetries: 2,
    })
    const audioSeconds = result.durationInSeconds ?? result.segments.at(-1)?.endSecond ?? null
    const latencyMs = Date.now() - startedAt

    if (audioSeconds !== null && audioSeconds > config.sttMaxSeconds) {
      await recordTranscriptionUsage({ ...usage, audioSeconds, latencyMs })
      return fail({ durationSec: audioSeconds })
    }
    const text = result.text.trim()
    if (!text) throw new EmptyTranscriptError()

    await prisma.whatsAppMedia.update({
      where: { id: media.id },
      data: { transcript: text, transcriptStatus: "DONE", ...(audioSeconds !== null ? { durationSec: audioSeconds } : {}) },
    })
    await touchMessage(media.message.id)
    await recordTranscriptionUsage({ ...usage, audioSeconds, latencyMs })
    return { status: "DONE" }
  } catch (error) {
    if (error instanceof StoredObjectError) return fail()
    // Never log the error object: provider errors can echo request details.
    console.error(`[ai] transcription failed for message ${messageId}${options.isLastAttempt ? " (last attempt)" : ""}`)
    if (!options.isLastAttempt) throw error
    await recordTranscriptionUsage({
      ...usage,
      audioSeconds: null,
      latencyMs: Date.now() - startedAt,
      error: error instanceof EmptyTranscriptError ? "EMPTY_TRANSCRIPT" : "PROVIDER_ERROR",
    })
    return fail()
  }
}
