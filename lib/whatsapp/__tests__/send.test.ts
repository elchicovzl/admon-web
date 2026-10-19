import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  msgCreate: vi.fn(),
  msgFindUnique: vi.fn(),
  msgUpdateMany: vi.fn(),
  executeRaw: vi.fn(),
  bossSend: vi.fn(),
  sendText: vi.fn(),
  sendTemplate: vi.fn(),
  applyStoredStatuses: vi.fn(),
}))

const tx = {
  $executeRaw: m.executeRaw,
  whatsAppMessage: { findUnique: m.msgFindUnique, updateMany: m.msgUpdateMany },
}
vi.mock("@/lib/db/prisma", () => ({
  default: {
    whatsAppMessage: { create: m.msgCreate, findUnique: m.msgFindUnique, updateMany: m.msgUpdateMany },
    $transaction: async (fn: (client: typeof tx) => unknown) => fn(tx),
  },
}))
vi.mock("@/lib/queue/boss", () => ({ getBoss: async () => ({ send: m.bossSend }) }))
vi.mock("@/lib/config/runtime-config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/config/runtime-config")>()),
  getWhatsAppConfig: () => ({
    templates: { resume: "resume_conversation", processUpdate: "process_update", language: "es", approved: ["RESUME"] },
  }),
}))
vi.mock("../statuses", () => ({ applyStoredStatuses: m.applyStoredStatuses }))
vi.mock("../cloud-api", async () => {
  const actual = await vi.importActual<typeof import("../cloud-api")>("../cloud-api")
  return { ...actual, sendText: m.sendText, sendTemplate: m.sendTemplate }
})

import { CloudApiError } from "../cloud-api"
import {
  TemplateNotApprovedError,
  createOutboundMessage,
  enqueueOutboundSend,
  handleSendJobs,
  queueOutbound,
  sendOutboundMessage,
  setOnSentHook,
} from "../send"

const NOW = new Date("2026-10-19T12:00:00Z")
const LAST_ATTEMPT = { isLastAttempt: true, now: () => NOW }
const RETRYING = { isLastAttempt: false, now: () => NOW }

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "m1",
    direction: "OUT",
    status: "QUEUED",
    wamid: null,
    type: "TEXT",
    text: "Hola",
    templateName: null,
    templateParams: null,
    contextWamid: null,
    conversation: {
      stateVersion: 3,
      lastInboundAt: new Date(NOW.getTime() - 60 * 60 * 1000),
      contact: { waId: "573001234567" },
    },
    ...overrides,
  }
}

function failedWith(code: string) {
  return m.msgUpdateMany.mock.calls.find(([arg]) => arg.data.status === "FAILED" && arg.data.errorCode === code)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.stubEnv("WHATSAPP_ENABLED", "true")
  setOnSentHook(undefined)
  m.msgCreate.mockResolvedValue({ id: "m1" })
  m.msgFindUnique.mockImplementation(async ({ select }) =>
    "conversationId" in select ? { conversationId: "conv-1" } : row()
  )
  m.msgUpdateMany.mockResolvedValue({ count: 1 })
  m.sendText.mockResolvedValue({ wamid: "wamid.OUT1" })
  m.sendTemplate.mockResolvedValue({ wamid: "wamid.TPL1" })
  m.bossSend.mockResolvedValue("job")
})

