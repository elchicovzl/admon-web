import type { Job } from "pg-boss"
import prisma from "@/lib/db/prisma"
import { QUEUES } from "@/lib/queue/queues"
import { getRegisteredWorkers, registerWorker } from "@/lib/queue/workers"
import { recoverMissingLeads } from "./contacts"
import { handleEchoReconcileJobs } from "./echoes"
import { isWhatsAppEnabled } from "./ingest"
import { handleMediaJobs } from "./media"
import { processWebhookEvent } from "./process-event"
import { handleSendJobs } from "./send"
import { sweepUnprocessedEvents } from "./sweeper"
import { setApplyTransitionPort } from "./transition-port"
import { applyTransitionForPort } from "./transitions"

/** A stored webhook item handed to the processor. */
export interface StoredWebhookEvent {
  id: string
  kind: string
  wamid: string | null
  payload: unknown
}

/**
 * What a processor may report. `"deferred"` means "this kind has no handler yet": the
 * event stays unprocessed (and does not burn an attempt) so it is picked up once the
 * handler ships, instead of being marked processed and lost.
 */
export type ProcessOutcome = void | "deferred"

export type EventProcessor = (event: StoredWebhookEvent) => Promise<ProcessOutcome>

let processor: EventProcessor | undefined

/** Replaces the event processor; `registerWhatsAppWorkers` installs the real one. */
export function setEventProcessor(next: EventProcessor | undefined): void {
  processor = next
}

const MAX_ERROR_LENGTH = 300

/**
 * `wa.event.process` handler: counts the attempt, hands the stored item to the
 * processor and marks it processed. A processor failure leaves the raw event intact
 * and rethrows so pg-boss retries and finally dead-letters (WC-5, S-WC-9).
 * With no processor set (tests) the event is left unprocessed for the sweeper.
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
      const outcome = await processor(event)
      if (outcome === "deferred") {
        await prisma.whatsAppWebhookEvent.update({
          where: { id: event.id },
          data: { attempts: { decrement: 1 } },
        })
        continue
      }
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

/**
 * `wa.event.sweep` handler (cron, every minute): re-queues stale events, then recovers
 * contacts whose lead creation failed after their message was stored (LD-2).
 */
export async function handleSweepJobs(): Promise<void> {
  if (!isWhatsAppEnabled()) return
  await sweepUnprocessedEvents()
  await recoverMissingLeads()
}

/** Idempotent: registers the ingress and outbox handlers and the real event processor once per process. */
export function registerWhatsAppWorkers(): void {
  processor ??= processWebhookEvent
  // Echo takeover runs through the real state machine instead of the PR1.4 stand-in writer.
  setApplyTransitionPort(applyTransitionForPort)
  const registered = new Set(getRegisteredWorkers().map((worker) => worker.queue))
  if (!registered.has(QUEUES.EVENT_PROCESS)) {
    registerWorker({ queue: QUEUES.EVENT_PROCESS, handler: handleEventJobs })
  }
  if (!registered.has(QUEUES.EVENT_SWEEP)) {
    registerWorker({ queue: QUEUES.EVENT_SWEEP, handler: handleSweepJobs })
  }
  if (!registered.has(QUEUES.ECHO_RECONCILE)) {
    registerWorker({ queue: QUEUES.ECHO_RECONCILE, handler: handleEchoReconcileJobs })
  }
  if (!registered.has(QUEUES.MESSAGE_SEND)) {
    registerWorker({ queue: QUEUES.MESSAGE_SEND, handler: handleSendJobs })
  }
  if (!registered.has(QUEUES.MEDIA_DOWNLOAD)) {
    registerWorker({ queue: QUEUES.MEDIA_DOWNLOAD, handler: handleMediaJobs })
  }
}
