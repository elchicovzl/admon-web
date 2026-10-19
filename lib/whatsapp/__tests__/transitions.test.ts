import { beforeEach, describe, expect, it, vi } from "vitest"

interface Row {
  id: string
  status: "AI" | "HUMAN" | "ESCALATED" | "CLOSED"
  stateVersion: number
  aiPaused: boolean
  [key: string]: unknown
}

const m = vi.hoisted(() => ({ settingsFindUnique: vi.fn() }))

// In-memory conversation + audit table so version races behave like the real database.
const db = vi.hoisted(() => ({
  row: null as unknown as Row,
  events: [] as Array<Record<string, unknown>>,
  /** When set, the next N reads wait until all N have started (forces a read/write interleaving). */
  barrier: null as null | { remaining: number; release: () => void; gate: Promise<void> },
}))

function applyData(row: Row, data: Record<string, unknown>) {
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === "object" && "increment" in (value as object)) {
      row[key] = (Number(row[key]) || 0) + Number((value as { increment: number }).increment)
    } else {
      row[key] = value
    }
  }
}

const tx = {
  conversation: {
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
      if (!db.row || db.row.id !== where.id) return null
      const snapshot = { ...db.row }
      const barrier = db.barrier
      if (barrier && barrier.remaining > 0) {
        barrier.remaining -= 1
        if (barrier.remaining === 0) barrier.release()
        await barrier.gate
      }
      return snapshot
    }),
    updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const matches = Object.entries(where).every(([key, value]) => db.row?.[key] === value)
      if (!matches) return { count: 0 }
      applyData(db.row, data)
      return { count: 1 }
    }),
  },
  conversationEvent: {
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      db.events.push(data)
      return data
    }),
  },
}

vi.mock("@/lib/db/prisma", () => ({
  default: {
    whatsAppSettings: { findUnique: m.settingsFindUnique },
    $transaction: (fn: (client: typeof tx) => unknown) => fn(tx),
  },
}))

import {
  applyTransition,
  applyTransitionForPort,
  isAiGloballyEnabled,
  setConversationAiPaused,
} from "../transitions"

const NOW = new Date("2026-10-19T15:00:00Z")
const now = () => NOW

function seed(overrides: Partial<Row> = {}) {
  db.row = { id: "conv-1", status: "AI", stateVersion: 3, aiPaused: false, ...overrides }
}

function forceInterleaving(readers: number) {
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  db.barrier = { remaining: readers, release, gate }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  db.events = []
  db.barrier = null
  m.settingsFindUnique.mockResolvedValue({ aiEnabled: true })
  vi.stubEnv("WHATSAPP_AI_ENABLED", "true")
  seed()
})

