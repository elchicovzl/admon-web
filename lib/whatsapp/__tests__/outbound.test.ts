import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  convFindUnique: vi.fn(),
  convUpdateMany: vi.fn(),
  msgFindUnique: vi.fn(),
  msgUpdateMany: vi.fn(),
  mediaCount: vi.fn(),
  applyTransition: vi.fn(),
  createOutboundMessage: vi.fn(),
  enqueueOutboundSend: vi.fn(),
  putObject: vi.fn(),
  deleteObjects: vi.fn(),
  order: [] as string[],
}))

const tx = {
  conversation: { findUnique: m.convFindUnique, updateMany: m.convUpdateMany },
  whatsAppMessage: { findUnique: m.msgFindUnique, updateMany: m.msgUpdateMany },
  __tx: true,
}
vi.mock("@/lib/db/prisma", () => ({
  default: {
    conversation: { findUnique: m.convFindUnique },
    whatsAppMedia: { count: m.mediaCount },
    $transaction: async (fn: (client: typeof tx) => unknown) => {
      m.order.push("tx:start")
      const value = await fn(tx)
      m.order.push("tx:commit")
      return value
    },
  },
}))
vi.mock("@/lib/config/runtime-config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/config/runtime-config")>()),
  getWhatsAppConfig: () => ({
    templates: { resume: "resume_conversation", processUpdate: "process_update", language: "es", approved: ["RESUME"] },
  }),
}))
vi.mock("@/lib/storage/r2", () => ({ putObject: m.putObject, deleteObjects: m.deleteObjects }))
vi.mock("../transitions", () => ({ applyTransition: m.applyTransition }))
vi.mock("../inbound", () => ({
  messagePreview: (message: { type: string; text: string | null }) => message.text ?? `[${message.type}]`,
}))
vi.mock("../send", () => ({
  createOutboundMessage: m.createOutboundMessage,
  enqueueOutboundSend: m.enqueueOutboundSend,
}))

import { getTemplateOptions, resendMessage, sendMediaReply, sendReplyMessage, sendTemplateMessage } from "../outbound"

const NOW = new Date("2026-10-19T12:00:00.000Z")
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000)
const CONV = "conv-1"
const USER = "user-1"

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4])

function conversation(overrides: Record<string, unknown> = {}) {
  return { status: "AI", lastInboundAt: hoursAgo(1), ...overrides }
}

