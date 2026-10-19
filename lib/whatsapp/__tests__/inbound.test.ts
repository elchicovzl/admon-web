import { Prisma } from "@prisma/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fixtures } from "./fixtures"
import { splitWebhookPayload } from "../split-payload"

const m = vi.hoisted(() => {
  const tx = {
    conversation: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    conversationEvent: { create: vi.fn() },
    whatsAppMessage: { create: vi.fn() },
  }
  return {
    tx,
    convFindUnique: vi.fn(),
    convCreate: vi.fn(),
    msgFindUnique: vi.fn(),
    settingsFindUnique: vi.fn(),
    upsertAndMatchContact: vi.fn(),
    ensureLead: vi.fn(),
    send: vi.fn(),
    getBoss: vi.fn(),
    order: [] as string[],
  }
})
vi.mock("@/lib/db/prisma", () => ({
  default: {
    conversation: { findUnique: m.convFindUnique, create: m.convCreate },
    whatsAppMessage: { findUnique: m.msgFindUnique },
    whatsAppSettings: { findUnique: m.settingsFindUnique },
    $transaction: (fn: (tx: typeof m.tx) => unknown) => {
      m.order.push("transaction")
      return fn(m.tx)
    },
  },
}))
vi.mock("@/lib/queue/boss", () => ({ getBoss: m.getBoss }))
vi.mock("../contacts", () => ({
  upsertAndMatchContact: m.upsertAndMatchContact,
  ensureLead: m.ensureLead,
}))

import { setNotifyPort } from "@/lib/notifications/port"
import { messagePreview, parseInboundMessage, processInboundMessage } from "../inbound"

const RECEIVED = new Date("2026-10-19T12:00:00Z")
const contact = { id: "c1", waId: "573001234567", profileName: "Test User", matchStatus: "UNMATCHED" }
const conversation = { id: "conv1", contactId: "c1", status: "HUMAN" }

function payloadOf(fixture: unknown) {
  return splitWebhookPayload(fixture)[0].payload
}

function p2002() {
  return new Prisma.PrismaClientKnownRequestError("unique", { code: "P2002", clientVersion: "test" })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, "warn").mockImplementation(() => {})
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.stubEnv("WHATSAPP_AI_ENABLED", "false")
  m.upsertAndMatchContact.mockResolvedValue(contact)
  m.ensureLead.mockResolvedValue({ lead: { id: "l1" }, created: true })
  m.convFindUnique.mockResolvedValue(conversation)
  m.convCreate.mockImplementation(async ({ data }) => ({ id: "conv-new", ...data }))
  m.msgFindUnique.mockResolvedValue(null)
  m.order.length = 0
  m.settingsFindUnique.mockImplementation(async () => {
    m.order.push("settings")
    return { aiEnabled: true }
  })
  m.tx.whatsAppMessage.create.mockImplementation(async ({ data }) => ({
    id: "msg1",
    media: data.media ? { status: "PENDING" } : null,
  }))
  // The state machine re-reads the conversation inside the transaction (version 5).
  m.tx.conversation.findUnique.mockResolvedValue({ status: "HUMAN", stateVersion: 5, aiPaused: false })
  m.tx.conversation.updateMany.mockResolvedValue({ count: 1 })
  m.tx.conversation.update.mockResolvedValue({})
  m.tx.conversationEvent.create.mockResolvedValue({})
  m.send.mockResolvedValue("job")
  m.getBoss.mockResolvedValue({ send: m.send })
})
afterEach(() => {
  vi.unstubAllEnvs()
  setNotifyPort()
})

describe("parseInboundMessage", () => {
  it("parses a text message", () => {
    const parsed = parseInboundMessage((payloadOf(fixtures.text) as { item: unknown }).item, RECEIVED)

    expect(parsed).toMatchObject({
      wamid: "wamid.TEXT1",
      from: "573001234567",
      type: "TEXT",
      text: "Hola",
      media: null,
      timestamp: new Date(1760000000 * 1000),
    })
  })

  it("parses media with its metadata", () => {
    const parsed = parseInboundMessage((payloadOf(fixtures.image) as { item: unknown }).item)

    expect(parsed).toMatchObject({
      type: "IMAGE",
      media: { metaMediaId: "MEDIA2", mimeType: "image/jpeg", sha256: "abc" },
    })
  })

  it("keeps a sticker as its own type with a media row and no crash (S-WC-13)", () => {
    const parsed = parseInboundMessage((payloadOf(fixtures.unsupported) as { item: unknown }).item)

    expect(parsed?.type).toBe("STICKER")
    expect(parsed?.media?.metaMediaId).toBe("MEDIA3")
  })

  it("stores truly unknown types as UNSUPPORTED", () => {
    const parsed = parseInboundMessage({ id: "w", from: "573001234567", timestamp: "1", type: "order" })

    expect(parsed?.type).toBe("UNSUPPORTED")
  })

  it("returns null when the item has no id or sender", () => {
    expect(parseInboundMessage({ from: "573001234567" })).toBeNull()
    expect(parseInboundMessage({ id: "w" })).toBeNull()
    expect(parseInboundMessage(null)).toBeNull()
  })

  it("falls back to the receive time for a bad timestamp", () => {
    expect(parseInboundMessage({ id: "w", from: "573001234567", type: "text", text: { body: "x" } }, RECEIVED)?.timestamp).toEqual(RECEIVED)
  })
})

