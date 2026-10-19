import { beforeEach, describe, expect, it, vi } from "vitest"
import { Prisma } from "@prisma/client"
import { fixtures } from "./fixtures"
import { splitWebhookPayload } from "../split-payload"

const m = vi.hoisted(() => ({
  msgFindUnique: vi.fn(),
  msgFindFirst: vi.fn(),
  msgCreate: vi.fn(),
  contactFindUnique: vi.fn(),
  convUpdateMany: vi.fn(),
  eventCreate: vi.fn(),
  eventFindUnique: vi.fn(),
  upsertAndMatchContact: vi.fn(),
  getOrCreateConversation: vi.fn(),
  enqueueMediaDownload: vi.fn(),
  applyStoredStatuses: vi.fn(),
  applyTransition: vi.fn(),
  bossSend: vi.fn(),
}))

vi.mock("@/lib/db/prisma", () => ({
  default: {
    whatsAppMessage: { findUnique: m.msgFindUnique, findFirst: m.msgFindFirst, create: m.msgCreate },
    whatsAppContact: { findUnique: m.contactFindUnique },
    conversation: { updateMany: m.convUpdateMany },
    conversationEvent: { create: m.eventCreate },
    whatsAppWebhookEvent: { findUnique: m.eventFindUnique },
  },
}))
vi.mock("@/lib/queue/boss", () => ({ getBoss: async () => ({ send: m.bossSend }) }))
vi.mock("../contacts", () => ({ upsertAndMatchContact: m.upsertAndMatchContact }))
vi.mock("../inbound", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../inbound")>()),
  getOrCreateConversation: m.getOrCreateConversation,
  enqueueMediaDownload: m.enqueueMediaDownload,
}))
vi.mock("../statuses", () => ({ applyStoredStatuses: m.applyStoredStatuses }))
vi.mock("../transition-port", () => ({ applyTransitionPort: m.applyTransition }))

import {
  ECHO_RECONCILE_MAX_ATTEMPTS,
  handleEchoReconcileJobs,
  processEcho,
  shouldEchoTakeOver,
} from "../echoes"

const ECHO_AT = new Date(1760000002 * 1000)
const NOW = new Date(ECHO_AT.getTime() + 1000)
const payload = splitWebhookPayload(fixtures.echo)[0].payload

function conversation(overrides: Record<string, unknown> = {}) {
  return { id: "conv-1", status: "AI", lastAiSentAt: null, ...overrides }
}

function p2002() {
  return new Prisma.PrismaClientKnownRequestError("unique", { code: "P2002", clientVersion: "test" })
}

const run = (attempt = 0) => processEcho(payload, { eventId: "ev1", attempt, now: NOW, receivedAt: NOW })

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, "warn").mockImplementation(() => {})
  vi.stubEnv("WHATSAPP_ENABLED", "true")
  m.msgFindUnique.mockResolvedValue(null)
  m.msgFindFirst.mockResolvedValue(null)
  m.msgCreate.mockResolvedValue({ id: "msg-1" })
  m.contactFindUnique.mockResolvedValue({ id: "c1", waId: "573001234567" })
  m.getOrCreateConversation.mockResolvedValue(conversation())
  m.applyTransition.mockResolvedValue(true)
  m.bossSend.mockResolvedValue("job")
})

describe("shouldEchoTakeOver (CH-9)", () => {
  const lastAi = new Date("2026-10-19T12:00:00Z")

  it("takes over when there is no AI send yet", () => {
    expect(shouldEchoTakeOver(lastAi, null)).toBe(true)
  })

  it("takes over when the echo is newer than, or equal to, the last AI send", () => {
    expect(shouldEchoTakeOver(new Date(lastAi.getTime() + 1), lastAi)).toBe(true)
    expect(shouldEchoTakeOver(lastAi, lastAi)).toBe(true)
  })

  it("does not take over for an older, out-of-order echo", () => {
    expect(shouldEchoTakeOver(new Date(lastAi.getTime() - 1), lastAi)).toBe(false)
  })
})

describe("processEcho: our own sends (CH-10, S-CH-3)", () => {
  it("does nothing when the wamid is already stored", async () => {
    m.msgFindUnique.mockResolvedValue({ id: "existing" })

    await expect(run()).resolves.toBe("own")

    expect(m.applyTransition).not.toHaveBeenCalled()
    expect(m.msgCreate).not.toHaveBeenCalled()
    expect(m.getOrCreateConversation).not.toHaveBeenCalled()
  })

  it("treats a concurrent duplicate insert as our own message", async () => {
    m.msgCreate.mockRejectedValue(p2002())

    await expect(run()).resolves.toBe("own")

    expect(m.convUpdateMany).not.toHaveBeenCalled()
  })

  it.each(["AI", "DASHBOARD", "SYSTEM"])("does not take over for a stored %s message", async (source) => {
    m.msgFindUnique.mockResolvedValue({ id: "existing", source, conversation: conversation() })

    await expect(run()).resolves.toBe("own")

    expect(m.applyTransition).not.toHaveBeenCalled()
    expect(m.msgCreate).not.toHaveBeenCalled()
  })
})

