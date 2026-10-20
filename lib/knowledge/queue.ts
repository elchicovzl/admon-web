import { getBoss } from "@/lib/queue/boss"
import { QUEUES } from "@/lib/queue/queues"
import type { KbIngestJobData } from "./worker"

/**
 * Queues `kb.ingest` for a document. Throws when the queue is unavailable (for example with
 * WHATSAPP_ENABLED off). Callers dedupe per document before calling (see documents.ts): on the
 * `standard` policy a singletonKey would not.
 */
export async function enqueueKnowledgeIngest(documentId: string): Promise<void> {
  const boss = await getBoss()
  const data: KbIngestJobData = { documentId }
  await boss.send(QUEUES.KB_INGEST, data)
}