describe("messagePreview", () => {
  it("truncates long text and uses placeholders for media", () => {
    expect(messagePreview({ type: "TEXT", text: "a".repeat(200) })).toHaveLength(80)
    expect(messagePreview({ type: "AUDIO", text: null })).toBe("[Audio]")
    expect(messagePreview({ type: "IMAGE", text: "foto" })).toBe("foto")
  })
})

describe("processInboundMessage", () => {
  it("first contact creates contact + conversation (HUMAN while AI is off) and stores the message (CH-1)", async () => {
    m.convFindUnique.mockResolvedValue(null)

    await processInboundMessage(payloadOf(fixtures.text), RECEIVED)

    expect(m.upsertAndMatchContact).toHaveBeenCalledWith({
      waId: "573001234567",
      profileName: "Test User",
      seenAt: new Date(1760000000 * 1000),
    })
    const created = m.convCreate.mock.calls[0][0].data
    expect(created).toMatchObject({ contactId: "c1", status: "HUMAN" })
    expect(created.events.create).toMatchObject({ toStatus: "HUMAN", event: "INBOUND_FIRST_CONTACT", actor: "CLIENT" })
    expect(m.tx.whatsAppMessage.create.mock.calls[0][0].data).toMatchObject({
      conversationId: "conv-new",
      wamid: "wamid.TEXT1",
      direction: "IN",
      source: "CLIENT",
      type: "TEXT",
      text: "Hola",
      status: "RECEIVED",
    })
  })

  it("reads the AI settings before opening the transaction, never inside it (pool safety)", async () => {
    vi.stubEnv("WHATSAPP_AI_ENABLED", "true")

    await processInboundMessage(payloadOf(fixtures.text), RECEIVED)

    // One settings read, strictly before the transaction starts; the transaction client has no
    // settings access in this mock, so a read through it would have failed the message.
    expect(m.order).toEqual(["settings", "transaction"])
    expect(m.tx.whatsAppMessage.create).toHaveBeenCalledTimes(1)
  })

  it("starts in AI when both the env flag and the DB switch are on (CH-1)", async () => {
    vi.stubEnv("WHATSAPP_AI_ENABLED", "true")
    m.convFindUnique.mockResolvedValue(null)

    await processInboundMessage(payloadOf(fixtures.text), RECEIVED)

    expect(m.convCreate.mock.calls[0][0].data.status).toBe("AI")
  })

  it("starts in HUMAN when the DB switch is off even if the env flag is on", async () => {
    vi.stubEnv("WHATSAPP_AI_ENABLED", "true")
    m.settingsFindUnique.mockResolvedValue({ aiEnabled: false })
    m.convFindUnique.mockResolvedValue(null)

    await processInboundMessage(payloadOf(fixtures.text), RECEIVED)

    expect(m.convCreate.mock.calls[0][0].data.status).toBe("HUMAN")
  })

  it("a concurrent first contact that loses the unique race re-reads the winner", async () => {
    m.convFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "winner", status: "HUMAN" })
    m.convCreate.mockRejectedValue(p2002())

    await processInboundMessage(payloadOf(fixtures.text), RECEIVED)

    expect(m.tx.whatsAppMessage.create.mock.calls[0][0].data.conversationId).toBe("winner")
  })

  function givenConversationStatus(status: "AI" | "HUMAN" | "ESCALATED" | "CLOSED") {
    m.convFindUnique.mockResolvedValue({ ...conversation, status })
    m.tx.conversation.findUnique.mockResolvedValue({ status, stateVersion: 5, aiPaused: false })
  }

  it("auto-reopens a CLOSED conversation to HUMAN and stores the message (CH-11, S-CH-7)", async () => {
    givenConversationStatus("CLOSED")

    await processInboundMessage(payloadOf(fixtures.text), RECEIVED)

    expect(m.tx.conversation.updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: "conv1", stateVersion: 5 },
      data: { status: "HUMAN", stateVersion: { increment: 1 }, closedAt: null, closedById: null },
    })
    expect(m.tx.conversationEvent.create.mock.calls[0][0].data).toMatchObject({
      fromStatus: "CLOSED",
      toStatus: "HUMAN",
      event: "INBOUND_REOPEN",
      actor: "CLIENT",
    })
    expect(m.tx.whatsAppMessage.create).toHaveBeenCalledTimes(1)
  })

  it("reopens to AI when AI is effective", async () => {
    vi.stubEnv("WHATSAPP_AI_ENABLED", "true")
    givenConversationStatus("CLOSED")

    await processInboundMessage(payloadOf(fixtures.text), RECEIVED)

    expect(m.tx.conversation.updateMany.mock.calls[0][0].data.status).toBe("AI")
  })

  it("does not write a reopen audit event when another worker already reopened it", async () => {
    givenConversationStatus("CLOSED")
    // The first read sees CLOSED; the version guard loses; the retry sees the winner's HUMAN.
    m.tx.conversation.findUnique
      .mockResolvedValueOnce({ status: "CLOSED", stateVersion: 5, aiPaused: false })
      .mockResolvedValue({ status: "HUMAN", stateVersion: 6, aiPaused: false })
    m.tx.conversation.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValue({ count: 1 })

    await processInboundMessage(payloadOf(fixtures.text), RECEIVED)

    expect(m.tx.conversationEvent.create).not.toHaveBeenCalled()
    expect(m.tx.whatsAppMessage.create).toHaveBeenCalledTimes(1)
  })

  it("does not move or audit an existing conversation on inbound", async () => {
    givenConversationStatus("HUMAN")

    await processInboundMessage(payloadOf(fixtures.text), RECEIVED)

    expect(m.tx.conversationEvent.create).not.toHaveBeenCalled()
  })

  it("fails the event, leaving it retryable, when the transition cannot be applied", async () => {
    m.tx.conversation.findUnique.mockResolvedValue(null)

    await expect(processInboundMessage(payloadOf(fixtures.text), RECEIVED)).rejects.toThrow("inbound transition failed")
    expect(m.tx.whatsAppMessage.create).not.toHaveBeenCalled()
  })

  describe("ESCALATED conversation (CH-7, S-CH-6)", () => {
    it("stores the message, keeps the state and sends one activity notice after the commit", async () => {
      const notify = vi.fn().mockResolvedValue(undefined)
      setNotifyPort({ notify })
      givenConversationStatus("ESCALATED")

      await processInboundMessage(payloadOf(fixtures.text), RECEIVED)

      expect(m.tx.whatsAppMessage.create).toHaveBeenCalledTimes(1)
      expect(m.tx.conversationEvent.create).not.toHaveBeenCalled()
      expect(notify).toHaveBeenCalledTimes(1)
      expect(notify).toHaveBeenCalledWith({ type: "NEW_ACTIVITY_ON_ESCALATED", conversationId: "conv1" })
    })

    it("does not notify for a redelivered message", async () => {
      const notify = vi.fn().mockResolvedValue(undefined)
      setNotifyPort({ notify })
      givenConversationStatus("ESCALATED")
      m.msgFindUnique.mockResolvedValue({ id: "msg1", media: null })

      await processInboundMessage(payloadOf(fixtures.text), RECEIVED)

      expect(notify).not.toHaveBeenCalled()
    })

    it("does not notify for AI or HUMAN conversations", async () => {
      const notify = vi.fn().mockResolvedValue(undefined)
      setNotifyPort({ notify })

      for (const status of ["AI", "HUMAN"] as const) {
        givenConversationStatus(status)
        await processInboundMessage(payloadOf(fixtures.text), RECEIVED)
      }

      expect(notify).not.toHaveBeenCalled()
    })

    it("a failing notifier never loses the stored message", async () => {
      setNotifyPort({ notify: vi.fn().mockRejectedValue(new Error("down")) })
      givenConversationStatus("ESCALATED")

      await expect(processInboundMessage(payloadOf(fixtures.text), RECEIVED)).resolves.toBeUndefined()
      expect(m.tx.whatsAppMessage.create).toHaveBeenCalledTimes(1)
    })
  })

  it("updates unread, lastInboundAt, lastMessageAt and preview (forward-only)", async () => {
    await processInboundMessage(payloadOf(fixtures.text), RECEIVED)

    const ts = new Date(1760000000 * 1000)
    expect(m.tx.conversation.update).toHaveBeenCalledWith({
      where: { id: "conv1" },
      data: { unreadCount: { increment: 1 } },
    })
    const calls = m.tx.conversation.updateMany.mock.calls.map((call) => call[0])
    expect(calls).toContainEqual({
      where: { id: "conv1", OR: [{ lastInboundAt: null }, { lastInboundAt: { lt: ts } }] },
      data: { lastInboundAt: ts },
    })
    expect(calls).toContainEqual({
      where: { id: "conv1", lastMessageAt: { lte: ts } },
      data: { lastMessageAt: ts, lastMessagePreview: "Hola" },
    })
  })

  it("skips a message whose wamid is already stored without touching counters (WC-4)", async () => {
    m.msgFindUnique.mockResolvedValue({ id: "msg1", media: null })

    await processInboundMessage(payloadOf(fixtures.text), RECEIVED)

    expect(m.tx.whatsAppMessage.create).not.toHaveBeenCalled()
    expect(m.tx.conversation.update).not.toHaveBeenCalled()
  })

  it("treats a wamid unique violation on create as a duplicate, not a failure (WC-4)", async () => {
    m.msgFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "msg1", media: null })
    m.tx.whatsAppMessage.create.mockRejectedValue(p2002())

    await expect(processInboundMessage(payloadOf(fixtures.text), RECEIVED)).resolves.toBeUndefined()
  })

  it("rethrows unexpected persistence errors so the event stays unprocessed (S-WC-9)", async () => {
    m.tx.whatsAppMessage.create.mockRejectedValue(new Error("db down"))

    await expect(processInboundMessage(payloadOf(fixtures.text), RECEIVED)).rejects.toThrow("db down")
  })

  it("creates a PENDING media row and enqueues the download for an image", async () => {
    await processInboundMessage(payloadOf(fixtures.image), RECEIVED)

    expect(m.tx.whatsAppMessage.create.mock.calls[0][0].data.media.create).toEqual({
      metaMediaId: "MEDIA2",
      mimeType: "image/jpeg",
      sha256: "abc",
      fileName: null,
      status: "PENDING",
    })
    expect(m.send).toHaveBeenCalledWith("wa.media.download", { messageId: "msg1" }, { singletonKey: "msg1" })
  })

  it("stores audio and sticker types too; a sticker keeps a placeholder preview", async () => {
    await processInboundMessage(payloadOf(fixtures.audio), RECEIVED)
    await processInboundMessage(payloadOf(fixtures.unsupported), RECEIVED)

    const types = m.tx.whatsAppMessage.create.mock.calls.map((call) => call[0].data.type)
    expect(types).toEqual(["AUDIO", "STICKER"])
    expect(m.send).toHaveBeenCalledTimes(2)
  })

  it("re-enqueues a still-PENDING media download when the message was already stored", async () => {
    m.msgFindUnique.mockResolvedValue({ id: "msg1", media: { status: "PENDING" } })

    await processInboundMessage(payloadOf(fixtures.image), RECEIVED)

    expect(m.tx.whatsAppMessage.create).not.toHaveBeenCalled()
    expect(m.send).toHaveBeenCalledTimes(1)
  })

  it("does not enqueue media for text messages or for media already stored", async () => {
    await processInboundMessage(payloadOf(fixtures.text), RECEIVED)
    m.msgFindUnique.mockResolvedValue({ id: "msg1", media: { status: "STORED" } })
    await processInboundMessage(payloadOf(fixtures.image), RECEIVED)

    expect(m.send).not.toHaveBeenCalled()
  })

  it("creates a lead for an unmatched contact after the message is persisted (LD-1)", async () => {
    await processInboundMessage(payloadOf(fixtures.text), RECEIVED)

    expect(m.ensureLead).toHaveBeenCalledWith(contact, "conv1")
    expect(m.tx.whatsAppMessage.create.mock.invocationCallOrder[0]).toBeLessThan(m.ensureLead.mock.invocationCallOrder[0])
  })

  it.each(["MATCHED", "AMBIGUOUS", "MANUAL"])("creates no lead for a %s contact (S-LD-5, LD-8)", async (matchStatus) => {
    m.upsertAndMatchContact.mockResolvedValue({ ...contact, matchStatus })

    await processInboundMessage(payloadOf(fixtures.text), RECEIVED)

    expect(m.ensureLead).not.toHaveBeenCalled()
  })

  it("a lead failure does not block message persistence (LD-2)", async () => {
    m.ensureLead.mockRejectedValue(new Error("lead down"))

    await expect(processInboundMessage(payloadOf(fixtures.text), RECEIVED)).resolves.toBeUndefined()
    expect(m.tx.whatsAppMessage.create).toHaveBeenCalledTimes(1)
  })

  it("skips items without id or sender instead of throwing", async () => {
    await processInboundMessage({ item: { type: "text" } }, RECEIVED)

    expect(m.upsertAndMatchContact).not.toHaveBeenCalled()
  })
})