describe("queueOutbound (outbox insert, WC-10)", () => {
  it("inserts OUT/QUEUED with no wamid, then enqueues wa.message.send", async () => {
    await queueOutbound({ kind: "text", conversationId: "conv-1", source: "DASHBOARD", text: "Hola", sentById: "u1" })

    expect(m.msgCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conversationId: "conv-1",
        direction: "OUT",
        source: "DASHBOARD",
        type: "TEXT",
        text: "Hola",
        status: "QUEUED",
        statusRank: 0,
        sentById: "u1",
      }),
      select: { id: true },
    })
    expect(m.msgCreate.mock.calls[0][0].data).not.toHaveProperty("wamid")
    expect(m.bossSend).toHaveBeenCalledWith(
      "wa.message.send",
      { messageId: "m1", expectedStateVersion: undefined },
      { singletonKey: "m1" }
    )
  })

  it("carries the expected state version and AI audit fields", async () => {
    await queueOutbound({
      kind: "text",
      conversationId: "conv-1",
      source: "AI",
      text: "Respuesta",
      sourceChunkIds: ["c1"],
      usageRecordId: "u1",
      expectedStateVersion: 7,
    })

    expect(m.msgCreate.mock.calls[0][0].data).toMatchObject({ source: "AI", sourceChunkIds: ["c1"], usageRecordId: "u1" })
    expect(m.bossSend.mock.calls[0][1]).toEqual({ messageId: "m1", expectedStateVersion: 7 })
  })

  it("stores an approved template as TEMPLATE with the Meta name and params (S-WI-8)", async () => {
    await createOutboundMessage({
      kind: "template",
      conversationId: "conv-1",
      source: "DASHBOARD",
      templateKey: "RESUME",
      params: ["Ana"],
    })

    expect(m.msgCreate.mock.calls[0][0].data).toMatchObject({
      type: "TEMPLATE",
      templateName: "resume_conversation",
      templateParams: ["Ana"],
    })
    expect(m.bossSend).not.toHaveBeenCalled()
  })

  it("rejects unapproved templates, wrong parameter counts and empty text (WI-10)", async () => {
    const base = { conversationId: "conv-1", source: "DASHBOARD" as const }
    await expect(
      createOutboundMessage({ ...base, kind: "template", templateKey: "PROCESS_UPDATE", params: ["Ana", "1"] })
    ).rejects.toBeInstanceOf(TemplateNotApprovedError)
    await expect(
      createOutboundMessage({ ...base, kind: "template", templateKey: "RESUME", params: [] })
    ).rejects.toThrow("expects 1")
    await expect(createOutboundMessage({ ...base, kind: "text", text: "   " })).rejects.toThrow("empty")
    expect(m.msgCreate).not.toHaveBeenCalled()
  })

  it("marks the row FAILED when the queue is unavailable instead of leaving it QUEUED", async () => {
    m.bossSend.mockRejectedValue(new Error("queue down"))

    await expect(enqueueOutboundSend({ messageId: "m1" })).rejects.toThrow("queue down")

    expect(failedWith("QUEUE_UNAVAILABLE")).toBeDefined()
  })
})

