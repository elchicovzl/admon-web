import type { Job } from "pg-boss"
import { getAiConfig } from "@/lib/config/runtime-config"
import { getBoss } from "@/lib/queue/boss"
import { QUEUE_DEFINITIONS, QUEUES } from "@/lib/queue/queues"
import { getRegisteredWorkers, registerWorker } from "@/lib/queue/workers"
import { isWhatsAppEnabled } from "@/lib/whatsapp/ingest"
import { setAudioStoredPort } from "@/lib/whatsapp/media"
import { transcribeAudioMessage } from "./transcribe"

export interface TranscribeJobData {
  messageId: string
}

const retryLimit = () => QUEUE_DEFINITIONS.find((definition) => definition.name === QUEUES.AI_TRANSCRIBE)?.retryLimit ?? 0

/** `ai.transcribe` handler. A provider error fails the job so pg-boss retries it (retry 2). */
export async function handleTranscribeJobs(jobs: Job<TranscribeJobData>[]): Promise<void> {
  if (!isWhatsAppEnabled()) return
  const limit = retryLimit()
  for (const job of jobs) {
    await transcribeAudioMessage(job.data.messageId, {
      isLastAttempt: job.retryCount >= limit,
      isRetry: job.retryCount > 0,
    })
  }
}

/**
 * The PR1.5 audio port: called when a voice note reaches R2. With AI off nothing is queued
 * (transcription is a model call); the handler re-checks, so turning AI off stops queued jobs too.
 * Duplicate enqueues are harmless: the transcription claims the media first.
 */
export async function enqueueTranscription(messageId: string): Promise<void> {
  if (!getAiConfig().enabled) return
  const boss = await getBoss()
  const data: TranscribeJobData = { messageId }
  await boss.send(QUEUES.AI_TRANSCRIBE, data)
}

/** Idempotent: connects the audio port and registers the handler once per process. */
export function registerTranscriptionWorkers(): void {
  setAudioStoredPort(enqueueTranscription)
  if (!getRegisteredWorkers().some((worker) => worker.queue === QUEUES.AI_TRANSCRIBE)) {
    registerWorker({ queue: QUEUES.AI_TRANSCRIBE, handler: handleTranscribeJobs })
  }
}