describe("applyTransition", () => {
  it("writes the new state, bumps the version and records the audit event (CH-8)", async () => {
    const outcome = await applyTransition(
      { conversationId: "conv-1", event: "TAKE", actor: "USER", actorUserId: "u1", reason: "manual" },
      { now }
    )

    expect(outcome).toMatchObject({ ok: true, changed: true, from: "AI", to: "HUMAN", stateVersion: 4 })
    expect(db.row).toMatchObject({ status: "HUMAN", stateVersion: 4, takenOverById: "u1", takenOverAt: NOW })
    expect(db.events).toEqual([
      {
        conversationId: "conv-1",
        fromStatus: "AI",
        toStatus: "HUMAN",
        event: "TAKE",
        actor: "USER",
        actorUserId: "u1",
        reason: "manual",
      },
    ])
  })

  it("guards the write on the stateVersion it read", async () => {
    await applyTransition({ conversationId: "conv-1", event: "TAKE", actor: "USER", actorUserId: "u1" }, { now })

    expect(tx.conversation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "conv-1", stateVersion: 3 } })
    )
  })

  it("rejects a conversation that does not exist", async () => {
    await expect(applyTransition({ conversationId: "missing", event: "TAKE", actor: "USER" })).resolves.toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    })
  })

  it("rejects what the table rejects and writes nothing (CH-3, S-CH-8)", async () => {
    seed({ status: "HUMAN" })

    const outcome = await applyTransition({
      conversationId: "conv-1",
      event: "AI_ESCALATE",
      actor: "AI",
      escalation: { reason: "USER_REQUEST" },
    })

    expect(outcome).toMatchObject({ ok: false, code: "INVALID_FROM_STATE" })
    expect(db.row).toMatchObject({ status: "HUMAN", stateVersion: 3 })
    expect(db.events).toEqual([])
  })

  it("rejects an event raised by an actor that may not raise it", async () => {
    seed({ status: "HUMAN" })

    const outcome = await applyTransition({ conversationId: "conv-1", event: "RETURN_TO_AI", actor: "AI" })

    expect(outcome).toMatchObject({ ok: false, code: "ACTOR_NOT_ALLOWED" })
    expect(db.row.status).toBe("HUMAN")
  })

  it("does not bump the version or audit a valid event that changes nothing", async () => {
    seed({ status: "HUMAN" })

    const outcome = await applyTransition({ conversationId: "conv-1", event: "TAKE", actor: "USER", actorUserId: "u1" })

    expect(outcome).toMatchObject({ ok: true, changed: false, stateVersion: 3 })
    expect(tx.conversation.updateMany).not.toHaveBeenCalled()
    expect(db.events).toEqual([])
  })

  it("records the escalation details and the out-of-hours attention time (D12)", async () => {
    const due = new Date("2026-10-26T13:00:00Z")

    await applyTransition(
      {
        conversationId: "conv-1",
        event: "AI_ESCALATE",
        actor: "AI",
        escalation: { reason: "USER_REQUEST", outOfHours: true, attentionDueAt: due },
      },
      { now }
    )

    expect(db.row).toMatchObject({
      status: "ESCALATED",
      escalatedAt: NOW,
      escalationReason: "USER_REQUEST",
      escalatedOutOfHours: true,
      attentionDueAt: due,
    })
    expect(db.events[0]).toMatchObject({ event: "AI_ESCALATE", actor: "AI", reason: "USER_REQUEST" })
  })

  it("clears the attention marker when an escalated conversation is taken", async () => {
    seed({ status: "ESCALATED", attentionDueAt: NOW, escalatedOutOfHours: true })

    await applyTransition({ conversationId: "conv-1", event: "TAKE", actor: "USER", actorUserId: "u1" }, { now })

    expect(db.row).toMatchObject({ status: "HUMAN", attentionDueAt: null, escalatedOutOfHours: false })
  })

  it("has no inactivity timeout: nothing but an explicit event leaves HUMAN (S-CH-4, A15)", async () => {
    seed({ status: "HUMAN" })

    // Seven days later, a client message is still just HUMAN.
    const later = () => new Date(NOW.getTime() + 7 * 24 * 3600_000)
    const outcome = await applyTransition({ conversationId: "conv-1", event: "INBOUND", actor: "CLIENT" }, { now: later })

    expect(outcome).toMatchObject({ ok: true, to: "HUMAN", changed: false })
    expect(db.row.status).toBe("HUMAN")
  })

  describe("return to AI (CH-6, S-CH-5)", () => {
    it("records the actor, moves the cursor to now and clears the takeover", async () => {
      seed({ status: "HUMAN", takenOverById: "u1", takenOverAt: NOW, consecutiveAiFailures: 2 })

      const outcome = await applyTransition(
        { conversationId: "conv-1", event: "RETURN_TO_AI", actor: "USER", actorUserId: "u2" },
        { now }
      )

      expect(outcome).toMatchObject({ ok: true, to: "AI" })
      expect(db.row).toMatchObject({
        status: "AI",
        aiCursorAt: NOW,
        takenOverById: null,
        takenOverAt: null,
        consecutiveAiFailures: 0,
      })
      expect(db.events[0]).toMatchObject({ fromStatus: "HUMAN", toStatus: "AI", event: "RETURN_TO_AI", actor: "USER", actorUserId: "u2" })
    })

    it("is not allowed straight from ESCALATED", async () => {
      seed({ status: "ESCALATED" })

      await expect(
        applyTransition({ conversationId: "conv-1", event: "RETURN_TO_AI", actor: "USER", actorUserId: "u2" })
      ).resolves.toMatchObject({ ok: false, code: "INVALID_FROM_STATE" })
    })
  })

  describe("close and reopen", () => {
    it("close stamps who closed it, and a reopen clears it", async () => {
      await applyTransition({ conversationId: "conv-1", event: "CLOSE", actor: "USER", actorUserId: "u1" }, { now })
      expect(db.row).toMatchObject({ status: "CLOSED", closedAt: NOW, closedById: "u1" })

      await applyTransition(
        { conversationId: "conv-1", event: "REOPEN", actor: "USER", actorUserId: "u1", target: "HUMAN" },
        { now }
      )
      expect(db.row).toMatchObject({ status: "HUMAN", closedAt: null, closedById: null })
      expect(db.events.map((event) => event.event)).toEqual(["CLOSE", "REOPEN"])
    })
  })

  describe("inbound", () => {
    it("auto-reopens a CLOSED conversation into AI when the AI is effective (CH-11, S-CH-7)", async () => {
      seed({ status: "CLOSED", closedAt: NOW, closedById: "u1" })

      const outcome = await applyTransition({ conversationId: "conv-1", event: "INBOUND", actor: "CLIENT" }, { now })

      expect(outcome).toMatchObject({ ok: true, from: "CLOSED", to: "AI", changed: true })
      expect(db.row).toMatchObject({ status: "AI", closedAt: null, closedById: null })
      expect(db.events[0]).toMatchObject({ event: "INBOUND_REOPEN", actor: "CLIENT", fromStatus: "CLOSED", toStatus: "AI" })
    })

    it.each([
      ["the env switch is off", () => vi.stubEnv("WHATSAPP_AI_ENABLED", "false")],
      ["the database switch is off", () => m.settingsFindUnique.mockResolvedValue({ aiEnabled: false })],
    ])("auto-reopens into HUMAN when %s", async (_label, turnOff) => {
      turnOff()
      seed({ status: "CLOSED" })

      await applyTransition({ conversationId: "conv-1", event: "INBOUND", actor: "CLIENT" })

      expect(db.row.status).toBe("HUMAN")
    })

    it("auto-reopens into HUMAN when the conversation has the AI paused", async () => {
      seed({ status: "CLOSED", aiPaused: true })

      await applyTransition({ conversationId: "conv-1", event: "INBOUND", actor: "CLIENT" })

      expect(db.row.status).toBe("HUMAN")
    })

    it("asks for an AI turn on an AI conversation, but not when it is paused", async () => {
      await expect(
        applyTransition({ conversationId: "conv-1", event: "INBOUND", actor: "CLIENT" })
      ).resolves.toMatchObject({ ok: true, changed: false, scheduleAiTurn: true })

      seed({ aiPaused: true })
      await expect(
        applyTransition({ conversationId: "conv-1", event: "INBOUND", actor: "CLIENT" })
      ).resolves.toMatchObject({ ok: true, changed: false, scheduleAiTurn: false })
    })

    it("flags activity on an ESCALATED conversation without answering it (CH-7, S-CH-6)", async () => {
      seed({ status: "ESCALATED" })

      await expect(
        applyTransition({ conversationId: "conv-1", event: "INBOUND", actor: "CLIENT" })
      ).resolves.toMatchObject({ ok: true, to: "ESCALATED", scheduleAiTurn: false, notifyActivity: true })
    })

    it("does not read the AI settings for events that do not depend on them", async () => {
      await applyTransition({ conversationId: "conv-1", event: "TAKE", actor: "USER", actorUserId: "u1" })

      expect(m.settingsFindUnique).not.toHaveBeenCalled()
    })

    it("runs inside the caller's transaction when one is passed", async () => {
      seed({ status: "CLOSED" })
      const inner = {
        conversation: { findUnique: vi.fn().mockResolvedValue({ status: "HUMAN", stateVersion: 1, aiPaused: false }), updateMany: vi.fn() },
        conversationEvent: { create: vi.fn() },
      }

      const outcome = await applyTransition(
        { conversationId: "conv-1", event: "INBOUND", actor: "CLIENT" },
        { db: inner as never }
      )

      expect(outcome).toMatchObject({ ok: true, changed: false })
      expect(inner.conversation.findUnique).toHaveBeenCalled()
      expect(tx.conversation.findUnique).not.toHaveBeenCalled()
    })
  })

  describe("simultaneous transitions (S-CH-9, D9)", () => {
    const reply = { conversationId: "conv-1", event: "DASHBOARD_REPLY", actor: "USER", actorUserId: "u1" } as const
    const escalate = {
      conversationId: "conv-1",
      event: "AI_ESCALATE",
      actor: "AI",
      escalation: { reason: "USER_REQUEST" },
    } as const

    it("a reply that wins makes the escalation lose: one state, one audit row", async () => {
      forceInterleaving(2)

      const [replied, escalated] = await Promise.all([applyTransition(reply, { now }), applyTransition(escalate, { now })])

      expect(replied).toMatchObject({ ok: true, to: "HUMAN" })
      expect(escalated).toMatchObject({ ok: false, code: "INVALID_FROM_STATE" })
      expect(db.row).toMatchObject({ status: "HUMAN", stateVersion: 4 })
      expect(db.events).toHaveLength(1)
    })

    it("an escalation that wins is followed by the reply on top of it: a consistent chain", async () => {
      forceInterleaving(2)

      const [escalated, replied] = await Promise.all([applyTransition(escalate, { now }), applyTransition(reply, { now })])

      expect(escalated).toMatchObject({ ok: true, to: "ESCALATED" })
      expect(replied).toMatchObject({ ok: true, from: "ESCALATED", to: "HUMAN" })
      expect(db.row).toMatchObject({ status: "HUMAN", stateVersion: 5 })
      expect(db.events.map((event) => [event.fromStatus, event.toStatus])).toEqual([
        ["AI", "ESCALATED"],
        ["ESCALATED", "HUMAN"],
      ])
    })

    it("gives up with CONFLICT after the single retry also loses", async () => {
      const first = tx.conversation.updateMany.getMockImplementation()!
      tx.conversation.updateMany.mockResolvedValue({ count: 0 })

      const outcome = await applyTransition(reply, { now })

      expect(outcome).toMatchObject({ ok: false, code: "CONFLICT" })
      expect(tx.conversation.updateMany).toHaveBeenCalledTimes(2)
      expect(db.events).toEqual([])
      tx.conversation.updateMany.mockImplementation(first)
    })
  })
})

