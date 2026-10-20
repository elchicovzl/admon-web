import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  msgCreate: vi.fn(),
  msgFindUnique: vi.fn(),
  msgUpdateMany: vi.fn(),
  executeRaw: vi.fn(),
  bossSend: vi.fn(),
  sendText: vi.fn(),
  sendTemplate: vi.fn(),
  sendMedia: vi.fn(),
  getObjectBytes: vi.fn(),
  applyStoredStatuses: vi.fn(),
  runTx: vi.fn(),
}))

const tx = {
  $executeRaw: m.executeRaw,
  whatsAppMessage: { findUnique: m.msgFindUnique, updateMany: m.msgUpdateMany },
}
vi.mock("@/lib/db/prisma", () => ({
  default: {
    whatsAppMessage: { create: m.msgCreate, findUnique: m.msgFindUnique, updateMany: m.msgUpdateMany },
    $transaction: (fn: (client: typeof tx) => unknown) => m.runTx(fn),
  },
}))
vi.mock("@/lib/queue/boss", () => ({ getBoss: async () => ({ send: m.bossSend }) }))
vi.mock("@/lib/config/runtime-config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/config/runtime-config")>()),
  getWhatsAppConfig: () => ({
    templates: { resume: "resume_conversation", processUpdate: "process_update", language: "es", approved: ["RESUME"] },
  }),
}))
vi.mock("@/lib/storage/r2", () => ({ getObjectBytes: m.getObjectBytes }))
vi.mock("../statuses", () => ({ applyStoredStatuses: m.applyStoredStatuses }))
vi.mock("../cloud-api", async () => {
  const actual = await vi.importActual<typeof import("../cloud-api")>("../cloud-api")
  return { ...actual, sendText: m.sendText, sendTemplate: m.sendTemplate, sendMedia: m.sendMedia }
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
    sendAttemptedAt: null,
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
  m.sendMedia.mockResolvedValue({ wamid: "wamid.MEDIA1" })
  m.bossSend.mockResolvedValue("job")
  m.runTx.mockImplementation(async (fn: (client: typeof tx) => unknown) => fn(tx))
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
      text: expect.stringContaining("Hola Ana, le escribimos"),
    })
    expect(m.bossSend).not.toHaveBeenCalled()
  })

  it("stores an attachment as an IMAGE/DOCUMENT row with its STORED media, caption as text", async () => {
    await createOutboundMessage({
      kind: "media",
      conversationId: "conv-1",
      source: "DASHBOARD",
      mediaType: "DOCUMENT",
      caption: "  Su carta  ",
      file: { s3Key: "whatsapp/conv-1/out/abc.pdf", mimeType: "application/pdf", fileName: "carta.pdf", sizeBytes: 1234 },
    })

    expect(m.msgCreate.mock.calls[0][0].data).toMatchObject({
      type: "DOCUMENT",
      text: "Su carta",
      status: "QUEUED",
      media: {
        create: {
          metaMediaId: "outbound",
          mimeType: "application/pdf",
          sizeBytes: 1234,
          fileName: "carta.pdf",
          s3Key: "whatsapp/conv-1/out/abc.pdf",
          status: "STORED",
        },
      },
    })
    expect(m.msgCreate.mock.calls[0][0].data).not.toHaveProperty("wamid")
  })

  it("refuses an attachment without a stored file", async () => {
    await expect(
      createOutboundMessage({
        kind: "media",
        conversationId: "conv-1",
        source: "DASHBOARD",
        mediaType: "IMAGE",
        file: { s3Key: "", mimeType: "image/png", fileName: null, sizeBytes: 1 },
      })
    ).rejects.toThrow("stored file")
    expect(m.msgCreate).not.toHaveBeenCalled()
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
      where: { id: "m1", wamid: null, status: "QUEUED", sendAttemptedAt: null },
      data: { sendAttemptedAt: NOW },
    })
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

  it("rethrows a definite rejection (429) so pg-boss retries, clearing the attempt marker and leaving the row QUEUED", async () => {
    m.sendText.mockRejectedValue(new CloudApiError("busy", 429, null, true))

    await expect(sendOutboundMessage({ messageId: "m1" }, RETRYING)).rejects.toThrow("busy")

    expect(m.msgUpdateMany).toHaveBeenLastCalledWith({
      where: { id: "m1", wamid: null, status: "QUEUED" },
      data: { sendAttemptedAt: null },
    })
    expect(failedWith("UNKNOWN_DELIVERY")).toBeUndefined()
  })

  it("treats a 5xx that carries a Meta error code as a definite rejection and retries", async () => {
    m.sendText.mockRejectedValue(new CloudApiError("Something went wrong", 500, "131000", true))

    await expect(sendOutboundMessage({ messageId: "m1" }, RETRYING)).rejects.toThrow("Something went wrong")
  })

  it("marks FAILED when a retryable error exhausts its attempts", async () => {
    m.sendText.mockRejectedValue(new CloudApiError("busy", 429, null, true))

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
    m.msgUpdateMany.mockResolvedValueOnce({ count: 1 }).mockRejectedValue(new Error("db down"))

    await expect(sendOutboundMessage({ messageId: "m1" }, RETRYING)).resolves.toBeUndefined()

    expect(m.sendText).toHaveBeenCalledTimes(1)
    // marker + 3 wamid writes + the best-effort UNKNOWN_DELIVERY mark
    expect(m.msgUpdateMany).toHaveBeenCalledTimes(5)
    expect(m.applyStoredStatuses).not.toHaveBeenCalled()
  })

  it("does not call Meta when the attempt marker cannot be committed, and lets pg-boss retry", async () => {
    m.msgUpdateMany.mockRejectedValue(new Error("db down"))

    await expect(sendOutboundMessage({ messageId: "m1" }, RETRYING)).rejects.toThrow("db down")

    expect(m.sendText).not.toHaveBeenCalled()
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

describe("at-most-once delivery (no duplicate sends)", () => {
  /** A one-row in-memory table behind the prisma mocks, so retries observe what earlier runs wrote. */
  function bindStore(store: Record<string, any>) {
    m.msgFindUnique.mockImplementation(async ({ select }) =>
      "conversationId" in select ? { conversationId: "conv-1" } : { ...store }
    )
    m.msgUpdateMany.mockImplementation(async ({ where, data }) => {
      const matches = Object.entries(where).every(([key, value]) => store[key] === value)
      if (matches) Object.assign(store, data)
      return { count: matches ? 1 : 0 }
    })
  }

  function useRowStore(initial: Record<string, unknown> = {}) {
    const store = { ...row(), ...initial } as Record<string, any>
    bindStore(store)
    return store
  }

  it("commits the attempt marker before Meta is called", async () => {
    const store = useRowStore()
    m.sendText.mockImplementation(async () => {
      expect(store.sendAttemptedAt).toEqual(NOW)
      return { wamid: "wamid.OUT1" }
    })

    await sendOutboundMessage({ messageId: "m1" }, RETRYING)

    expect(m.sendText).toHaveBeenCalledTimes(1)
    expect(store).toMatchObject({ wamid: "wamid.OUT1", status: "SENT" })
  })

  it("stores the wamid before the transaction commits, so a commit failure cannot lose it", async () => {
    const store = useRowStore()
    m.runTx.mockImplementation(async (fn: (client: typeof tx) => unknown) => {
      await fn(tx)
      throw new Error("commit failed")
    })

    await expect(sendOutboundMessage({ messageId: "m1" }, RETRYING)).rejects.toThrow("commit failed")
    expect(store.wamid).toBe("wamid.OUT1")

    // pg-boss retries the job: the message is recognized as already sent and not sent again.
    m.runTx.mockImplementation(async (fn: (client: typeof tx) => unknown) => fn(tx))
    await sendOutboundMessage({ messageId: "m1" }, RETRYING)

    expect(m.sendText).toHaveBeenCalledTimes(1)
    expect(m.applyStoredStatuses).toHaveBeenCalledWith("wamid.OUT1")
  })

  it("crash after Meta accepted and before the wamid was stored: the retry does NOT resend", async () => {
    const store = useRowStore()
    // The process dies right after Meta answers: the wamid write and the commit never happen.
    m.sendText.mockImplementation(async () => {
      m.msgUpdateMany.mockRejectedValue(new Error("process died"))
      m.runTx.mockRejectedValue(new Error("connection lost"))
      return { wamid: "wamid.LOST" }
    })
    m.runTx.mockImplementation(async (fn: (client: typeof tx) => unknown) => {
      await fn(tx)
      throw new Error("connection lost")
    })

    await expect(sendOutboundMessage({ messageId: "m1" }, RETRYING)).rejects.toThrow("connection lost")
    expect(m.sendText).toHaveBeenCalledTimes(1)
    expect(store.sendAttemptedAt).toEqual(NOW)
    expect(store.wamid).toBeNull()

    // Retry on a healthy process: the attempted-but-no-wamid row is an unknown delivery.
    bindStore(store)
    m.runTx.mockImplementation(async (fn: (client: typeof tx) => unknown) => fn(tx))
    await sendOutboundMessage({ messageId: "m1" }, RETRYING)

    expect(m.sendText).toHaveBeenCalledTimes(1) // still one: never resent
    expect(store).toMatchObject({ status: "FAILED", errorCode: "UNKNOWN_DELIVERY" })
  })

  it.each([
    ["a network failure", new CloudApiError("network", null, null, true)],
    ["a timeout", new CloudApiError("timeout", 408, null, true)],
    ["a bare 5xx", new CloudApiError("bad gateway", 502, null, true)],
  ])("%s is ambiguous: no retry, no resend, flagged UNKNOWN_DELIVERY", async (_label, error) => {
    const store = useRowStore()
    m.sendText.mockRejectedValue(error)

    await expect(sendOutboundMessage({ messageId: "m1" }, RETRYING)).resolves.toBeUndefined()
    await sendOutboundMessage({ messageId: "m1" }, RETRYING) // a redelivered job

    expect(m.sendText).toHaveBeenCalledTimes(1)
    expect(store).toMatchObject({ status: "FAILED", errorCode: "UNKNOWN_DELIVERY" })
  })

  it.each([
    ["a gateway 401", new CloudApiError("unauthorized", 401, null, false), "401"],
    ["a gateway 403", new CloudApiError("forbidden", 403, null, false), "403"],
    ["a 400 with an unparseable body", new CloudApiError("bad request", 400, null, false), "400"],
  ])("%s is a definite rejection: FAILED with the status, no retry, not UNKNOWN_DELIVERY", async (_label, error, code) => {
    const store = useRowStore()
    m.sendText.mockRejectedValue(error)

    await expect(sendOutboundMessage({ messageId: "m1" }, RETRYING)).resolves.toBeUndefined()

    expect(m.sendText).toHaveBeenCalledTimes(1)
    expect(store).toMatchObject({ status: "FAILED", errorCode: code })
  })

  it("a message whose attempt marker is set and has no wamid is never sent", async () => {
    m.msgFindUnique.mockImplementation(async ({ select }) =>
      "conversationId" in select ? { conversationId: "conv-1" } : row({ sendAttemptedAt: NOW })
    )

    await sendOutboundMessage({ messageId: "m1" }, RETRYING)

    expect(m.sendText).not.toHaveBeenCalled()
    expect(m.sendTemplate).not.toHaveBeenCalled()
    expect(failedWith("UNKNOWN_DELIVERY")).toBeDefined()
  })

  it("after a definite 429 the cleared marker lets the retry send exactly once", async () => {
    const store = useRowStore()
    m.sendText.mockRejectedValueOnce(new CloudApiError("busy", 429, null, true))

    await expect(sendOutboundMessage({ messageId: "m1" }, RETRYING)).rejects.toThrow("busy")
    expect(store.sendAttemptedAt).toBeNull()

    await sendOutboundMessage({ messageId: "m1" }, RETRYING)

    expect(m.sendText).toHaveBeenCalledTimes(2) // the first one was rejected by Meta
    expect(store).toMatchObject({ wamid: "wamid.OUT1", status: "SENT" })
  })

  it("re-runs the onSent hook when a retry finds the message already sent after a failed commit", async () => {
    const hook = vi.fn().mockResolvedValue(undefined)
    setOnSentHook(hook)
    useRowStore({ wamid: "wamid.OLD", status: "SENT" })

    await sendOutboundMessage({ messageId: "m1" }, RETRYING)

    expect(m.sendText).not.toHaveBeenCalled()
    expect(hook).toHaveBeenCalledWith("m1")
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
    m.sendText.mockRejectedValue(new CloudApiError("busy", 429, null, true))

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

describe("sendOutboundMessage: attachments (WC-10)", () => {
  const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])

  function mediaRow(overrides: Record<string, unknown> = {}) {
    return row({
      type: "IMAGE",
      text: "Mire esto",
      media: { status: "STORED", s3Key: "whatsapp/conv-1/out/a.png", mimeType: "image/png", fileName: "a.png" },
      ...overrides,
    })
  }
  function useRow(value: unknown) {
    m.msgFindUnique.mockImplementation(async ({ select }) => ("conversationId" in select ? { conversationId: "conv-1" } : value))
  }

  beforeEach(() => {
    m.getObjectBytes.mockResolvedValue(PNG)
    useRow(mediaRow())
  })

  it("reads the file from R2 and sends it with its caption, then stores the wamid", async () => {
    await sendOutboundMessage({ messageId: "m1" }, RETRYING)

    expect(m.getObjectBytes).toHaveBeenCalledWith("whatsapp/conv-1/out/a.png", 10 * 1024 * 1024)
    expect(m.sendMedia).toHaveBeenCalledWith(
      "573001234567",
      { kind: "image", bytes: PNG, mimeType: "image/png", fileName: "a.png", caption: "Mire esto" },
      { contextWamid: null }
    )
    expect(m.sendText).not.toHaveBeenCalled()
    expect(m.msgUpdateMany).toHaveBeenCalledWith({
      where: { id: "m1", wamid: null, status: "QUEUED" },
      data: expect.objectContaining({ wamid: "wamid.MEDIA1", status: "SENT" }),
    })
  })

  it("sends a PDF as a document", async () => {
    m.getObjectBytes.mockResolvedValue(new TextEncoder().encode("%PDF-1.4"))
    useRow(mediaRow({ type: "DOCUMENT", media: { status: "STORED", s3Key: "k.pdf", mimeType: "application/pdf", fileName: "c.pdf" } }))

    await sendOutboundMessage({ messageId: "m1" }, RETRYING)

    expect(m.sendMedia.mock.calls[0][1]).toMatchObject({ kind: "document", mimeType: "application/pdf" })
  })

  it("enforces the 24h window for attachments without calling R2 or Meta", async () => {
    useRow(
      mediaRow({
        conversation: { stateVersion: 3, lastInboundAt: new Date(NOW.getTime() - 25 * 3_600_000), contact: { waId: "573001234567" } },
      })
    )

    await sendOutboundMessage({ messageId: "m1" }, RETRYING)

    expect(failedWith("WINDOW_CLOSED")).toBeDefined()
    expect(m.getObjectBytes).not.toHaveBeenCalled()
    expect(m.sendMedia).not.toHaveBeenCalled()
  })

  it("reads the file BEFORE committing the attempt marker, so a storage failure is safe to retry", async () => {
    m.getObjectBytes.mockRejectedValue(new Error("r2 down"))

    await expect(sendOutboundMessage({ messageId: "m1" }, RETRYING)).rejects.toThrow("Could not read the attachment")

    expect(m.msgUpdateMany).not.toHaveBeenCalled()
    expect(m.sendMedia).not.toHaveBeenCalled()
  })

  it("fails visibly with MEDIA_UNAVAILABLE on the last attempt", async () => {
    m.getObjectBytes.mockRejectedValue(new Error("r2 down"))

    await sendOutboundMessage({ messageId: "m1" }, LAST_ATTEMPT)

    expect(failedWith("MEDIA_UNAVAILABLE")).toBeDefined()
    expect(m.sendMedia).not.toHaveBeenCalled()
  })

  it("refuses bytes that do not match the stored type", async () => {
    m.getObjectBytes.mockResolvedValue(new TextEncoder().encode("<html></html>"))

    await sendOutboundMessage({ messageId: "m1" }, RETRYING)

    expect(failedWith("INVALID_MESSAGE")).toBeDefined()
    expect(m.sendMedia).not.toHaveBeenCalled()
  })

  it("fails INVALID_MESSAGE when the media row is not STORED", async () => {
    useRow(mediaRow({ media: { status: "PENDING", s3Key: null, mimeType: "image/png", fileName: null } }))

    await sendOutboundMessage({ messageId: "m1" }, RETRYING)

    expect(failedWith("INVALID_MESSAGE")).toBeDefined()
    expect(m.getObjectBytes).not.toHaveBeenCalled()
  })

  it("treats an ambiguous Meta error as an unknown delivery and never resends", async () => {
    m.sendMedia.mockRejectedValue(new CloudApiError("timeout", 408, null, true))

    await sendOutboundMessage({ messageId: "m1" }, RETRYING)

    expect(failedWith("UNKNOWN_DELIVERY")).toBeDefined()
  })
})
