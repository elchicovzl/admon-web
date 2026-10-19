import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({ userFindMany: vi.fn(), createMany: vi.fn() }))
vi.mock("@/lib/db/prisma", () => ({
  default: { user: { findMany: m.userFindMany }, notification: { createMany: m.createMany } },
}))

import { dbNotifyPort, fanOutNotification, findNotificationRecipients, toNotificationDraft } from "../notify"

beforeEach(() => {
  vi.clearAllMocks()
  m.userFindMany.mockResolvedValue([{ id: "u1" }, { id: "u2" }])
  m.createMany.mockResolvedValue({ count: 2 })
})

describe("findNotificationRecipients", () => {
  it("targets active SUPER_ADMIN users and active users with WhatsApp access, nobody else", async () => {
    await expect(findNotificationRecipients()).resolves.toEqual(["u1", "u2"])

    expect(m.userFindMany).toHaveBeenCalledWith({
      where: { isActive: true, OR: [{ role: "SUPER_ADMIN" }, { canAccessWhatsApp: true }] },
      select: { id: true },
    })
  })
})

describe("toNotificationDraft", () => {
  const escalatedAt = new Date("2026-10-19T15:00:00Z")

  it("keys an escalation by the transition, so a retried emit is idempotent", () => {
    expect(toNotificationDraft({ type: "ESCALATION", conversationId: "c1", escalatedAt })).toEqual({
      type: "ESCALATION",
      conversationId: "c1",
      entityId: null,
      dedupKey: `escalation:c1:${escalatedAt.getTime()}`,
    })
  })

  it("keys activity per conversation (one unread per conversation and user)", () => {
    expect(toNotificationDraft({ type: "NEW_ACTIVITY_ON_ESCALATED", conversationId: "c1" })).toMatchObject({
      type: "NEW_ACTIVITY_ON_ESCALATED",
      dedupKey: "activity:c1",
    })
  })

  it("keys an AI failure per conversation", () => {
    expect(toNotificationDraft({ type: "AI_FAILURE", conversationId: "c1" })).toMatchObject({
      type: "AI_FAILURE",
      dedupKey: "ai-failure:c1",
    })
  })

  it("keys a new lead by lead id and keeps the conversation when there is one", () => {
    expect(toNotificationDraft({ type: "NEW_LEAD", leadId: "l1", contactId: "k1", conversationId: "c1" })).toEqual({
      type: "NEW_LEAD",
      conversationId: "c1",
      entityId: "l1",
      dedupKey: "lead:l1",
    })
    expect(toNotificationDraft({ type: "NEW_LEAD", leadId: "l1", contactId: "k1" }).conversationId).toBeNull()
  })

  it("keys a draft review by draft id", () => {
    expect(toNotificationDraft({ type: "DRAFT_PENDING_REVIEW", draftId: "d1" })).toEqual({
      type: "DRAFT_PENDING_REVIEW",
      conversationId: null,
      entityId: "d1",
      dedupKey: "draft:d1",
    })
  })
})

describe("fanOutNotification", () => {
  it("creates one row per recipient with skipDuplicates (dedup via the unique key)", async () => {
    const count = await fanOutNotification({ type: "NEW_ACTIVITY_ON_ESCALATED", conversationId: "c1" })

    expect(count).toBe(2)
    expect(m.createMany).toHaveBeenCalledWith({
      data: [
        { userId: "u1", type: "NEW_ACTIVITY_ON_ESCALATED", conversationId: "c1", entityId: null, dedupKey: "activity:c1" },
        { userId: "u2", type: "NEW_ACTIVITY_ON_ESCALATED", conversationId: "c1", entityId: null, dedupKey: "activity:c1" },
      ],
      skipDuplicates: true,
    })
  })

  it("reports only what was inserted when some recipients already have an unread one", async () => {
    m.createMany.mockResolvedValue({ count: 1 })

    await expect(fanOutNotification({ type: "AI_FAILURE", conversationId: "c1" })).resolves.toBe(1)
  })

  it("does nothing when nobody can see WhatsApp", async () => {
    m.userFindMany.mockResolvedValue([])

    await expect(fanOutNotification({ type: "AI_FAILURE", conversationId: "c1" })).resolves.toBe(0)
    expect(m.createMany).not.toHaveBeenCalled()
  })

  it("is what the notify port runs", async () => {
    await dbNotifyPort.notify({ type: "NEW_LEAD", leadId: "l1", contactId: "k1", conversationId: "c1" })

    expect(m.createMany).toHaveBeenCalledTimes(1)
  })
})
