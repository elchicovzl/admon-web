import { randomUUID } from "node:crypto"
import { Prisma } from "@prisma/client"
import prisma from "@/lib/db/prisma"
import { getBoss } from "@/lib/queue/boss"
import { QUEUES, QUEUE_SEND_DEFAULTS } from "@/lib/queue/queues"
import type { WebhookItem } from "./split-payload"

/** WHATSAPP_ENABLED is read straight from the environment: the flag-off path must not validate config. */
export function isWhatsAppEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.WHATSAPP_ENABLED?.trim() === "true"
}

export interface StoreResult {
  /** Ids of rows inserted by THIS call; duplicates already stored are not included. */
  newEventIds: string[]
  duplicates: number
}

/**
 * Persists webhook items with `createMany({ skipDuplicates: true })`, so duplicate and
 * concurrent deliveries collapse on the unique `dedupKey` (WC-3, WC-4, S-WC-5).
 * Ids are generated here so the rows this call actually inserted can be told apart
 * from rows another delivery inserted first.
 */
export async function storeWebhookItems(
  items: WebhookItem[],
  payloadHash: string,
  lastError?: string
): Promise<StoreResult> {
  const unique = [...new Map(items.map((item) => [item.dedupKey, item])).values()]
  const rows = unique.map((item) => ({
    id: randomUUID(),
    dedupKey: item.dedupKey,
    kind: item.kind,
    wamid: item.wamid,
    payloadHash,
    payload: item.payload as Prisma.InputJsonValue,
    ...(lastError ? { lastError } : {}),
  }))

  let inserted: number
  try {
    ;({ count: inserted } = await prisma.whatsAppWebhookEvent.createMany({
      data: rows,
      skipDuplicates: true,
    }))
  } catch (error) {
    // A racing delivery that wins the unique constraint is not a failure.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { newEventIds: [], duplicates: rows.length }
    }
    throw error
  }

  if (inserted === 0) return { newEventIds: [], duplicates: rows.length }
  if (inserted === rows.length) {
    return { newEventIds: rows.map((row) => row.id), duplicates: 0 }
  }

  const stored = await prisma.whatsAppWebhookEvent.findMany({
    where: { id: { in: rows.map((row) => row.id) } },
    select: { id: true },
  })
  return {
    newEventIds: stored.map((row) => row.id),
    duplicates: rows.length - stored.length,
  }
}

/**
 * Queues one event for processing. Best effort: the stored row is the source of truth
 * and the sweeper re-enqueues anything still unprocessed. Returns whether it was queued.
 */
export async function enqueueEvent(eventId: string): Promise<boolean> {
  try {
    const boss = await getBoss()
    await boss.send(
      QUEUES.EVENT_PROCESS,
      { eventId },
      { ...QUEUE_SEND_DEFAULTS[QUEUES.EVENT_PROCESS], singletonKey: eventId }
    )
    return true
  } catch (error) {
    console.error(
      "[whatsapp] enqueue failed (sweeper will retry):",
      error instanceof Error ? error.name : "unknown"
    )
    return false
  }
}
