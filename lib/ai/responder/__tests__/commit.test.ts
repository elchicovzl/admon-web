import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    whatsAppMessage: { count: vi.fn() },
    conversation: { update: vi.fn(), updateMany: vi.fn() },
  }
  return {
    tx,
    order: [] as string[],
    createOutbound: vi.fn(),
    enqueueSend: vi.fn(),
    touch: vi.fn(),
    applyTransition: vi.fn(),
    liveAi: vi.fn(),
    notify: vi.fn(),
  }
})
vi.mock("@/lib/db/prisma", () => ({
  default: {
    $transaction: async (fn: (tx: typeof m.tx) => unknown) => {
      m.order.push("tx:start")
      const result = await fn(m.tx)
      m.order.push("tx:commit")
      return result
    },
  },
}))
vi.mock("@/lib/whatsapp/send", () => ({ createOutboundMessage: m.createOutbound, enqueueOutboundSend: m.enqueueSend }))
vi.mock("@/lib/whatsapp/outbound", () => ({ touchConversation: m.touch }))
vi.mock("@/lib/whatsapp/transitions", () => ({ applyTransition: m.applyTransition, isAiGloballyEnabled: m.liveAi }))
vi.mock("@/lib/notifications/port", () => ({ getNotifyPort: () => ({ notify: m.notify }) }))

import { consentNotice } from "../consent"
import { commitAiEscalation, commitAiReply } from "../commit"

const NOW = new Date("2026-10-20T15:00:00Z")
const NEWEST = new Date("2026-10-20T14:59:50Z")
const SITE = "https://administracionsegura.co"
const snapshot = { conversationId: "conv-1", stateVersion: 7, newestPendingAt: NEWEST }
const locked = (overrides: Record<string, unknown> = {}) => [
  { id: "conv-1", status: "AI", stateVersion: 7, aiPaused: false, consentNoticeSentAt: new Date("2026-10-01T00:00:00Z"), ...overrides },
]
const reply = {
  snapshot,
  text: "Necesita la cédula.",
  sourceChunkIds: ["chunk-1"],
  usageRecordId: "usage-1",
  consecutiveFailures: 0,
  globalAi: true,
  ignoreNewerInbound: false,
  siteUrl: SITE,
  now: NOW,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
  m.order.length = 0
  m.tx.$queryRaw.mockResolvedValue(locked())
  m.tx.whatsAppMessage.count.mockResolvedValue(0)
  m.tx.conversation.update.mockResolvedValue({})
  m.createOutbound.mockImplementation(async () => {
    m.order.push("create")
    return { id: "msg-ai" }
  })
  m.enqueueSend.mockImplementation(async () => {
    m.order.push("enqueue")
  })
  m.touch.mockResolvedValue(undefined)
  m.applyTransition.mockResolvedValue({ ok: true, from: "AI", to: "ESCALATED", changed: true, stateVersion: 8, scheduleAiTurn: false, notifyActivity: false })
  m.notify.mockResolvedValue(undefined)
  m.liveAi.mockResolvedValue(true)
})

describe("commitAiReply (CH-5, S-CH-2, S-AI-8)", () => {
  it("locks the conversation row FOR UPDATE before deciding", async () => {
    await commitAiReply(reply)

    const lock = m.tx.$queryRaw.mock.calls[0][0]
    expect(lock.sql).toMatch(/FROM\s+conversations[\s\S]*FOR UPDATE/i)
    expect(lock.values).toEqual(["conv-1"])
  })

  it("stores the AI message with its sources, usage and the decided version, then enqueues after commit (AI-16)", async () => {
    const r = await commitAiReply(reply)

    expect(r).toEqual({ status: "QUEUED", messageId: "msg-ai" })
    expect(m.createOutbound).toHaveBeenCalledWith(
      {
        kind: "text",
        conversationId: "conv-1",
        source: "AI",
        text: "Necesita la cédula.",
        sourceChunkIds: ["chunk-1"],
        usageRecordId: "usage-1",
        expectedStateVersion: 7,
      },
      m.tx
    )
    expect(m.tx.conversation.update).toHaveBeenCalledWith({
      where: { id: "conv-1" },
      data: { aiCursorAt: NEWEST, consecutiveAiFailures: 0 },
    })
    expect(m.touch).toHaveBeenCalledWith(m.tx, "conv-1", { type: "TEXT", text: "Necesita la cédula." }, NOW)
    expect(m.enqueueSend).toHaveBeenCalledWith({ messageId: "msg-ai", expectedStateVersion: 7 })
    expect(m.order).toEqual(["tx:start", "create", "tx:commit", "enqueue"])
  })

  it("discards the reply when a person took the conversation meanwhile, and sends nothing", async () => {
    m.tx.$queryRaw.mockResolvedValue(locked({ status: "HUMAN", stateVersion: 8 }))

    expect(await commitAiReply(reply)).toEqual({ status: "DISCARDED", reason: "NOT_AI" })
    expect(m.createOutbound).not.toHaveBeenCalled()
    expect(m.enqueueSend).not.toHaveBeenCalled()
  })

  it("discards on a version change, a pause, or AI switched off", async () => {
    m.tx.$queryRaw.mockResolvedValue(locked({ stateVersion: 8 }))
    expect(await commitAiReply(reply)).toEqual({ status: "DISCARDED", reason: "VERSION" })

    m.tx.$queryRaw.mockResolvedValue(locked({ aiPaused: true }))
    expect(await commitAiReply(reply)).toEqual({ status: "DISCARDED", reason: "PAUSED" })

    m.tx.$queryRaw.mockResolvedValue(locked())
    expect(await commitAiReply({ ...reply, globalAi: false })).toEqual({ status: "DISCARDED", reason: "AI_OFF" })
  })

  it("re-reads the AI switch inside the locked transaction: turning AI off stops a reply in flight", async () => {
    m.liveAi.mockResolvedValue(false)

    expect(await commitAiReply(reply)).toEqual({ status: "DISCARDED", reason: "AI_OFF" })
    expect(m.liveAi).toHaveBeenCalledWith(m.tx)
    expect(m.createOutbound).not.toHaveBeenCalled()
  })

  it("discards when the client wrote again after the batch, unless told to ignore it", async () => {
    m.tx.whatsAppMessage.count.mockResolvedValue(1)

    expect(await commitAiReply(reply)).toEqual({ status: "DISCARDED", reason: "NEWER_INBOUND" })
    expect(m.tx.whatsAppMessage.count).toHaveBeenCalledWith({
      where: { conversationId: "conv-1", direction: "IN", createdAt: { gt: NEWEST } },
    })
    expect(await commitAiReply({ ...reply, ignoreNewerInbound: true })).toEqual({ status: "QUEUED", messageId: "msg-ai" })
  })

  it("prefixes the consent notice while it was never delivered and records the carrier (AI-5, S-AI-12)", async () => {
    m.tx.$queryRaw.mockResolvedValue(locked({ consentNoticeSentAt: null }))

    await commitAiReply(reply)

    expect(m.createOutbound.mock.calls[0][0].text).toBe(`${consentNotice(SITE)}\n\nNecesita la cédula.`)
    expect(m.tx.conversation.update).toHaveBeenCalledWith({
      where: { id: "conv-1" },
      data: { aiCursorAt: NEWEST, consecutiveAiFailures: 0, consentNoticeMessageId: "msg-ai" },
    })
  })

  it("records the consecutive failure count it is given (the fallback path)", async () => {
    await commitAiReply({ ...reply, consecutiveFailures: 1 })

    expect(m.tx.conversation.update.mock.calls[0][0].data).toMatchObject({ consecutiveAiFailures: 1 })
  })
})

