import prisma from "@/lib/db/prisma"
import { enqueueEvent, isWhatsAppEnabled } from "./ingest"

export const SWEEP_MIN_AGE_MS = 60_000
export const SWEEP_BATCH_SIZE = 200
/**
 * Attempts after which the sweeper gives up on an event. `wa.event.process` retries 5 times
 * (6 runs) before pg-boss dead-letters the job, so 12 allows exactly one more full retry
 * cycle from the sweeper. Past that the raw event stays stored and replayable by an operator.
 */
export const SWEEP_MAX_ATTEMPTS = 12

/**
 * Backstop for the webhook's best-effort enqueue: re-queues stored events that are
 * still unprocessed after a minute. Does nothing while WHATSAPP_ENABLED is off.
 *
 * Events at or above SWEEP_MAX_ATTEMPTS are treated as dead-lettered and skipped (their
 * count is logged, never their content). Candidates are ordered by fewest attempts first,
 * then oldest, so a pile of stuck events cannot starve newer ones out of the batch.
 * Returns how many events were re-queued.
 */
export async function sweepUnprocessedEvents(now: Date = new Date()): Promise<number> {
  if (!isWhatsAppEnabled()) return 0

  const olderThan = { lt: new Date(now.getTime() - SWEEP_MIN_AGE_MS) }

  const stale = await prisma.whatsAppWebhookEvent.findMany({
    where: {
      processedAt: null,
      receivedAt: olderThan,
      attempts: { lt: SWEEP_MAX_ATTEMPTS },
    },
    orderBy: [{ attempts: "asc" }, { receivedAt: "asc" }],
    take: SWEEP_BATCH_SIZE,
    select: { id: true },
  })

  let queued = 0
  for (const { id } of stale) {
    if (await enqueueEvent(id)) queued++
  }

  const exhausted = await prisma.whatsAppWebhookEvent.count({
    where: { processedAt: null, receivedAt: olderThan, attempts: { gte: SWEEP_MAX_ATTEMPTS } },
  })
  if (exhausted > 0) {
    console.warn(`[whatsapp] sweeper skipped ${exhausted} event(s) that exhausted ${SWEEP_MAX_ATTEMPTS} attempts`)
  }

  return queued
}
