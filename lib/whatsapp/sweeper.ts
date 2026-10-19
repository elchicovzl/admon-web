import prisma from "@/lib/db/prisma"
import { enqueueEvent, isWhatsAppEnabled } from "./ingest"

export const SWEEP_MIN_AGE_MS = 60_000
export const SWEEP_BATCH_SIZE = 200

/**
 * Backstop for the webhook's best-effort enqueue: re-queues stored events that are
 * still unprocessed after a minute. Does nothing while WHATSAPP_ENABLED is off.
 * Returns how many events were re-queued.
 */
export async function sweepUnprocessedEvents(now: Date = new Date()): Promise<number> {
  if (!isWhatsAppEnabled()) return 0

  const stale = await prisma.whatsAppWebhookEvent.findMany({
    where: {
      processedAt: null,
      receivedAt: { lt: new Date(now.getTime() - SWEEP_MIN_AGE_MS) },
    },
    orderBy: { receivedAt: "asc" },
    take: SWEEP_BATCH_SIZE,
    select: { id: true },
  })

  let queued = 0
  for (const { id } of stale) {
    if (await enqueueEvent(id)) queued++
  }
  return queued
}
