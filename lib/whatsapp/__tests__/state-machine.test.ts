import { describe, expect, it } from "vitest"
import type { ConversationStatus } from "@prisma/client"
import { EVENT_ACTORS, transition, type ConversationEventType } from "../state-machine"

const AI_ON = { aiEffective: true }
const AI_OFF = { aiEffective: false }

function ok(result: ReturnType<typeof transition>) {
  if (!result.ok) throw new Error(`expected a transition, got ${result.reason}`)
  return result
}

describe("first contact (CH-1)", () => {
  it("starts in AI when the AI is effective", () => {
    expect(ok(transition(null, "INBOUND", AI_ON))).toMatchObject({
      from: null,
      to: "AI",
      changed: true,
      auditEvent: "INBOUND_FIRST_CONTACT",
    })
  })

  it("starts in HUMAN when the AI is not effective", () => {
    expect(ok(transition(null, "INBOUND", AI_OFF))).toMatchObject({ to: "HUMAN", auditEvent: "INBOUND_FIRST_CONTACT" })
  })

  it("starts in HUMAN when a person wrote first from the phone", () => {
    expect(ok(transition(null, "HUMAN_ECHO", AI_ON))).toMatchObject({ to: "HUMAN", auditEvent: "ECHO_FIRST_CONTACT" })
  })

  it.each(["DASHBOARD_REPLY", "TAKE", "AI_ESCALATE", "RETURN_TO_AI", "CLOSE", "REOPEN"] as const)(
    "rejects %s when there is no conversation",
    (event) => {
      expect(transition(null, event, { ...AI_ON, target: "AI" })).toMatchObject({ ok: false, reason: "INVALID_FROM_STATE" })
    }
  )
})

describe("inbound", () => {
  it("reopens a CLOSED conversation into AI when the AI is effective (CH-2, CH-11, S-CH-7)", () => {
    expect(ok(transition("CLOSED", "INBOUND", AI_ON))).toMatchObject({
      from: "CLOSED",
      to: "AI",
      changed: true,
      auditEvent: "INBOUND_REOPEN",
    })
  })

  it("reopens a CLOSED conversation into HUMAN when the AI is not effective (S-CH-7)", () => {
    expect(ok(transition("CLOSED", "INBOUND", AI_OFF))).toMatchObject({ to: "HUMAN", auditEvent: "INBOUND_REOPEN" })
  })

  it("keeps AI and schedules a turn only when the AI is effective", () => {
    expect(ok(transition("AI", "INBOUND", AI_ON))).toMatchObject({ to: "AI", changed: false, scheduleAiTurn: true })
    // paused (aiEffective false) behaves like HUMAN for replies
    expect(ok(transition("AI", "INBOUND", AI_OFF))).toMatchObject({ to: "AI", changed: false, scheduleAiTurn: false })
  })

  it("keeps HUMAN and never schedules the AI", () => {
    expect(ok(transition("HUMAN", "INBOUND", AI_ON))).toMatchObject({ to: "HUMAN", changed: false, scheduleAiTurn: false })
  })

  it("keeps ESCALATED, never answers it with the AI, and asks for an activity notice (CH-7, S-CH-6)", () => {
    expect(ok(transition("ESCALATED", "INBOUND", AI_ON))).toMatchObject({
      to: "ESCALATED",
      changed: false,
      scheduleAiTurn: false,
      notifyActivity: true,
    })
  })

  it("does not ask for an activity notice outside ESCALATED", () => {
    for (const from of ["AI", "HUMAN"] as const) {
      expect(ok(transition(from, "INBOUND", AI_ON)).notifyActivity).toBe(false)
    }
  })
})

describe("human takeover", () => {
  it.each(["AI", "ESCALATED"] as const)("HUMAN_ECHO moves %s to HUMAN (CH-2, CH-9)", (from) => {
    expect(ok(transition(from, "HUMAN_ECHO", AI_ON))).toMatchObject({ to: "HUMAN", changed: true })
  })

  it("HUMAN_ECHO on HUMAN is a no-op and on CLOSED does not reopen the chat", () => {
    expect(ok(transition("HUMAN", "HUMAN_ECHO", AI_ON))).toMatchObject({ to: "HUMAN", changed: false })
    expect(ok(transition("CLOSED", "HUMAN_ECHO", AI_ON))).toMatchObject({ to: "CLOSED", changed: false })
  })

  it.each(["AI", "ESCALATED"] as const)("DASHBOARD_REPLY moves %s to HUMAN (WI-7, CH-4)", (from) => {
    expect(ok(transition(from, "DASHBOARD_REPLY", AI_ON))).toMatchObject({ to: "HUMAN", changed: true })
  })

  it.each(["AI", "ESCALATED"] as const)("TAKE (\"Atender\") moves %s to HUMAN (CH-2)", (from) => {
    expect(ok(transition(from, "TAKE", AI_ON))).toMatchObject({ to: "HUMAN", changed: true })
  })

  it.each(["DASHBOARD_REPLY", "TAKE"] as const)("%s on HUMAN is an idempotent no-op", (event) => {
    expect(ok(transition("HUMAN", event, AI_ON))).toMatchObject({ to: "HUMAN", changed: false })
  })

  it.each(["DASHBOARD_REPLY", "TAKE"] as const)("%s on CLOSED is rejected: reopen first", (event) => {
    expect(transition("CLOSED", event, AI_ON)).toMatchObject({ ok: false, reason: "INVALID_FROM_STATE" })
  })
})

