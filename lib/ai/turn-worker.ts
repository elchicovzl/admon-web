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
 * itself again, which the stately policy allows while it is the active job.
 */

export async function enqueueAiTurn(conversationId: string, options: { delaySeconds?: number; discards?: number } = {}): Promise<void> {
  const config = getAiConfig()
  if (!config.enabled) return
  const boss = await getBoss()
  const defaults = buildQueueSendDefaults(config)[QUEUES.AI_TURN]
  const data: TurnJob = { conversationId, discards: options.discards ?? 0 }
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
    const data = { conversationId: job.data.conversationId, discards: job.data.discards ?? 0 }
    const outcome = await runAiTurn(data)
    if (outcome.status === "WAIT") {
      await enqueueAiTurn(data.conversationId, { delaySeconds: outcome.delaySeconds, discards: data.discards })
    } else if (outcome.status === "DISCARDED" && outcome.reason === "NEWER_INBOUND") {
      await enqueueAiTurn(data.conversationId, { discards: data.discards + 1 })
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