describe("processEcho: own send stores its wamid mid-classification (race)", () => {
  it("applies NO HUMAN_ECHO when the insert hits P2002 because our send won (no false takeover)", async () => {
    // Known-wamid lookup misses, the in-flight lookup misses (the row just became SENT), and
    // by the time we insert, the send job has stored the wamid.
    m.msgFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "ours", source: "AI", conversation: conversation() })
    m.msgCreate.mockRejectedValue(p2002())

    await expect(run()).resolves.toBe("own")

    expect(m.applyTransition).not.toHaveBeenCalled()
    expect(m.convUpdateMany).not.toHaveBeenCalled()
    expect(m.eventCreate).not.toHaveBeenCalled()
  })

  it("never calls the transition before the insert has succeeded", async () => {
    m.msgCreate.mockImplementation(async () => {
      expect(m.applyTransition).not.toHaveBeenCalled()
      return { id: "msg-1" }
    })

    await run()

    expect(m.applyTransition).toHaveBeenCalledTimes(1)
  })

  it("lets a concurrent delivery of the same phone echo finish the (guarded) takeover", async () => {
    m.msgFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "theirs", source: "PHONE_APP", conversation: conversation() })
    m.msgCreate.mockRejectedValue(p2002())
    m.applyTransition.mockResolvedValue(false) // the other run already moved it

    await expect(run()).resolves.toBe("stored")

    expect(m.applyTransition).toHaveBeenCalledTimes(1)
    expect(m.msgCreate).toHaveBeenCalledTimes(1)
  })

  it("finishes the takeover on redelivery when a run died between the insert and the transition", async () => {
    m.msgFindUnique.mockResolvedValue({ id: "inserted", source: "PHONE_APP", conversation: conversation() })

    await expect(run()).resolves.toBe("stored-takeover")

    expect(m.applyTransition).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: "conv-1", event: "HUMAN_ECHO", reason: "echo:wamid.ECHO1" })
    )
    expect(m.msgCreate).not.toHaveBeenCalled()
    expect(m.applyStoredStatuses).toHaveBeenCalledWith("wamid.ECHO1")
  })

  it("does not take over on redelivery when the stored echo is older than the last AI send", async () => {
    m.msgFindUnique.mockResolvedValue({
      id: "inserted",
      source: "PHONE_APP",
      conversation: conversation({ lastAiSentAt: new Date(ECHO_AT.getTime() + 60_000) }),
    })

    await expect(run()).resolves.toBe("stored")

    expect(m.applyTransition).not.toHaveBeenCalled()
  })
})

describe("processEcho: in-flight sends (D7.2)", () => {
  it("schedules wa.echo.reconcile (5 s) instead of classifying when a send is in flight", async () => {
    m.msgFindFirst.mockResolvedValue({ id: "queued-1" })

    await expect(run(0)).resolves.toBe("reconcile-scheduled")

    expect(m.msgFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          direction: "OUT",
          status: "QUEUED",
          wamid: null,
          createdAt: { gte: new Date(NOW.getTime() - 120_000) },
        }),
      })
    )
    expect(m.bossSend).toHaveBeenCalledWith(
      "wa.echo.reconcile",
      { eventId: "ev1", attempt: 1 },
      { startAfter: 5, singletonKey: "ev1:1" }
    )
    expect(m.msgCreate).not.toHaveBeenCalled()
    expect(m.applyTransition).not.toHaveBeenCalled()
  })

  it("keeps re-checking until the attempt limit", async () => {
    m.msgFindFirst.mockResolvedValue({ id: "queued-1" })

    await expect(run(ECHO_RECONCILE_MAX_ATTEMPTS - 1)).resolves.toBe("reconcile-scheduled")
    expect(m.bossSend.mock.calls[0][1]).toEqual({ eventId: "ev1", attempt: ECHO_RECONCILE_MAX_ATTEMPTS })
  })

  it("accepts it as a phone-app message once the re-checks are exhausted", async () => {
    m.msgFindFirst.mockResolvedValue({ id: "queued-1" })

    await expect(run(ECHO_RECONCILE_MAX_ATTEMPTS)).resolves.toBe("stored-takeover")

    expect(m.bossSend).not.toHaveBeenCalled()
  })

  it("on a re-check, recognizes the send once its wamid was stored", async () => {
    m.msgFindUnique.mockResolvedValue({ id: "queued-1" }) // wamid now stored by the send job

    await expect(run(1)).resolves.toBe("own")

    expect(m.applyTransition).not.toHaveBeenCalled()
  })
})

