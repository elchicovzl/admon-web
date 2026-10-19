import { loadRuntimeConfig } from "@/lib/config/runtime-config"
import { startBoss } from "./boss"
import { ensureQueues } from "./queues"
import { ensureSchedules } from "./schedules"
import { startWorkers } from "./workers"

/**
 * Server boot sequence, called from `instrumentation.ts`.
 *
 * 1. Validate the runtime config. A throw here aborts server start (fail fast, WC-14).
 * 2. Start pg-boss, create queues and schedules, attach workers (unless WORKER_ENABLED=false).
 *
 * Queue startup errors abort the server only when WhatsApp is enabled; with the
 * feature off they are logged so the dashboard keeps running.
 */
export async function bootstrapRuntime(
  env: NodeJS.ProcessEnv = process.env
): Promise<void> {
  const config = loadRuntimeConfig(env)

  if (!config.worker.enabled) {
    console.info("[queue] WORKER_ENABLED=false: skipping queue startup")
    return
  }

  try {
    const databaseUrl = config.worker.databaseUrl
    if (!databaseUrl) {
      throw new Error("Queue database is not configured: set QUEUE_DATABASE_URL or DIRECT_URL")
    }
    const boss = await startBoss(databaseUrl)
    await ensureQueues(boss)
    await ensureSchedules(boss)
    const workers = await startWorkers(boss)
    console.info(`[queue] started (${workers} workers registered)`)
  } catch (error) {
    if (config.whatsapp.enabled) throw error
    console.error(
      "[queue] startup failed (WhatsApp disabled, continuing):",
      error instanceof Error ? error.message : "unknown"
    )
  }
}