describe("commitAiEscalation (AI-9, S-AI-4/5)", () => {
  const escalation = {
    snapshot,
    reason: "USER_REQUEST" as const,
    outOfHours: false,
    attentionDueAt: NOW,
    text: "Un asesor lo atenderá en breve.",
    usageRecordId: null,
    globalAi: true,
    siteUrl: SITE,
    now: NOW,
  }

  it("moves the conversation to ESCALATED, sends the handoff text under the new version, then notifies staff", async () => {
    const r = await commitAiEscalation(escalation)

    expect(r).toEqual({ status: "ESCALATED", messageId: "msg-ai" })
    const [transitionInput, transitionOptions] = m.applyTransition.mock.calls[0]
    expect(transitionInput).toEqual({
      conversationId: "conv-1",
      event: "AI_ESCALATE",
      actor: "AI",
      escalation: { reason: "USER_REQUEST", outOfHours: false, attentionDueAt: NOW },
    })
    // Same transaction, and the escalation time the notification dedups on.
    expect(transitionOptions.db).toBe(m.tx)
    expect(transitionOptions.now()).toEqual(NOW)
    expect(m.createOutbound.mock.calls[0][0]).toMatchObject({ source: "AI", text: "Un asesor lo atenderá en breve.", expectedStateVersion: 8 })
    expect(m.enqueueSend).toHaveBeenCalledWith({ messageId: "msg-ai", expectedStateVersion: 8 })
    expect(m.notify).toHaveBeenCalledWith({ type: "ESCALATION", conversationId: "conv-1", escalatedAt: NOW })
    expect(m.order.indexOf("tx:commit")).toBeLessThan(m.order.indexOf("enqueue"))
  })

  it("passes the out-of-hours flag and the next business slot (S-AI-5)", async () => {
    const monday = new Date("2026-10-26T13:00:00Z")

    await commitAiEscalation({ ...escalation, outOfHours: true, attentionDueAt: monday })

    expect(m.applyTransition.mock.calls[0][0].escalation).toEqual({ reason: "USER_REQUEST", outOfHours: true, attentionDueAt: monday })
  })

  it("does not escalate with an AI message once AI was switched off, except to report an AI failure", async () => {
    m.liveAi.mockResolvedValue(false)

    expect(await commitAiEscalation(escalation)).toEqual({ status: "DISCARDED", reason: "AI_OFF" })
    expect(await commitAiEscalation({ ...escalation, reason: "AI_FAILURE" })).toEqual({ status: "ESCALATED", messageId: "msg-ai" })
  })

  it("sends an AI_FAILURE notification for a provider failure (S-AI-11)", async () => {
    await commitAiEscalation({ ...escalation, reason: "AI_FAILURE" })

    expect(m.notify).toHaveBeenCalledWith({ type: "AI_FAILURE", conversationId: "conv-1" })
  })

  it("does nothing when the conversation already left AI (S-CH-8)", async () => {
    m.tx.$queryRaw.mockResolvedValue(locked({ status: "HUMAN" }))

    expect(await commitAiEscalation(escalation)).toEqual({ status: "DISCARDED", reason: "NOT_AI" })
    expect(m.applyTransition).not.toHaveBeenCalled()
    expect(m.notify).not.toHaveBeenCalled()
  })

  it("keeps the escalation when the notification fails", async () => {
    m.notify.mockRejectedValue(new Error("down"))

    expect(await commitAiEscalation(escalation)).toEqual({ status: "ESCALATED", messageId: "msg-ai" })
  })
})
