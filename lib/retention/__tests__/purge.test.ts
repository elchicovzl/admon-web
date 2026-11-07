import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  conversationFindMany: vi.fn(),
  conversationUpdate: vi.fn(),
  conversationUpdateMany: vi.fn(),
  conversationDeleteMany: vi.fn(),
  mediaFindMany: vi.fn(),
  mediaUpdateMany: vi.fn(),
  usageUpdateMany: vi.fn(),
  leadUpdateMany: vi.fn(),
  eventDeleteMany: vi.fn(),
  transaction: vi.fn(),
  deleteObjects: vi.fn(),
  whatsAppEnabled: vi.fn(),
  getWhatsAppConfig: vi.fn(),
}))

const tx = {
  conversation: { deleteMany: m.conversationDeleteMany, updateMany: m.conversationUpdateMany },
  aiUsageRecord: { updateMany: m.usageUpdateMany },
  lead: { updateMany: m.leadUpdateMany },
}
vi.mock("@/lib/db/prisma", () => ({
  default: {
    conversation: { findMany: m.conversationFindMany, update: m.conversationUpdate },
    whatsAppMedia: { findMany: m.mediaFindMany, updateMany: m.mediaUpdateMany },
    whatsAppWebhookEvent: { deleteMany: m.eventDeleteMany },
    $transaction: m.transaction,
  },
}))
vi.mock("@/lib/storage/r2", () => ({ deleteObjects: m.deleteObjects }))
vi.mock("@/lib/whatsapp/ingest", () => ({ isWhatsAppEnabled: m.whatsAppEnabled }))
vi.mock("@/lib/config/runtime-config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/config/runtime-config")>()),
  getWhatsAppConfig: m.getWhatsAppConfig,
}))

import { handleRetentionPurgeJobs, purgeInactiveConversations, purgeOldWebhookEvents } from "../purge"

const NOW = new Date("2026-10-23T08:00:00Z")
const DAY = 24 * 60 * 60 * 1000
const CUTOFF = new Date(NOW.getTime() - 365 * DAY)

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.spyOn(console, "info").mockImplementation(() => {})
  m.conversationFindMany.mockResolvedValueOnce([{ id: "conv-old" }]).mockResolvedValue([])
  m.mediaFindMany.mockResolvedValue([
    { id: "media-1", s3Key: "whatsapp/conv-old/a.jpg" },
    { id: "media-2", s3Key: "whatsapp/conv-old/b.ogg" },
  ])
  m.deleteObjects.mockResolvedValue({ deleted: ["whatsapp/conv-old/a.jpg", "whatsapp/conv-old/b.ogg"], failed: [] })
  m.conversationDeleteMany.mockResolvedValue({ count: 1 })
  m.transaction.mockImplementation(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx))
  m.eventDeleteMany.mockResolvedValue({ count: 4 })
  m.whatsAppEnabled.mockReturnValue(true)
  m.getWhatsAppConfig.mockReturnValue({ retentionDays: 365, webhookEventRetentionDays: 30 })
})