describe("setConversationAiPaused (WI-9)", () => {
  it("pauses without moving the state and audits AI_PAUSED", async () => {
    const outcome = await setConversationAiPaused({ conversationId: "conv-1", paused: true, actorUserId: "u1" }, { now })

    expect(outcome).toEqual({ ok: true, changed: true })
    expect(db.row).toMatchObject({ status: "AI", stateVersion: 3, aiPaused: true, aiPausedById: "u1", aiPausedAt: NOW })
    expect(db.events).toEqual([
      { conversationId: "conv-1", fromStatus: "AI", toStatus: "AI", event: "AI_PAUSED", actor: "USER", actorUserId: "u1" },
    ])
  })

  it("resumes, clears the pause and moves the cursor so the backlog is not answered", async () => {
    seed({ aiPaused: true, aiPausedById: "u1", aiPausedAt: NOW })

    await setConversationAiPaused({ conversationId: "conv-1", paused: false, actorUserId: "u2" }, { now })

    expect(db.row).toMatchObject({ aiPaused: false, aiPausedById: null, aiPausedAt: null, aiCursorAt: NOW, stateVersion: 3 })
    expect(db.events[0]).toMatchObject({ event: "AI_RESUMED", actorUserId: "u2" })
  })

  it("is a silent no-op when the switch already has that value", async () => {
    await expect(
      setConversationAiPaused({ conversationId: "conv-1", paused: false, actorUserId: "u1" })
    ).resolves.toEqual({ ok: true, changed: false })
    expect(db.events).toEqual([])
  })

  it("reports a missing conversation", async () => {
    await expect(
      setConversationAiPaused({ conversationId: "missing", paused: true, actorUserId: "u1" })
    ).resolves.toEqual({ ok: false, code: "NOT_FOUND" })
  })

  it("a paused AI conversation is not AI-effective: inbound schedules no turn", async () => {
    await setConversationAiPaused({ conversationId: "conv-1", paused: true, actorUserId: "u1" })

    await expect(
      applyTransition({ conversationId: "conv-1", event: "INBOUND", actor: "CLIENT" })
    ).resolves.toMatchObject({ ok: true, to: "AI", scheduleAiTurn: false })
  })
})