describe("AI_ESCALATE (CH-2, CH-3, S-CH-8)", () => {
  it("moves AI to ESCALATED", () => {
    expect(ok(transition("AI", "AI_ESCALATE", AI_ON, "AI"))).toMatchObject({ to: "ESCALATED", changed: true })
  })

  it.each(["HUMAN", "CLOSED", "ESCALATED"] as const)("is rejected from %s", (from) => {
    expect(transition(from, "AI_ESCALATE", AI_ON, "AI")).toMatchObject({ ok: false, reason: "INVALID_FROM_STATE" })
  })
})

describe("RETURN_TO_AI (CH-6, A15)", () => {
  it("is allowed only from HUMAN", () => {
    expect(ok(transition("HUMAN", "RETURN_TO_AI", AI_ON))).toMatchObject({ to: "AI", changed: true })
  })

  it.each(["AI", "ESCALATED", "CLOSED"] as const)("is rejected from %s: ESCALATED -> AI is not direct", (from) => {
    expect(transition(from, "RETURN_TO_AI", AI_ON)).toMatchObject({ ok: false, reason: "INVALID_FROM_STATE" })
  })
})

describe("CLOSE and REOPEN", () => {
  it.each(["AI", "HUMAN", "ESCALATED"] as const)("CLOSE moves %s to CLOSED", (from) => {
    expect(ok(transition(from, "CLOSE", AI_ON))).toMatchObject({ to: "CLOSED", changed: true })
  })

  it("CLOSE on CLOSED is rejected", () => {
    expect(transition("CLOSED", "CLOSE", AI_ON)).toMatchObject({ ok: false, reason: "INVALID_FROM_STATE" })
  })

  it.each(["AI", "HUMAN"] as const)("REOPEN goes to the chosen target %s", (target) => {
    expect(ok(transition("CLOSED", "REOPEN", { ...AI_ON, target }))).toMatchObject({ to: target, changed: true })
  })

  it("REOPEN needs a target", () => {
    expect(transition("CLOSED", "REOPEN", AI_ON)).toMatchObject({ ok: false, reason: "TARGET_REQUIRED" })
  })

  it.each(["AI", "HUMAN", "ESCALATED"] as const)("REOPEN is rejected from %s", (from) => {
    expect(transition(from, "REOPEN", { ...AI_ON, target: "AI" })).toMatchObject({ ok: false, reason: "INVALID_FROM_STATE" })
  })
})

describe("actors (CH-3)", () => {
  const statuses: ConversationStatus[] = ["AI", "HUMAN", "ESCALATED", "CLOSED"]
  const events = Object.keys(EVENT_ACTORS) as ConversationEventType[]

  it("the AI can only raise AI_ESCALATE", () => {
    for (const event of events) {
      const aiMayRaise = EVENT_ACTORS[event].includes("AI")
      expect(aiMayRaise).toBe(event === "AI_ESCALATE")
    }
  })

  it("rejects an event raised by the wrong actor before looking at the state", () => {
    for (const from of statuses) {
      expect(transition(from, "RETURN_TO_AI", AI_ON, "AI")).toMatchObject({ ok: false, reason: "ACTOR_NOT_ALLOWED" })
      expect(transition(from, "TAKE", AI_ON, "AI")).toMatchObject({ ok: false, reason: "ACTOR_NOT_ALLOWED" })
      expect(transition(from, "REOPEN", { ...AI_ON, target: "AI" }, "AI")).toMatchObject({
        ok: false,
        reason: "ACTOR_NOT_ALLOWED",
      })
    }
    expect(transition("AI", "AI_ESCALATE", AI_ON, "USER")).toMatchObject({ ok: false, reason: "ACTOR_NOT_ALLOWED" })
  })
})
