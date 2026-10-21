import { beforeEach, describe, expect, it, vi } from "vitest"
import { Prisma } from "@prisma/client"

const { db } = vi.hoisted(() => ({
  db: {
    whatsAppSettings: { findUnique: vi.fn() },
    aiUsageRecord: { aggregate: vi.fn() },
    whatsAppMessage: { count: vi.fn() },
  },
}))

vi.mock("@/lib/db/prisma", () => ({ default: db }))

import { aiRepliesLast24h, bogotaDayStart, getAiLimits, isOverDailyBudget, normalizeTopics, spentTodayUsd } from "../limits"

const ENV = { maxTurnsPerDay: 30, maxConsecutiveFailures: 2, forbiddenTopics: ["política"] }

beforeEach(() => {
  vi.resetAllMocks()
  db.whatsAppSettings.findUnique.mockResolvedValue(null)
  db.aiUsageRecord.aggregate.mockResolvedValue({ _sum: { estimatedCostUsd: null } })
})

describe("getAiLimits (S3)", () => {
  it("falls back to the server env when nothing is saved, with no daily cap", async () => {
    await expect(getAiLimits(ENV)).resolves.toEqual({
      dailyBudgetUsd: null,
      maxTurnsPerDay: 30,
      maxConsecutiveFailures: 2,
      forbiddenTopics: ["política"],
    })
  })

  it("uses the saved values over the env, and adds the saved topics to the env list", async () => {
    db.whatsAppSettings.findUnique.mockResolvedValue({
      dailyBudgetUsd: new Prisma.Decimal("12.50"),
      maxTurnsPerDay: 10,
      maxConsecutiveFailures: 3,
      forbiddenTopics: ["Criptomonedas", "POLÍTICA"],
    })

    await expect(getAiLimits(ENV)).resolves.toEqual({
      dailyBudgetUsd: 12.5,
      maxTurnsPerDay: 10,
      maxConsecutiveFailures: 3,
      forbiddenTopics: ["política", "Criptomonedas"],
    })
  })

  it("treats empty saved fields as not set", async () => {
    db.whatsAppSettings.findUnique.mockResolvedValue({
      dailyBudgetUsd: null,
      maxTurnsPerDay: null,
      maxConsecutiveFailures: null,
      forbiddenTopics: [],
    })

    await expect(getAiLimits(ENV)).resolves.toMatchObject({ dailyBudgetUsd: null, maxTurnsPerDay: 30, maxConsecutiveFailures: 2 })
  })
})

describe("normalizeTopics", () => {
  it("trims, drops empty entries and removes case and accent duplicates", () => {
    expect(normalizeTopics(["  apuestas ", "", "Apuestas", "politica", "política"])).toEqual(["apuestas", "politica"])
  })
})

describe("bogotaDayStart (S4)", () => {
  it("is Bogota midnight expressed in UTC (05:00Z)", () => {
    expect(bogotaDayStart(new Date("2026-10-21T04:59:59Z")).toISOString()).toBe("2026-10-20T05:00:00.000Z")
    expect(bogotaDayStart(new Date("2026-10-21T05:00:00Z")).toISOString()).toBe("2026-10-21T05:00:00.000Z")
  })
})

describe("spentTodayUsd and isOverDailyBudget (S4)", () => {
  const now = new Date("2026-10-21T15:00:00Z")

  it("sums the estimated cost of every usage record since Bogota midnight", async () => {
    db.aiUsageRecord.aggregate.mockResolvedValue({ _sum: { estimatedCostUsd: new Prisma.Decimal("3.250000") } })

    await expect(spentTodayUsd(now)).resolves.toBe(3.25)
    expect(db.aiUsageRecord.aggregate).toHaveBeenCalledWith({
      _sum: { estimatedCostUsd: true },
      where: { createdAt: { gte: new Date("2026-10-21T05:00:00Z") } },
    })
  })

  it("is zero when nothing was spent", async () => {
    await expect(spentTodayUsd(now)).resolves.toBe(0)
  })

  it("is over the cap at or above it, and never without a cap", async () => {
    db.aiUsageRecord.aggregate.mockResolvedValue({ _sum: { estimatedCostUsd: new Prisma.Decimal("5") } })

    await expect(isOverDailyBudget({ dailyBudgetUsd: 5 }, now)).resolves.toBe(true)
    await expect(isOverDailyBudget({ dailyBudgetUsd: 5.01 }, now)).resolves.toBe(false)
    await expect(isOverDailyBudget({ dailyBudgetUsd: null }, now)).resolves.toBe(false)
  })

  it("does not query the spend when there is no cap", async () => {
    await isOverDailyBudget({ dailyBudgetUsd: null }, now)

    expect(db.aiUsageRecord.aggregate).not.toHaveBeenCalled()
  })
})

describe("aiRepliesLast24h", () => {
  it("counts the AI replies of the conversation in the last 24 hours that did not fail", async () => {
    db.whatsAppMessage.count.mockResolvedValue(7)
    const now = new Date("2026-10-21T15:00:00Z")

    await expect(aiRepliesLast24h("conv-1", now)).resolves.toBe(7)
    expect(db.whatsAppMessage.count).toHaveBeenCalledWith({
      where: {
        conversationId: "conv-1",
        direction: "OUT",
        source: "AI",
        status: { not: "FAILED" },
        createdAt: { gte: new Date("2026-10-20T15:00:00Z") },
      },
    })
  })
})