beforeEach(() => {
  vi.clearAllMocks()
  m.order.length = 0
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.stubEnv("WHATSAPP_ENABLED", "true")
  m.convFindUnique.mockResolvedValue(conversation())
  m.convUpdateMany.mockResolvedValue({ count: 1 })
  m.applyTransition.mockResolvedValue({ ok: true, changed: true, stateVersion: 8 })
  m.createOutboundMessage.mockImplementation(async () => {
    m.order.push("outbox:insert")
    return { id: "msg-1" }
  })
  m.enqueueOutboundSend.mockImplementation(async () => {
    m.order.push("enqueue")
  })
  m.putObject.mockResolvedValue(undefined)
  m.deleteObjects.mockResolvedValue({ deleted: [], failed: [] })
  m.mediaCount.mockResolvedValue(0)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe("sendReplyMessage", () => {
  const input = { conversationId: CONV, userId: USER, text: "  Buenas tardes  " }

  it("applies DASHBOARD_REPLY and inserts the outbox row in the SAME transaction, then enqueues (WI-7, CH-4)", async () => {
    const result = await sendReplyMessage(input)

    expect(result).toEqual({ success: true, data: { messageId: "msg-1" } })
    expect(m.applyTransition).toHaveBeenCalledWith(
      { conversationId: CONV, event: "DASHBOARD_REPLY", actor: "USER", actorUserId: USER },
      expect.objectContaining({ db: tx })
    )
    expect(m.createOutboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "text",
        text: "Buenas tardes",
        conversationId: CONV,
        source: "DASHBOARD",
        sentById: USER,
        expectedStateVersion: 8,
      }),
      tx
    )
    // Handoff -> insert -> commit -> only then the job is queued.
    expect(m.order).toEqual(["tx:start", "outbox:insert", "tx:commit", "enqueue"])
    expect(m.enqueueOutboundSend).toHaveBeenCalledWith({ messageId: "msg-1", expectedStateVersion: 8 })
  })

  it("moves the list forward with the new preview in the same transaction", async () => {
    await sendReplyMessage(input)

    expect(m.convUpdateMany).toHaveBeenCalledWith({
      where: { id: CONV, lastMessageAt: { lte: NOW } },
      data: { lastMessageAt: NOW, lastMessagePreview: "Buenas tardes" },
    })
  })

  it("allows free text at 23:59 and rejects it at exactly 24:00 (S-WI-4, S-WI-3)", async () => {
    m.convFindUnique.mockResolvedValue(conversation({ lastInboundAt: new Date(NOW.getTime() - (24 * 60 - 1) * 60_000) }))
    expect((await sendReplyMessage(input)).success).toBe(true)

    vi.clearAllMocks()
    m.convFindUnique.mockResolvedValue(conversation({ lastInboundAt: hoursAgo(24) }))
    const result = await sendReplyMessage(input)

    expect(result).toEqual({
      success: false,
      error: "La ventana de 24 horas está cerrada. Solo puede enviar plantillas aprobadas.",
    })
    expect(m.applyTransition).not.toHaveBeenCalled()
    expect(m.createOutboundMessage).not.toHaveBeenCalled()
    expect(m.enqueueOutboundSend).not.toHaveBeenCalled()
  })

  it("rejects a reply to a CLOSED conversation with a clear message and writes nothing", async () => {
    m.convFindUnique.mockResolvedValue(conversation({ status: "CLOSED" }))

    const result = await sendReplyMessage(input)

    expect(result).toEqual({ success: false, error: "La conversación está cerrada. Reábrala antes de responder." })
    expect(m.applyTransition).not.toHaveBeenCalled()
    expect(m.createOutboundMessage).not.toHaveBeenCalled()
  })

  it("replies from AI and ESCALATED conversations (the transition hands them to HUMAN)", async () => {
    for (const status of ["AI", "ESCALATED", "HUMAN"]) {
      m.convFindUnique.mockResolvedValue(conversation({ status }))
      expect((await sendReplyMessage(input)).success).toBe(true)
    }
  })

  it("reports a missing conversation", async () => {
    m.convFindUnique.mockResolvedValue(null)
    expect(await sendReplyMessage(input)).toEqual({ success: false, error: "Conversación no encontrada" })
  })

  it("writes no outbox row and queues nothing when the transition is rejected", async () => {
    m.applyTransition.mockResolvedValue({ ok: false, code: "INVALID_FROM_STATE", message: "nope" })

    const result = await sendReplyMessage(input)

    expect(result.success).toBe(false)
    expect(m.createOutboundMessage).not.toHaveBeenCalled()
    expect(m.enqueueOutboundSend).not.toHaveBeenCalled()
  })

  it("explains a lost version race", async () => {
    m.applyTransition.mockResolvedValue({ ok: false, code: "CONFLICT", message: "x" })
    expect(await sendReplyMessage(input)).toEqual({
      success: false,
      error: "La conversación cambió mientras respondía. Intente de nuevo.",
    })
  })

  it("never enqueues when the outbox insert fails (the transaction rolls the handoff back)", async () => {
    m.createOutboundMessage.mockRejectedValue(new Error("db down"))

    const result = await sendReplyMessage(input)

    expect(result).toEqual({ success: false, error: "No se pudo enviar el mensaje" })
    expect(m.order).not.toContain("tx:commit")
    expect(m.enqueueOutboundSend).not.toHaveBeenCalled()
  })

  it("fails gracefully when the queue is unavailable: the row is FAILED and resendable", async () => {
    m.enqueueOutboundSend.mockRejectedValue(new Error("Queue is unavailable"))

    const result = await sendReplyMessage(input)

    expect(result).toEqual({
      success: false,
      error: "No se pudo encolar el mensaje. Quedó marcado como fallido y puede reintentarlo.",
    })
  })

  it("fails with a clear message and touches nothing when WHATSAPP_ENABLED is off", async () => {
    vi.stubEnv("WHATSAPP_ENABLED", "false")

    const result = await sendReplyMessage(input)

    expect(result).toEqual({ success: false, error: "El canal de WhatsApp está desactivado. No se pueden enviar mensajes." })
    expect(m.convFindUnique).not.toHaveBeenCalled()
    expect(m.applyTransition).not.toHaveBeenCalled()
    expect(m.enqueueOutboundSend).not.toHaveBeenCalled()
  })
})

