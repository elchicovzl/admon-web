import { PgBoss } from "pg-boss"
import { getRuntimeConfig } from "@/lib/config/runtime-config"
import { ensureQueues } from "./queues"

/**
 * pg-boss lives in its own `pgboss` schema on the application database.
 * One instance per process is shared through `globalThis` so route handlers,
 * server actions and the instrumentation bootstrap (separate module graphs in
 * Next.js) all reach the same connection pool.
 */

export const BOSS_SCHEMA = "pgboss"
export const BOSS_POOL_MAX = 4
export const BOSS_STOP_TIMEOUT_MS = 20_000

type BossGlobal = typeof globalThis & {
  __boss?: PgBoss
  __bossStarting?: Promise<PgBoss>
  __bossShutdownRegistered?: boolean
}

const g = globalThis as BossGlobal

function createBoss(databaseUrl: string, mode: "server" | "send-only"): PgBoss {
  const boss = new PgBoss({
    connectionString: databaseUrl,
    schema: BOSS_SCHEMA,
    max: BOSS_POOL_MAX,
    application_name: mode === "server" ? "admon-web-queue" : "admon-web-queue-send",
    // A send-only client never schedules or supervises; only the worker process does.
    ...(mode === "send-only" ? { schedule: false, supervise: false, registerInstance: false } : {}),
  })
  // Without a listener, an 'error' event would crash the process.
  boss.on("error", (error) => {
    console.error("[queue] pg-boss error:", error instanceof Error ? error.message : "unknown")
  })
  return boss
}

function registerGracefulShutdown(boss: PgBoss): void {
  if (g.__bossShutdownRegistered) return
  g.__bossShutdownRegistered = true

  process.once("SIGTERM", () => {
    boss
      .stop({ graceful: true, timeout: BOSS_STOP_TIMEOUT_MS })
      .catch((error: unknown) => {
        console.error("[queue] graceful stop failed:", error instanceof Error ? error.message : "unknown")
      })
      .finally(() => {
        g.__boss = undefined
        g.__bossStarting = undefined
        g.__bossShutdownRegistered = false
        // Adding a SIGTERM listener disables Node's default exit. Exit only when
        // no other handler (e.g. the Next.js server) is going to do it.
        if (process.listenerCount("SIGTERM") === 0) process.exit(0)
      })
  })
}

function connect(databaseUrl: string, mode: "server" | "send-only"): Promise<PgBoss> {
  const boss = createBoss(databaseUrl, mode)
  g.__bossStarting = boss
    .start()
    // A send-only process (WORKER_ENABLED=false) never runs the bootstrap, so it
    // makes sure the queues exist before the first send. Idempotent, safe to race.
    .then(async () => {
      if (mode === "send-only") await ensureQueues(boss)
    })
    .then(() => {
      g.__boss = boss
      registerGracefulShutdown(boss)
      return boss
    })
    .catch(async (error) => {
      g.__bossStarting = undefined
      // Do not leak a half-initialized pool when the post-start step fails.
      await boss.stop({ graceful: false }).catch(() => undefined)
      throw error
    })
  return g.__bossStarting
}

/**
 * Starts the process-wide pg-boss instance used by workers and schedules.
 * Idempotent: a second call returns the running instance.
 */
export async function startBoss(databaseUrl: string): Promise<PgBoss> {
  if (g.__boss) return g.__boss
  return g.__bossStarting ?? connect(databaseUrl, "server")
}

/**
 * Lazy send-only access for webhook routes, server actions and scripts. Reuses
 * the worker instance when it runs in the same process.
 */
export async function getBoss(): Promise<PgBoss> {
  if (g.__boss) return g.__boss
  if (g.__bossStarting) return g.__bossStarting

  // Starting pg-boss installs the `pgboss` schema. Never do that while the
  // feature is off, whatever code path asked for a queue.
  if (process.env.WHATSAPP_ENABLED?.trim() !== "true") {
    throw new Error("Queue is unavailable: WHATSAPP_ENABLED is not \"true\"")
  }

  const databaseUrl = getRuntimeConfig().worker.databaseUrl
  if (!databaseUrl) {
    throw new Error("Queue database is not configured: set QUEUE_DATABASE_URL or DIRECT_URL")
  }
  return connect(databaseUrl, "send-only")
}
