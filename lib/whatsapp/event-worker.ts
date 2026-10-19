import type { Job } from "pg-boss"
import prisma from "@/lib/db/prisma"
import { QUEUES } from "@/lib/queue/queues"
import { getRegisteredWorkers, registerWorker } from "@/lib/queue/workers"
import { isWhatsAppEnabled } from "./ingest"
import { sweepUnprocessedEvents } from "./sweeper"

/** A stored webhook item handed to the processor (implemented in PR1.3). */
export interface StoredWebhookEvent {
  id: string
  kind: string
  wamid: string | null
  payload: unknown
}

export type EventProcessor = (event: StoredWebhookEvent) => Promise<void>

let processor: EventProcessor | undefined

/** PR1.3 plugs the real inbound/status processing in here. */
export function setEventProcessor(next: EventProcessor | undefined): void {
  processor = next
}

const MAX_ERROR_LENGTH = 300

/**
 * `wa.event.process` handler: counts the attempt, hands the stored item to the
 * processor and marks it processed. A processor failure leaves the raw event intact
 * and rethrows so pg-boss retries and finally dead-letters (WC-5, S-WC-9).
 * With no processor registered yet the event is left unprocessed for the sweeper.
 */
export async function handleEventJobs(jobs: Job<{ eventId: string }>[]): Promise<void> {
  if (!isWhatsAppEnabled()) return // S-WC-10: store-only while the flag is off

  for (const job of jobs) {
    const event = await prisma.whatsAppWebhookEvent.findUnique({
      where: { id: job.data.eventId },
      select: { id: true, kind: true, wamid: true, payload: true, processedAt: true },
    })
    if (!event || event.processedAt) continue

    await prisma.whatsAppWebhookEvent.update({
      where: { id: event.id },
      data: { attempts: { increment: 1 } },
    })

    if (!processor) continue

    try {
      await processor(event)
      await prisma.whatsAppWebhookEvent.update({
        where: { id: event.id },
        data: { processedAt: new Date(), lastError: null },
      })
    } catch (error) {
      const message = error instanceof Error ? `${error.name}: ${error.message}` : "unknown error"
      await prisma.whatsAppWebhookEvent
        .update({ where: { id: event.id }, data: { lastError: message.slice(0, MAX_ERROR_LENGTH) } })
        .catch(() => undefined)
      throw error
    }
  }
}

/** `wa.event.sweep` handler (cron, every minute). */
export async function handleSweepJobs(): Promise<void> {
  await sweepUnprocessedEvents()
}

/** Idempotent: registers the ingress handlers once per process. */
export function registerWhatsAppWorkers(): void {
  const registered = new Set(getRegisteredWorkers().map((worker) => worker.queue))
  if (!registered.has(QUEUES.EVENT_PROCESS)) {
    registerWorker({ queue: QUEUES.EVENT_PROCESS, handler: handleEventJobs })
  }
  if (!registered.has(QUEUES.EVENT_SWEEP)) {
    registerWorker({ queue: QUEUES.EVENT_SWEEP, handler: handleSweepJobs })
  }
}