describe("sendOutboundMessage", () => {
  it("sends, then stores wamid + SENT + sentAt (WC-11) and applies stored statuses", async () => {
    await sendOutboundMessage({ messageId: "m1" }, RETRYING)

    expect(m.sendText).toHaveBeenCalledWith("573001234567", "Hola", { contextWamid: null })
    expect(m.msgUpdateMany).toHaveBeenCalledWith({
      where: { id: "m1", wamid: null, status: "QUEUED" },
      data: expect.objectContaining({ wamid: "wamid.OUT1", status: "SENT", statusRank: 1, sentAt: NOW }),
    })
    expect(m.applyStoredStatuses).toHaveBeenCalledWith("wamid.OUT1")
  })

  it("takes the per-conversation advisory lock before reading the message", async () => {
    await sendOutboundMessage({ messageId: "m1" }, RETRYING)

    expect(m.executeRaw).toHaveBeenCalledTimes(1)
    const lockOrder = m.executeRaw.mock.invocationCallOrder[0]
    const txReadOrder = m.msgFindUnique.mock.invocationCallOrder[1]
    expect(lockOrder).toBeLessThan(txReadOrder)
  })

  it("sends templates with the configured language, even with the window closed (WC-13)", async () => {
    m.msgFindUnique.mockImplementation(async ({ select }) =>
      "conversationId" in select
        ? { conversationId: "conv-1" }
        : row({
            type: "TEMPLATE",
            text: null,
            templateName: "resume_conversation",
            templateParams: ["Ana"],
            conversation: { stateVersion: 3, lastInboundAt: null, contact: { waId: "573001234567" } },
          })
    )

    await sendOutboundMessage({ messageId: "m1" }, RETRYING)

    expect(m.sendTemplate).toHaveBeenCalledWith("573001234567", {
      name: "resume_conversation",
      language: "es",
      params: ["Ana"],
    })
    expect(m.sendText).not.toHaveBeenCalled()
  })

  it("fails WINDOW_CLOSED without calling Meta when the 24h window is closed (S-WC-12)", async () => {
    m.msgFindUnique.mockImplementation(async ({ select }) =>
      "conversationId" in select
        ? { conversationId: "conv-1" }
        : row({
            conversation: {
              stateVersion: 3,
              lastInboundAt: new Date(NOW.getTime() - 25 * 60 * 60 * 1000),
              contact: { waId: "573001234567" },
            },
          })
    )

    await sendOutboundMessage({ messageId: "m1" }, RETRYING)

    expect(m.sendText).not.toHaveBeenCalled()
    expect(failedWith("WINDOW_CLOSED")).toBeDefined()
  })

  it("aborts without sending when the state version moved since the sender decided (CH-4, CH-5)", async () => {
    await sendOutboundMessage({ messageId: "m1", expectedStateVersion: 2 }, RETRYING)

    expect(m.sendText).not.toHaveBeenCalled()
    expect(failedWith("STALE_STATE")).toBeDefined()
  })

  it("sends when the expected state version still matches", async () => {
    await sendOutboundMessage({ messageId: "m1", expectedStateVersion: 3 }, RETRYING)

    expect(m.sendText).toHaveBeenCalledTimes(1)
  })

  it("never sends a message that already has a wamid; it only re-applies statuses", async () => {
    m.msgFindUnique.mockImplementation(async ({ select }) =>
      "conversationId" in select ? { conversationId: "conv-1" } : row({ wamid: "wamid.OLD", status: "SENT" })
    )

    await sendOutboundMessage({ messageId: "m1" }, RETRYING)

    expect(m.sendText).not.toHaveBeenCalled()
    expect(m.applyStoredStatuses).toHaveBeenCalledWith("wamid.OLD")
  })

  it.each(["FAILED", "READ"])("skips a message that is already %s", async (status) => {
    m.msgFindUnique.mockImplementation(async ({ select }) =>
      "conversationId" in select ? { conversationId: "conv-1" } : row({ status })
    )

    await sendOutboundMessage({ messageId: "m1" }, RETRYING)

    expect(m.sendText).not.toHaveBeenCalled()
    expect(m.msgUpdateMany).not.toHaveBeenCalled()
  })

  it("rethrows a retryable error so pg-boss retries, leaving the row QUEUED", async () => {
    m.sendText.mockRejectedValue(new CloudApiError("busy", 503, null, true))

    await expect(sendOutboundMessage({ messageId: "m1" }, RETRYING)).rejects.toThrow("busy")

    expect(m.msgUpdateMany).not.toHaveBeenCalled()
  })

  it("marks FAILED when a retryable error exhausts its attempts", async () => {
    m.sendText.mockRejectedValue(new CloudApiError("busy", 503, null, true))

    await sendOutboundMessage({ messageId: "m1" }, LAST_ATTEMPT)

    expect(failedWith("RETRIES_EXHAUSTED")).toBeDefined()
  })

  it("marks FAILED with Meta's code and message on a permanent error and does not retry (S-WC-8)", async () => {
    m.sendText.mockRejectedValue(new CloudApiError("Recipient not allowed", 400, "131030", false))

    await expect(sendOutboundMessage({ messageId: "m1" }, RETRYING)).resolves.toBeUndefined()

    const failed = failedWith("131030")
    expect(failed?.[0].data).toMatchObject({ status: "FAILED", statusRank: 4, errorMessage: "Recipient not allowed" })
    expect(m.applyStoredStatuses).not.toHaveBeenCalled()
  })

  it("does not throw when the wamid cannot be stored, to avoid a duplicate send", async () => {
    m.msgUpdateMany.mockRejectedValue(new Error("db down"))

    await expect(sendOutboundMessage({ messageId: "m1" }, RETRYING)).resolves.toBeUndefined()

    expect(m.sendText).toHaveBeenCalledTimes(1)
    expect(m.msgUpdateMany).toHaveBeenCalledTimes(3)
    expect(m.applyStoredStatuses).not.toHaveBeenCalled()
  })

  it("calls the onSent hook once the message is SENT, and survives a hook failure", async () => {
    const hook = vi.fn().mockRejectedValue(new Error("hook boom"))
    setOnSentHook(hook)

    await expect(sendOutboundMessage({ messageId: "m1" }, RETRYING)).resolves.toBeUndefined()

    expect(hook).toHaveBeenCalledWith("m1")
  })

  it("does not call the onSent hook for a failed message", async () => {
    const hook = vi.fn()
    setOnSentHook(hook)
    m.sendText.mockRejectedValue(new CloudApiError("bad", 400, "100", false))

    await sendOutboundMessage({ messageId: "m1" }, RETRYING)

    expect(hook).not.toHaveBeenCalled()
  })
})

describe("handleSendJobs", () => {
  it("is a no-op while WHATSAPP_ENABLED is off (WC-12)", async () => {
    vi.stubEnv("WHATSAPP_ENABLED", "false")

    await handleSendJobs([{ id: "j", data: { messageId: "m1" }, retryCount: 0 } as never])

    expect(m.msgFindUnique).not.toHaveBeenCalled()
    expect(m.sendText).not.toHaveBeenCalled()
  })

  it("treats the retry-limit attempt as the last one", async () => {
    m.sendText.mockRejectedValue(new CloudApiError("busy", 503, null, true))

    // wa.message.send retryLimit is 4: retryCount 4 is the final run.
    await expect(
      handleSendJobs([{ id: "j", data: { messageId: "m1" }, retryCount: 3 } as never])
    ).rejects.toThrow("busy")
    await expect(
      handleSendJobs([{ id: "j", data: { messageId: "m1" }, retryCount: 4 } as never])
    ).resolves.toBeUndefined()
    expect(failedWith("RETRIES_EXHAUSTED")).toBeDefined()
  })
})