describe("applyTransitionForPort", () => {
  const request = { conversationId: "conv-1", event: "HUMAN_ECHO", actor: "PHONE_APP", reason: "echo:w1" } as const

  it("answers true only when the echo moved the conversation (CH-9)", async () => {
    await expect(applyTransitionForPort(request)).resolves.toBe(true)
    expect(db.events[0]).toMatchObject({ event: "HUMAN_ECHO", actor: "PHONE_APP", reason: "echo:w1", fromStatus: "AI", toStatus: "HUMAN" })

    await expect(applyTransitionForPort(request)).resolves.toBe(false) // already HUMAN
  })

  it.each(["ESCALATED"] as const)("moves %s to HUMAN as well", async (status) => {
    seed({ status })
    await expect(applyTransitionForPort(request)).resolves.toBe(true)
  })

  it("leaves a CLOSED conversation alone", async () => {
    seed({ status: "CLOSED" })
    await expect(applyTransitionForPort(request)).resolves.toBe(false)
    expect(db.row.status).toBe("CLOSED")
  })
})

describe("isAiGloballyEnabled", () => {
  it("needs both the env flag and the database switch", async () => {
    await expect(isAiGloballyEnabled()).resolves.toBe(true)

    vi.stubEnv("WHATSAPP_AI_ENABLED", "false")
    await expect(isAiGloballyEnabled()).resolves.toBe(false)

    vi.stubEnv("WHATSAPP_AI_ENABLED", "true")
    m.settingsFindUnique.mockResolvedValue(null)
    await expect(isAiGloballyEnabled()).resolves.toBe(false)
  })
})