describe("sendTemplateMessage (WI-10, S-WI-8)", () => {
  const input = { conversationId: CONV, userId: USER, templateKey: "RESUME", params: [" Ana "] }

  it("sends an approved template even when the window is closed", async () => {
    m.convFindUnique.mockResolvedValue(conversation({ lastInboundAt: hoursAgo(48) }))

    const result = await sendTemplateMessage(input)

    expect(result.success).toBe(true)
    expect(m.createOutboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "template", templateKey: "RESUME", params: ["Ana"], source: "DASHBOARD" }),
      tx
    )
    expect(m.applyTransition).toHaveBeenCalled()
    expect(m.convUpdateMany.mock.calls[0][0].data.lastMessagePreview).toContain("Hola Ana, le escribimos")
  })

  it("rejects unapproved, unknown and client-supplied template names before touching the DB", async () => {
    for (const templateKey of ["PROCESS_UPDATE", "resume_conversation", "NOPE", ""]) {
      const result = await sendTemplateMessage({ ...input, templateKey, params: ["Ana", "1"] })
      expect(result).toEqual({ success: false, error: "Plantilla no disponible" })
    }
    expect(m.convFindUnique).not.toHaveBeenCalled()
    expect(m.createOutboundMessage).not.toHaveBeenCalled()
  })

  it("validates the variables", async () => {
    expect(await sendTemplateMessage({ ...input, params: [] })).toEqual({
      success: false,
      error: "La plantilla requiere 1 dato(s)",
    })
    expect(await sendTemplateMessage({ ...input, params: ["  "] })).toEqual({ success: false, error: "Nombre es requerido" })
    expect(m.createOutboundMessage).not.toHaveBeenCalled()
  })

  it("still refuses a CLOSED conversation", async () => {
    m.convFindUnique.mockResolvedValue(conversation({ status: "CLOSED" }))
    expect((await sendTemplateMessage(input)).success).toBe(false)
    expect(m.createOutboundMessage).not.toHaveBeenCalled()
  })

  it("fails gracefully when the flag is off", async () => {
    vi.stubEnv("WHATSAPP_ENABLED", "")
    expect(await sendTemplateMessage(input)).toEqual({
      success: false,
      error: "El canal de WhatsApp está desactivado. No se pueden enviar mensajes.",
    })
  })
})

