import { describe, it, expect, vi } from "vitest"
import {
  DEAD_LETTER_QUEUE,
  QUEUES,
  QUEUE_DEFINITIONS,
  QUEUE_SEND_DEFAULTS,
  buildQueueSendDefaults,
  ensureQueues,
} from "../queues"
import { SCHEDULE_DEFINITIONS, ensureSchedules } from "../schedules"

const TOPOLOGY = [
  "wa.event.process",
  "wa.event.sweep",
  "wa.message.send",
  "wa.echo.reconcile",
  "wa.media.download",
  "ai.transcribe",
  "ai.turn",
  "kb.ingest",
  "notify.email",
  "retention.purge",
  "affiliation.draft.materialize",
]

describe("queue topology (D2)", () => {
  it("defines exactly the queues in the topology table", () => {
    expect(QUEUE_DEFINITIONS.map((q) => q.name).sort()).toEqual([...TOPOLOGY].sort())
    expect(Object.values(QUEUES).sort()).toEqual([...TOPOLOGY].sort())
  })

  it("uses wa.dead as the dead-letter queue name", () => {
    expect(DEAD_LETTER_QUEUE).toBe("wa.dead")
  })

  it.each(QUEUE_DEFINITIONS.map((q) => [q.name, q] as const))(
    "%s has a retry policy and dead-letters to wa.dead",
    (_name, definition) => {
      expect(definition.retryLimit).toBeGreaterThan(0)
      expect(definition.retryDelay).toBeGreaterThan(0)
      expect(typeof definition.retryBackoff).toBe("boolean")
      expect(definition.deadLetter).toBe("wa.dead")
    }
  )

  it("matches the documented retry limits", () => {
    const limit = (name: string) => QUEUE_DEFINITIONS.find((q) => q.name === name)?.retryLimit
    expect(limit("wa.event.process")).toBe(5)
    expect(limit("wa.message.send")).toBe(4)
    expect(limit("wa.echo.reconcile")).toBe(3)
    expect(limit("wa.media.download")).toBe(3)
    expect(limit("ai.transcribe")).toBe(2)
    expect(limit("kb.ingest")).toBe(2)
    expect(limit("notify.email")).toBe(3)
    expect(limit("affiliation.draft.materialize")).toBe(3)
  })

  it("uses exponential backoff for the send outbox", () => {
    expect(QUEUE_DEFINITIONS.find((q) => q.name === "wa.message.send")?.retryBackoff).toBe(true)
  })

  it("ai.turn is stately (one queued + one active per conversation, AI-7)", () => {
    const aiTurn = QUEUE_DEFINITIONS.find((q) => q.name === "ai.turn")
    expect(aiTurn?.policy).toBe("stately")
    expect(QUEUE_SEND_DEFAULTS["ai.turn"]).toEqual({ startAfter: 8 })
  })

  it("ai.turn delay follows the configured debounce instead of a duplicated constant", () => {
    expect(buildQueueSendDefaults({ debounceSeconds: 15 })["ai.turn"]).toEqual({ startAfter: 15 })
  })

  it("wa.echo.reconcile is deferred 5 seconds", () => {
    expect(QUEUE_SEND_DEFAULTS["wa.echo.reconcile"]).toEqual({ startAfter: 5 })
  })

  it("only ai.turn departs from the standard policy", () => {
    const nonStandard = QUEUE_DEFINITIONS.filter((q) => q.policy && q.policy !== "standard")
    expect(nonStandard.map((q) => q.name)).toEqual(["ai.turn"])
  })
})

describe("schedules (D2)", () => {
  it("sweeps unprocessed webhook events every minute", () => {
    expect(SCHEDULE_DEFINITIONS).toContainEqual({
      queue: "wa.event.sweep",
      cron: "* * * * *",
      tz: "UTC",
    })
  })

  it("purges retention daily at 03:00 America/Bogota", () => {
    expect(SCHEDULE_DEFINITIONS).toContainEqual({
      queue: "retention.purge",
      cron: "0 3 * * *",
      tz: "America/Bogota",
    })
  })

  it("only schedules defined queues", () => {
    const names = new Set(QUEUE_DEFINITIONS.map((q) => q.name))
    for (const schedule of SCHEDULE_DEFINITIONS) {
      expect(names.has(schedule.queue)).toBe(true)
    }
  })
})

describe("ensureQueues / ensureSchedules", () => {
  it("creates the dead-letter queue before any queue that references it", async () => {
    const created: string[] = []
    const boss = {
      createQueue: vi.fn(async (name: string) => {
        created.push(name)
      }),
      updateQueue: vi.fn(async () => {}),
    }

    await ensureQueues(boss)

    expect(created[0]).toBe("wa.dead")
    expect(created).toHaveLength(QUEUE_DEFINITIONS.length + 1)
  })

  it("passes the stately policy and dead-letter option to createQueue", async () => {
    const boss = { createQueue: vi.fn(async () => {}), updateQueue: vi.fn(async () => {}) }

    await ensureQueues(boss)

    expect(boss.createQueue).toHaveBeenCalledWith(
      "ai.turn",
      expect.objectContaining({ policy: "stately", deadLetter: "wa.dead" })
    )
    expect(boss.createQueue).toHaveBeenCalledWith(
      "wa.event.process",
      expect.objectContaining({ retryLimit: 5, deadLetter: "wa.dead" })
    )
  })

  it("registers each schedule with its timezone", async () => {
    const boss = { schedule: vi.fn(async () => {}) }

    await ensureSchedules(boss)

    expect(boss.schedule).toHaveBeenCalledWith("wa.event.sweep", "* * * * *", null, { tz: "UTC" })
    expect(boss.schedule).toHaveBeenCalledWith("retention.purge", "0 3 * * *", null, {
      tz: "America/Bogota",
    })
  })
})
