import type { Job } from "pg-boss"
import prisma from "@/lib/db/prisma"
import { getWhatsAppConfig } from "@/lib/config/runtime-config"
import { QUEUES } from "@/lib/queue/queues"
import { getRegisteredWorkers, registerWorker } from "@/lib/queue/workers"
import { deleteObjects } from "@/lib/storage/r2"
import { isWhatsAppEnabled } from "@/lib/whatsapp/ingest"

/**
 * Retention purge (`retention.purge`, daily 03:00 Bogota, DR-1..DR-4).
 *
 * A conversation with no message for `WHATSAPP_RETENTION_DAYS` is deleted with its messages,
 * media rows and events (cascade). Its files in R2 go first: only when every file is gone is
 * the conversation deleted, otherwise it is kept and retried on the next run, so R2 never keeps
 * orphaned files. The contact (and its client link), the lead and the AI usage records stay;
 * the last two only lose their reference to the conversation.
 *
 * Raw webhook events, kept only for debugging, are deleted after
 * `WHATSAPP_WEBHOOK_EVENT_RETENTION_DAYS` once processed.
 */

const DAY_MS = 24 * 60 * 60 * 1000
const BATCH_SIZE = 50
/** Conversations handled per run; the rest wait for the next night. */
const MAX_PER_RUN = 1000

const daysBefore = (now: Date, days: number) => new Date(now.getTime() - days * DAY_MS)

export async function purgeInactiveConversations(input: {
  now: Date
  retentionDays: number
  maxPerRun?: number
}): Promise<{ purged: number; kept: number }> {
  const cutoff = daysBefore(input.now, input.retentionDays)
  const maxPerRun = input.maxPerRun ?? MAX_PER_RUN
  const attempted: string[] = []
  let purged = 0
  let kept = 0

  while (attempted.length < maxPerRun) {
    const batch = await prisma.conversation.findMany({
      where: { lastMessageAt: { lt: cutoff }, ...(attempted.length ? { id: { notIn: attempted } } : {}) },
      orderBy: { lastMessageAt: "asc" },
      take: Math.min(BATCH_SIZE, maxPerRun - attempted.length),
      select: { id: true },
    })
    if (batch.length === 0) break

    for (const { id } of batch) {
      attempted.push(id)
      if (await purgeConversation(id, cutoff, input.now)) purged++
      else kept++
    }
  }
  return { purged, kept }
}

/** True when the conversation was deleted; false when it stays for the next run. */
async function purgeConversation(conversationId: string, cutoff: Date, now: Date): Promise<boolean> {
  // Hidden from the client's WhatsApp tab while its files are being removed.
  await prisma.conversation.update({ where: { id: conversationId }, data: { purgePendingAt: now } })

  const media = await prisma.whatsAppMedia.findMany({
    where: { message: { conversationId }, s3Key: { not: null }, r2DeletedAt: null },
    select: { id: true, s3Key: true },
  })
  if (media.length > 0) {
    const result = await deleteObjects(media.map((row) => row.s3Key as string))
    const gone = new Set(result.deleted)
    const goneIds = media.filter((row) => gone.has(row.s3Key as string)).map((row) => row.id)
    if (goneIds.length > 0) {
      await prisma.whatsAppMedia.updateMany({ where: { id: { in: goneIds } }, data: { r2DeletedAt: now } })
    }
    if (result.failed.length > 0) {
      console.error(`[retention] ${result.failed.length} file(s) not deleted for conversation ${conversationId}; retrying next run`)
      // Visible again until the next run: if the client writes meanwhile it no longer qualifies.
      await prisma.conversation.update({ where: { id: conversationId }, data: { purgePendingAt: null } })
      return false
    }
  }

  return prisma.$transaction(async (tx) => {
    // Re-checked under the delete: a conversation that just got a message is not purged.
    const { count } = await tx.conversation.deleteMany({ where: { id: conversationId, lastMessageAt: { lt: cutoff } } })
    if (count === 0) {
      await tx.conversation.updateMany({ where: { id: conversationId }, data: { purgePendingAt: null } })
      return false
    }
    await tx.aiUsageRecord.updateMany({ where: { conversationId }, data: { conversationId: null } })
    await tx.lead.updateMany({ where: { conversationId }, data: { conversationId: null } })
    return true
  })
}

export async function purgeOldWebhookEvents(input: { now: Date; retentionDays: number }): Promise<number> {
  const { count } = await prisma.whatsAppWebhookEvent.deleteMany({
    where: { receivedAt: { lt: daysBefore(input.now, input.retentionDays) }, processedAt: { not: null } },
  })
  return count
}

/** `retention.purge` handler. A failure fails the job so pg-boss retries it (retry 2). */
export async function handleRetentionPurgeJobs(jobs: Job<unknown>[]): Promise<void> {
  if (!isWhatsAppEnabled() || jobs.length === 0) return
  const config = getWhatsAppConfig()
  const now = new Date()
  const conversations = await purgeInactiveConversations({ now, retentionDays: config.retentionDays })
  const events = await purgeOldWebhookEvents({ now, retentionDays: config.webhookEventRetentionDays })
  console.info(
    `[retention] purged ${conversations.purged} conversation(s), kept ${conversations.kept} for retry, deleted ${events} webhook event(s)`
  )
}

/** Idempotent: registers the retention handler once per process. */
export function registerRetentionWorkers(): void {
  if (!getRegisteredWorkers().some((worker) => worker.queue === QUEUES.RETENTION_PURGE)) {
    registerWorker({ queue: QUEUES.RETENTION_PURGE, handler: handleRetentionPurgeJobs })
  }
}
