import type { Job } from "pg-boss"
import { QUEUE_DEFINITIONS, QUEUES } from "@/lib/queue/queues"
import { getRegisteredWorkers, registerWorker } from "@/lib/queue/workers"
import { isWhatsAppEnabled } from "@/lib/whatsapp/ingest"
import { ingestKnowledgeDocument } from "./ingest"

export interface KbIngestJobData {
  documentId: string
}

const retryLimit = () => QUEUE_DEFINITIONS.find((definition) => definition.name === QUEUES.KB_INGEST)?.retryLimit ?? 0

/** `kb.ingest` handler. An ingest error fails the job so pg-boss retries it (retry 2). */
export async function handleKbIngestJobs(jobs: Job<KbIngestJobData>[]): Promise<void> {
  if (!isWhatsAppEnabled()) return
  const limit = retryLimit()
  for (const job of jobs) {
    await ingestKnowledgeDocument(job.data.documentId, { isLastAttempt: job.retryCount >= limit })
  }
}

/** Idempotent: registers the knowledge-base handlers once per process. */
export function registerKnowledgeWorkers(): void {
  if (!getRegisteredWorkers().some((worker) => worker.queue === QUEUES.KB_INGEST)) {
    registerWorker({ queue: QUEUES.KB_INGEST, handler: handleKbIngestJobs })
  }
}