describe("processEcho: phone-app echoes (WC-8, S-WC-6, S-CH-1)", () => {
  it("stores OUT/PHONE_APP/SENT and moves the conversation to HUMAN", async () => {
    await expect(run()).resolves.toBe("stored-takeover")

    expect(m.applyTransition).toHaveBeenCalledWith({
      conversationId: "conv-1",
      event: "HUMAN_ECHO",
      actor: "PHONE_APP",
      reason: "echo:wamid.ECHO1",
    })
    expect(m.msgCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conversationId: "conv-1",
        wamid: "wamid.ECHO1",
        direction: "OUT",
        source: "PHONE_APP",
        type: "TEXT",
        text: "Respuesta",
        status: "SENT",
        statusRank: 1,
        timestamp: ECHO_AT,
        sentAt: ECHO_AT,
      }),
      select: { id: true },
    })
    expect(m.applyStoredStatuses).toHaveBeenCalledWith("wamid.ECHO1")
  })

  it("inserts first and only then applies the takeover, so the insert arbitrates own vs phone", async () => {
    await run()

    expect(m.msgCreate.mock.invocationCallOrder[0]).toBeLessThan(m.applyTransition.mock.invocationCallOrder[0])
  })

  it("updates the preview without touching unread count or the 24 h window", async () => {
    await run()

    expect(m.convUpdateMany).toHaveBeenCalledWith({
      where: { id: "conv-1", lastMessageAt: { lte: ECHO_AT } },
      data: { lastMessageAt: ECHO_AT, lastMessagePreview: "Respuesta" },
    })
  })

  it("creates a HUMAN conversation when the person writes first from the phone", async () => {
    m.contactFindUnique.mockResolvedValue(null)
    m.upsertAndMatchContact.mockResolvedValue({ id: "c2", waId: "573001234567" })

    await run()

    expect(m.upsertAndMatchContact).toHaveBeenCalledWith({ waId: "573001234567", seenAt: ECHO_AT })
    expect(m.getOrCreateConversation).toHaveBeenCalledWith(
      expect.objectContaining({ id: "c2" }),
      ECHO_AT,
      { status: "HUMAN", event: "ECHO_FIRST_CONTACT", actor: "PHONE_APP" }
    )
  })

  it("stores without a state change when the conversation is already HUMAN", async () => {
    m.getOrCreateConversation.mockResolvedValue(conversation({ status: "HUMAN" }))
    m.applyTransition.mockResolvedValue(false)

    await expect(run()).resolves.toBe("stored")

    expect(m.msgCreate).toHaveBeenCalledTimes(1)
    expect(m.eventCreate).not.toHaveBeenCalled()
  })

  it("stores and audits an older out-of-order echo without moving the state (CH-9)", async () => {
    m.getOrCreateConversation.mockResolvedValue(
      conversation({ lastAiSentAt: new Date(ECHO_AT.getTime() + 60_000) })
    )

    await expect(run()).resolves.toBe("stored")

    expect(m.applyTransition).not.toHaveBeenCalled()
    expect(m.msgCreate).toHaveBeenCalledTimes(1)
    expect(m.eventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conversationId: "conv-1",
        fromStatus: "AI",
        toStatus: "AI",
        event: "ECHO_OUT_OF_ORDER",
        actor: "PHONE_APP",
      }),
    })
  })

  it("queues the media download for an echoed attachment", async () => {
    const withMedia = {
      item: {
        id: "wamid.ECHO2",
        to: "573001234567",
        timestamp: "1760000002",
        type: "image",
        image: { id: "MEDIA9", mime_type: "image/jpeg", caption: "Foto" },
      },
    }

    await processEcho(withMedia, { eventId: "ev2", now: NOW, receivedAt: NOW })

    expect(m.msgCreate.mock.calls[0][0].data).toMatchObject({
      type: "IMAGE",
      text: "Foto",
      media: { create: expect.objectContaining({ metaMediaId: "MEDIA9", status: "PENDING" }) },
    })
    expect(m.enqueueMediaDownload).toHaveBeenCalledWith("msg-1")
  })

  it("skips items without an id or recipient", async () => {
    await expect(processEcho({ item: { id: "wamid.X" } }, { eventId: "ev3" })).resolves.toBe("skipped")
    await expect(processEcho({ item: { to: "573001234567" } }, { eventId: "ev3" })).resolves.toBe("skipped")
    expect(m.msgCreate).not.toHaveBeenCalled()
  })

  it("propagates I/O errors so the raw event is retried", async () => {
    m.msgCreate.mockRejectedValue(new Error("db down"))

    await expect(run()).rejects.toThrow("db down")
  })
})

describe("handleEchoReconcileJobs", () => {
  const job = { id: "j1", data: { eventId: "ev1", attempt: 1 } } as never

  it("re-runs the classification for the stored echo event", async () => {
    m.eventFindUnique.mockResolvedValue({ payload })
    m.msgFindUnique.mockResolvedValue({ id: "queued-1" })

    await handleEchoReconcileJobs([job])

    expect(m.eventFindUnique).toHaveBeenCalledWith({ where: { id: "ev1" }, select: { payload: true } })
    expect(m.msgFindUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { wamid: "wamid.ECHO1" } }))
  })

  it("ignores events that no longer exist", async () => {
    m.eventFindUnique.mockResolvedValue(null)

    await expect(handleEchoReconcileJobs([job])).resolves.toBeUndefined()
    expect(m.msgFindUnique).not.toHaveBeenCalled()
  })

  it("is a no-op while WHATSAPP_ENABLED is off", async () => {
    vi.stubEnv("WHATSAPP_ENABLED", "false")

    await handleEchoReconcileJobs([job])

    expect(m.eventFindUnique).not.toHaveBeenCalled()
  })
})
