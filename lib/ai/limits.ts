import type { Prisma } from "@prisma/client"
import prisma from "@/lib/db/prisma"
import type { AiConfig } from "@/lib/config/runtime-config"
import { normalizeSearchText } from "@/lib/whatsapp/search"

/**
 * AI cost and abuse limits. A SUPER_ADMIN sets them in Configuración → WhatsApp; a field left
 * empty falls back to the server env. Read on every turn and transcription, so a change applies
 * to the next one without a deploy.
 *
 * - dailyBudgetUsd: global cap on the estimated spend of the Bogota day (null = no cap).
 * - maxTurnsPerDay / maxConsecutiveFailures: per conversation, as AI_MAX_TURNS_PER_DAY and
 *   AI_MAX_CONSECUTIVE_FAILURES.
 * - forbiddenTopics: AI_FORBIDDEN_TOPICS plus the saved list.
 */

export interface AiLimits {
  dailyBudgetUsd: number | null
  maxTurnsPerDay: number
  maxConsecutiveFailures: number
  forbiddenTopics: string[]
}

type EnvLimits = Pick<AiConfig, "maxTurnsPerDay" | "maxConsecutiveFailures" | "forbiddenTopics">
type LimitsDb = Pick<Prisma.TransactionClient, "whatsAppSettings" | "aiUsageRecord" | "whatsAppMessage">

const DAY_MS = 24 * 60 * 60 * 1000
/** Bogota is UTC-5 all year (no daylight saving). */
const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000

/** Trimmed, without empty entries or duplicates (ignoring case and accents); first spelling wins. */
export function normalizeTopics(topics: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of topics) {
    const topic = raw.trim()
    const key = normalizeSearchText(topic)
    if (!topic || seen.has(key)) continue
    seen.add(key)
    result.push(topic)
  }
  return result
}

export async function getAiLimits(env: EnvLimits, db: LimitsDb = prisma): Promise<AiLimits> {
  const saved = await db.whatsAppSettings.findUnique({
    where: { id: "singleton" },
    select: { dailyBudgetUsd: true, maxTurnsPerDay: true, maxConsecutiveFailures: true, forbiddenTopics: true },
  })
  return {
    dailyBudgetUsd: saved?.dailyBudgetUsd == null ? null : Number(saved.dailyBudgetUsd),
    maxTurnsPerDay: saved?.maxTurnsPerDay ?? env.maxTurnsPerDay,
    maxConsecutiveFailures: saved?.maxConsecutiveFailures ?? env.maxConsecutiveFailures,
    forbiddenTopics: normalizeTopics([...env.forbiddenTopics, ...(saved?.forbiddenTopics ?? [])]),
  }
}

/** Midnight in Bogota, as a UTC instant. */
export function bogotaDayStart(now: Date): Date {
  const bogota = new Date(now.getTime() - BOGOTA_OFFSET_MS)
  return new Date(Date.UTC(bogota.getUTCFullYear(), bogota.getUTCMonth(), bogota.getUTCDate()) + BOGOTA_OFFSET_MS)
}

/** Estimated spend (chat turns and transcriptions) since Bogota midnight, as "Uso de IA" shows it. */
export async function spentTodayUsd(now: Date, db: LimitsDb = prisma): Promise<number> {
  const result = await db.aiUsageRecord.aggregate({
    _sum: { estimatedCostUsd: true },
    where: { createdAt: { gte: bogotaDayStart(now) } },
  })
  return Number(result._sum.estimatedCostUsd ?? 0)
}

export async function isOverDailyBudget(
  limits: Pick<AiLimits, "dailyBudgetUsd">,
  now: Date,
  db: LimitsDb = prisma
): Promise<boolean> {
  if (limits.dailyBudgetUsd === null) return false
  return (await spentTodayUsd(now, db)) >= limits.dailyBudgetUsd
}

/** AI replies the conversation got in the last 24 hours (failed sends do not count). */
export async function aiRepliesLast24h(conversationId: string, now: Date, db: LimitsDb = prisma): Promise<number> {
  return db.whatsAppMessage.count({
    where: {
      conversationId,
      direction: "OUT",
      source: "AI",
      status: { not: "FAILED" },
      createdAt: { gte: new Date(now.getTime() - DAY_MS) },
    },
  })
}