describe("sendMediaReply (WC-10)", () => {
  function file(overrides: Partial<{ name: string; type: string; size: number; bytes: Uint8Array }> = {}) {
    const bytes = overrides.bytes ?? PNG
    return {
      name: overrides.name ?? "foto.png",
      type: overrides.type ?? "image/png",
      size: overrides.size ?? bytes.byteLength,
      bytes: async () => bytes,
    }
  }
  const base = { conversationId: CONV, userId: USER, caption: " Su comprobante " }

  it("stores the file in R2 first, then queues an IMAGE message atomically with the handoff", async () => {
    const result = await sendMediaReply({ ...base, file: file() })

    expect(result.success).toBe(true)
    const [key, bytes, type] = m.putObject.mock.calls[0]
    expect(key).toMatch(/^whatsapp\/conv-1\/out\/[0-9a-f-]{36}\.png$/)
    expect(bytes).toEqual(PNG)
    expect(type).toBe("image/png")
    expect(m.createOutboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "media",
        mediaType: "IMAGE",
        caption: "Su comprobante",
        file: { s3Key: key, mimeType: "image/png", fileName: "foto.png", sizeBytes: PNG.byteLength },
        expectedStateVersion: 8,
      }),
      tx
    )
    expect(m.applyTransition).toHaveBeenCalledWith(expect.objectContaining({ event: "DASHBOARD_REPLY" }), expect.anything())
  })

  it("sends a PDF as a DOCUMENT", async () => {
    const pdf = new TextEncoder().encode("%PDF-1.7 body")
    await sendMediaReply({ ...base, file: file({ name: "carta.pdf", type: "application/pdf", bytes: pdf }) })

    expect(m.createOutboundMessage.mock.calls[0][0]).toMatchObject({ mediaType: "DOCUMENT" })
  })

  it("rejects disallowed types and oversize files before reading or uploading anything", async () => {
    const big = await sendMediaReply({ ...base, file: { ...file(), size: 6 * 1024 * 1024 } })
    expect(big).toEqual({ success: false, error: "La imagen PNG no puede superar 5 MB" })

    const html = await sendMediaReply({ ...base, file: file({ name: "x.html", type: "text/html" }) })
    expect(html).toEqual({ success: false, error: "Este tipo de archivo no está permitido" })

    const zip = await sendMediaReply({ ...base, file: file({ name: "x.zip", type: "application/zip" }) })
    expect(zip.success).toBe(false)

    expect(m.convFindUnique).not.toHaveBeenCalled()
    expect(m.putObject).not.toHaveBeenCalled()
  })

  it("rejects a file whose bytes do not match its declared type", async () => {
    const html = new TextEncoder().encode("<script>alert(1)</script>")

    const result = await sendMediaReply({ ...base, file: file({ type: "image/png", bytes: html }) })

    expect(result).toEqual({ success: false, error: "El contenido del archivo no coincide con su tipo" })
    expect(m.putObject).not.toHaveBeenCalled()
  })

  it("does not upload when the window is closed or the conversation is CLOSED", async () => {
    m.convFindUnique.mockResolvedValue(conversation({ lastInboundAt: hoursAgo(30) }))
    expect((await sendMediaReply({ ...base, file: file() })).success).toBe(false)

    m.convFindUnique.mockResolvedValue(conversation({ status: "CLOSED" }))
    expect((await sendMediaReply({ ...base, file: file() })).success).toBe(false)

    expect(m.putObject).not.toHaveBeenCalled()
  })

  it("removes the uploaded object when the message could not be created", async () => {
    m.createOutboundMessage.mockRejectedValue(new Error("db down"))

    const result = await sendMediaReply({ ...base, file: file() })

    expect(result.success).toBe(false)
    expect(m.deleteObjects).toHaveBeenCalledWith([m.putObject.mock.calls[0][0]])
  })

  it("keeps the object when the message exists but the queue failed (the row points to it)", async () => {
    m.enqueueOutboundSend.mockRejectedValue(new Error("queue down"))
    m.mediaCount.mockResolvedValue(1)

    const result = await sendMediaReply({ ...base, file: file() })

    expect(result.success).toBe(false)
    expect(m.deleteObjects).not.toHaveBeenCalled()
  })

  it("fails gracefully when storage is down", async () => {
    m.putObject.mockRejectedValue(new Error("r2 down"))

    expect(await sendMediaReply({ ...base, file: file() })).toEqual({ success: false, error: "No se pudo guardar el archivo" })
    expect(m.createOutboundMessage).not.toHaveBeenCalled()
  })

  it("fails gracefully when the flag is off, before touching storage", async () => {
    vi.stubEnv("WHATSAPP_ENABLED", "false")

    const result = await sendMediaReply({ ...base, file: file() })

    expect(result.success).toBe(false)
    expect(m.putObject).not.toHaveBeenCalled()
  })
})

