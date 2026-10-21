import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({ messageFindUnique: vi.fn(), conversationUpdateMany: vi.fn() }))
vi.mock("@/lib/db/prisma", () => ({
  default: {
    whatsAppMessage: { findUnique: m.messageFindUnique },
    conversation: { updateMany: m.conversationUpdateMany },
  },
}))

import { recordAiMessageSent } from "../sent-hook"

const SENT_AT = new Date("2026-10-20T15:00:00Z")

beforeEach(() => {
  vi.clearAllMocks()
  m.conversationUpdateMany.mockResolvedValue({ count: 1 })
  m.messageFindUnique.mockResolvedValue({ id: "msg-1", source: "AI", conversationId: "conv-1", sentAt: SENT_AT })
})

describe("recordAiMessageSent (onSent hook)", () => {
  it("moves lastAiSentAt forward only (echo takeover relies on it)", async () => {
    await recordAiMessageSent("msg-1")

    expect(m.conversationUpdateMany).toHaveBeenCalledWith({
      where: { id: "conv-1", OR: [{ lastAiSentAt: null }, { lastAiSentAt: { lt: SENT_AT } }] },
      data: { lastAiSentAt: SENT_AT },
    })
  })

  it("records consent evidence once, only for the message that carried the notice (S-AI-12)", async () => {
    await recordAiMessageSent("msg-1")

    expect(m.conversationUpdateMany).toHaveBeenCalledWith({
      where: { id: "conv-1", consentNoticeMessageId: "msg-1", consentNoticeSentAt: null },
      data: { consentNoticeSentAt: SENT_AT },
    })
  })

  it("ignores messages not sent by the AI and unknown messages", async () => {
    m.messageFindUnique.mockResolvedValue({ id: "msg-1", source: "DASHBOARD", conversationId: "conv-1", sentAt: SENT_AT })
    await recordAiMessageSent("msg-1")
    m.messageFindUnique.mockResolvedValue(null)
    await recordAiMessageSent("msg-1")

    expect(m.conversationUpdateMany).not.toHaveBeenCalled()
  })

  it("is idempotent: running twice applies the same guarded updates", async () => {
    await recordAiMessageSent("msg-1")
    await recordAiMessageSent("msg-1")

    expect(m.conversationUpdateMany).toHaveBeenCalledTimes(4)
    expect(m.conversationUpdateMany.mock.calls[2][0]).toEqual(m.conversationUpdateMany.mock.calls[0][0])
  })
})