describe("purgeInactiveConversations", () => {
  it("selects conversations whose last message is older than the retention period", async () => {
    await purgeInactiveConversations({ now: NOW, retentionDays: 365 })

    expect(m.conversationFindMany.mock.calls[0][0]).toMatchObject({ where: { lastMessageAt: { lt: CUTOFF } } })
  })

  it("deletes the files in R2 first, then the conversation, keeping the contact, lead and usage", async () => {
    expect(await purgeInactiveConversations({ now: NOW, retentionDays: 365 })).toEqual({ purged: 1, kept: 0 })

    expect(m.deleteObjects).toHaveBeenCalledWith(["whatsapp/conv-old/a.jpg", "whatsapp/conv-old/b.ogg"])
    expect(m.mediaUpdateMany).toHaveBeenCalledWith({ where: { id: { in: ["media-1", "media-2"] } }, data: { r2DeletedAt: NOW } })
    expect(m.deleteObjects.mock.invocationCallOrder[0]).toBeLessThan(m.conversationDeleteMany.mock.invocationCallOrder[0])
    // Re-checked inside the transaction: a conversation that just got a message is not deleted.
    expect(m.conversationDeleteMany).toHaveBeenCalledWith({ where: { id: "conv-old", lastMessageAt: { lt: CUTOFF } } })
    // Usage records stay for the cost reports and the lead stays; they only lose the reference.
    expect(m.usageUpdateMany).toHaveBeenCalledWith({ where: { conversationId: "conv-old" }, data: { conversationId: null } })
    expect(m.leadUpdateMany).toHaveBeenCalledWith({ where: { conversationId: "conv-old" }, data: { conversationId: null } })
  })

  it("marks the conversation as pending purge before touching R2, so it leaves the client's WhatsApp tab", async () => {
    await purgeInactiveConversations({ now: NOW, retentionDays: 365 })

    expect(m.conversationUpdate).toHaveBeenCalledWith({ where: { id: "conv-old" }, data: { purgePendingAt: NOW } })
    expect(m.conversationUpdate.mock.invocationCallOrder[0]).toBeLessThan(m.deleteObjects.mock.invocationCallOrder[0])
  })

  it("keeps the conversation when a file could not be deleted, and only marks the files that are gone", async () => {
    m.deleteObjects.mockResolvedValue({
      deleted: ["whatsapp/conv-old/a.jpg"],
      failed: [{ key: "whatsapp/conv-old/b.ogg", code: "REQUEST_FAILED" }],
    })

    expect(await purgeInactiveConversations({ now: NOW, retentionDays: 365 })).toEqual({ purged: 0, kept: 1 })
    expect(m.mediaUpdateMany).toHaveBeenCalledWith({ where: { id: { in: ["media-1"] } }, data: { r2DeletedAt: NOW } })
    expect(m.conversationDeleteMany).not.toHaveBeenCalled()
    // Not left hidden from the client's WhatsApp tab while it waits for the retry.
    expect(m.conversationUpdate).toHaveBeenLastCalledWith({ where: { id: "conv-old" }, data: { purgePendingAt: null } })
  })

  it("does not ask the same run for a kept conversation again", async () => {
    m.deleteObjects.mockResolvedValue({ deleted: [], failed: [{ key: "whatsapp/conv-old/a.jpg", code: "REQUEST_FAILED" }] })

    await purgeInactiveConversations({ now: NOW, retentionDays: 365 })

    expect(m.conversationFindMany.mock.calls[1][0].where).toMatchObject({ id: { notIn: ["conv-old"] } })
  })

  it("clears the pending flag when the conversation got a new message meanwhile", async () => {
    m.conversationDeleteMany.mockResolvedValue({ count: 0 })

    expect(await purgeInactiveConversations({ now: NOW, retentionDays: 365 })).toEqual({ purged: 0, kept: 1 })
    expect(m.conversationUpdateMany).toHaveBeenCalledWith({ where: { id: "conv-old" }, data: { purgePendingAt: null } })
    expect(m.usageUpdateMany).not.toHaveBeenCalled()
  })

  it("deletes a conversation without files without calling R2", async () => {
    m.mediaFindMany.mockResolvedValue([])

    expect(await purgeInactiveConversations({ now: NOW, retentionDays: 365 })).toEqual({ purged: 1, kept: 0 })
    expect(m.deleteObjects).not.toHaveBeenCalled()
  })

  it("stops after the run limit", async () => {
    m.conversationFindMany.mockReset()
    m.conversationFindMany.mockImplementation(async ({ take }: { take: number }) =>
      Array.from({ length: take }, (_, i) => ({ id: `c-${Math.random()}-${i}` }))
    )
    m.mediaFindMany.mockResolvedValue([])

    const result = await purgeInactiveConversations({ now: NOW, retentionDays: 365, maxPerRun: 120 })

    expect(result.purged).toBe(120)
  })
})

describe("purgeOldWebhookEvents", () => {
  it("deletes processed raw webhook events older than their retention period", async () => {
    expect(await purgeOldWebhookEvents({ now: NOW, retentionDays: 30 })).toBe(4)
    expect(m.eventDeleteMany).toHaveBeenCalledWith({
      where: { receivedAt: { lt: new Date(NOW.getTime() - 30 * DAY) }, processedAt: { not: null } },
    })
  })
})

describe("handleRetentionPurgeJobs", () => {
  it("does nothing while WhatsApp is disabled", async () => {
    m.whatsAppEnabled.mockReturnValue(false)

    await handleRetentionPurgeJobs([{ id: "job-1", data: {} } as never])

    expect(m.conversationFindMany).not.toHaveBeenCalled()
    expect(m.eventDeleteMany).not.toHaveBeenCalled()
  })

  it("purges conversations and raw events with the configured periods", async () => {
    m.getWhatsAppConfig.mockReturnValue({ retentionDays: 180, webhookEventRetentionDays: 10 })

    await handleRetentionPurgeJobs([{ id: "job-1", data: {} } as never])

    const cutoff = m.conversationFindMany.mock.calls[0][0].where.lastMessageAt.lt as Date
    expect(Math.round((Date.now() - cutoff.getTime()) / DAY)).toBe(180)
    const eventsCutoff = m.eventDeleteMany.mock.calls[0][0].where.receivedAt.lt as Date
    expect(Math.round((Date.now() - eventsCutoff.getTime()) / DAY)).toBe(10)
  })
})