describe("resendMessage (S-WI-9, D6)", () => {
  function failed(overrides: Record<string, unknown> = {}) {
    return {
      id: "msg-1",
      conversationId: CONV,
      direction: "OUT",
      source: "DASHBOARD",
      status: "FAILED",
      type: "TEXT",
      text: "Hola",
      errorCode: "131047",
      conversation: { status: "HUMAN", lastInboundAt: hoursAgo(1) },
      ...overrides,
    }
  }
  const input = { messageId: "msg-1", userId: USER, confirmUnknownDelivery: false }

  beforeEach(() => {
    m.msgFindUnique.mockResolvedValue(failed())
    m.msgUpdateMany.mockResolvedValue({ count: 1 })
  })

  it("resets the same row to QUEUED, clears the attempt marker and error, bumps resendCount, then enqueues", async () => {
    const result = await resendMessage(input)

    expect(result).toEqual({ success: true, data: { messageId: "msg-1" } })
    expect(m.msgUpdateMany).toHaveBeenCalledWith({
      where: { id: "msg-1", direction: "OUT", source: "DASHBOARD", status: "FAILED" },
      data: {
        status: "QUEUED",
        statusRank: 0,
        errorCode: null,
        errorMessage: null,
        sendAttemptedAt: null,
        wamid: null,
        sentAt: null,
        timestamp: NOW,
        sentById: USER,
        resendCount: { increment: 1 },
      },
    })
    expect(m.applyTransition).toHaveBeenCalledWith(
      expect.objectContaining({ event: "DASHBOARD_REPLY", actorUserId: USER }),
      expect.objectContaining({ db: tx })
    )
    expect(m.enqueueOutboundSend).toHaveBeenCalledWith({ messageId: "msg-1", expectedStateVersion: 8 })
    expect(m.order).toEqual(["tx:start", "tx:commit", "enqueue"])
  })

  it.each(["QUEUED", "SENT", "DELIVERED", "READ"])("does not resend a %s message", async (status) => {
    m.msgFindUnique.mockResolvedValue(failed({ status }))

    expect((await resendMessage(input)).success).toBe(false)
    expect(m.msgUpdateMany).not.toHaveBeenCalled()
    expect(m.enqueueOutboundSend).not.toHaveBeenCalled()
  })

  it("does not resend AI or system messages", async () => {
    for (const source of ["AI", "SYSTEM"]) {
      m.msgFindUnique.mockResolvedValue(failed({ source }))
      expect(await resendMessage(input)).toEqual({
        success: false,
        error: "Solo se pueden reintentar mensajes enviados desde el panel.",
      })
    }
    expect(m.msgUpdateMany).not.toHaveBeenCalled()
  })

  it("requires explicit confirmation for an unconfirmed delivery, and proceeds with it", async () => {
    m.msgFindUnique.mockResolvedValue(failed({ errorCode: "UNKNOWN_DELIVERY" }))

    const unconfirmed = await resendMessage(input)
    expect(unconfirmed).toEqual({
      success: false,
      error: "Este mensaje pudo haber sido entregado. Confirme que desea enviarlo de nuevo.",
    })
    expect(m.msgUpdateMany).not.toHaveBeenCalled()

    const confirmed = await resendMessage({ ...input, confirmUnknownDelivery: true })
    expect(confirmed.success).toBe(true)
    expect(m.msgUpdateMany).toHaveBeenCalledTimes(1)
  })

  it("re-checks the window for free-form messages and offers a template instead", async () => {
    m.msgFindUnique.mockResolvedValue(failed({ conversation: { status: "HUMAN", lastInboundAt: hoursAgo(30) } }))

    expect(await resendMessage(input)).toEqual({
      success: false,
      error: "La ventana de 24 horas está cerrada. Envíe una plantilla aprobada.",
    })
    expect(m.msgUpdateMany).not.toHaveBeenCalled()
  })

  it("resends a template outside the window", async () => {
    m.msgFindUnique.mockResolvedValue(
      failed({ type: "TEMPLATE", conversation: { status: "HUMAN", lastInboundAt: hoursAgo(30) } })
    )
    expect((await resendMessage(input)).success).toBe(true)
  })

  it("refuses a CLOSED conversation", async () => {
    m.msgFindUnique.mockResolvedValue(failed({ conversation: { status: "CLOSED", lastInboundAt: hoursAgo(1) } }))
    expect(await resendMessage(input)).toEqual({
      success: false,
      error: "La conversación está cerrada. Reábrala antes de responder.",
    })
  })

  it("queues it only once when two people click at the same time (guarded on FAILED)", async () => {
    m.msgUpdateMany.mockResolvedValue({ count: 0 })

    expect(await resendMessage(input)).toEqual({ success: false, error: "El mensaje ya no está fallido" })
    expect(m.applyTransition).not.toHaveBeenCalled()
    expect(m.enqueueOutboundSend).not.toHaveBeenCalled()
  })

  it("does not commit the reset when the handoff is rejected", async () => {
    m.applyTransition.mockResolvedValue({ ok: false, code: "CONFLICT", message: "x" })

    const result = await resendMessage(input)

    expect(result.success).toBe(false)
    expect(m.order).not.toContain("tx:commit")
    expect(m.enqueueOutboundSend).not.toHaveBeenCalled()
  })

  it("reports a missing message and a disabled channel", async () => {
    m.msgFindUnique.mockResolvedValue(null)
    expect(await resendMessage(input)).toEqual({ success: false, error: "Mensaje no encontrado" })

    vi.stubEnv("WHATSAPP_ENABLED", "false")
    expect(await resendMessage(input)).toEqual({
      success: false,
      error: "El canal de WhatsApp está desactivado. No se pueden enviar mensajes.",
    })
  })
})

describe("getTemplateOptions", () => {
  it("offers only approved and configured templates", () => {
    expect(getTemplateOptions().map((option) => option.key)).toEqual(["RESUME"])
  })
})
