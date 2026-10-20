import { loadRuntimeConfig } from "@/lib/config/runtime-config"
import { registerKnowledgeWorkers } from "@/lib/knowledge/worker"
import { registerWhatsAppWorkers } from "@/lib/whatsapp/event-worker"
import { startBoss } from "./boss"
import { ensureQueues } from "./queues"
import { ensureSchedules } from "./schedules"
import { startWorkers } from "./workers"

/**
 * Server boot sequence, called from `instrumentation.ts`.
 *
 * A WHATSAPP_ENABLED value that is set but is neither "true" nor "false" aborts startup.
 * With WHATSAPP_ENABLED unset or "false" this is a strict no-op: no config validation,
 * no pg-boss connection, no `pgboss` schema DDL, no queues, no schedules. Deploying
 * with the flag off leaves the database and runtime exactly as they were.
 *
 * With the flag on:
 * 1. Validate the runtime config. A throw aborts server start (fail fast, WC-14).
 * 2. Start pg-boss, create queues and schedules, attach workers (unless WORKER_ENABLED=false).
 *    Queue startup errors abort the server.
 */
export async function bootstrapRuntime(
  env: NodeJS.ProcessEnv = process.env
): Promise<void> {
  const flag = env.WHATSAPP_ENABLED?.trim()
  // A typo such as "True" or "yes" must not silently leave the feature off.
  if (flag && flag !== "true" && flag !== "false") {
    throw new Error('Invalid WHATSAPP_ENABLED: must be "true" or "false"')
  }
  if (flag !== "true") {
    console.info("[queue] WhatsApp is disabled (WHATSAPP_ENABLED!=true): queue not started")
    return
  }

  const config = loadRuntimeConfig(env)

  if (!config.worker.enabled) {
    console.info("[queue] WORKER_ENABLED=false: skipping queue startup")
    return
  }

  const databaseUrl = config.worker.databaseUrl
  if (!databaseUrl) {
    throw new Error("Queue database is not configured: set QUEUE_DATABASE_URL or DIRECT_URL")
  }
  const boss = await startBoss(databaseUrl)
  await ensureQueues(boss)
  await ensureSchedules(boss)
  registerWhatsAppWorkers()
  registerKnowledgeWorkers()
  const workers = await startWorkers(boss)
  console.info(`[queue] started (${workers} workers registered)`)
}
