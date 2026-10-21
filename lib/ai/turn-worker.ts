import type { Job } from "pg-boss"
import { getAiConfig } from "@/lib/config/runtime-config"
import { getBoss } from "@/lib/queue/boss"
import { QUEUES, buildQueueSendDefaults } from "@/lib/queue/queues"
import { getRegisteredWorkers, registerWorker } from "@/lib/queue/workers"
import { setAiTurnScheduler } from "@/lib/whatsapp/ai-turn-port"
import { isWhatsAppEnabled } from "@/lib/whatsapp/ingest"
import { setOnSentHook } from "@/lib/whatsapp/send"
import { runAiTurn, type TurnJob } from "./responder/turn"
import { recordAiMessageSent } from "./sent-hook"

/**
 * `ai.turn` (stately: at most one queued and one active job per conversation, singletonKey =
 * conversationId). The first run starts after the debounce (AI_DEBOUNCE_SECONDS); a turn that must
 * wait (client still typing, media pending) or was discarded because the client wrote again queues
 * itself again, which the stately policy allows while it is the active job. When a turn is already
 * queued that send is a no-op, so nothing is carried in the job data: the turn counts its own
 * discards in the usage records.
 */

export async function enqueueAiTurn(conversationId: string, options: { delaySeconds?: number } = {}): Promise<void> {
  const config = getAiConfig()
  if (!config.enabled) return
  const boss = await getBoss()
  const defaults = buildQueueSendDefaults(config)[QUEUES.AI_TURN]
  const data: TurnJob = { conversationId }
  await boss.send(QUEUES.AI_TURN, data, {
    ...defaults,
    ...(options.delaySeconds !== undefined ? { startAfter: options.delaySeconds } : {}),
    singletonKey: conversationId,
  })
}

/** Never throws on a provider failure (the turn handles it, AI-14); other errors retry once. */
export async function handleAiTurnJobs(jobs: Job<TurnJob>[]): Promise<void> {
  if (!isWhatsAppEnabled()) return
  for (const job of jobs) {
    const conversationId = job.data.conversationId
    const outcome = await runAiTurn({ conversationId })
    if (outcome.status === "WAIT") {
      await enqueueAiTurn(conversationId, { delaySeconds: outcome.delaySeconds })
    } else if (outcome.status === "DISCARDED" && outcome.reason === "NEWER_INBOUND") {
      await enqueueAiTurn(conversationId)
    }
  }
}

/** Idempotent: connects inbound scheduling and the AI send hook, and registers the handler once. */
export function registerAiTurnWorkers(): void {
  setAiTurnScheduler((conversationId) => enqueueAiTurn(conversationId))
  setOnSentHook(recordAiMessageSent)
  if (!getRegisteredWorkers().some((worker) => worker.queue === QUEUES.AI_TURN)) {
    registerWorker({ queue: QUEUES.AI_TURN, handler: handleAiTurnJobs })
  }
}
