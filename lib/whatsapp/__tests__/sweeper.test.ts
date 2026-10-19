import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { findMany, count, send, getBoss } = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
  send: vi.fn(),
  getBoss: vi.fn(),
}))
vi.mock("@/lib/db/prisma", () => ({ default: { whatsAppWebhookEvent: { findMany, count } } }))
vi.mock("@/lib/queue/boss", () => ({ getBoss }))

import { SWEEP_BATCH_SIZE, SWEEP_MAX_ATTEMPTS, SWEEP_MIN_AGE_MS, sweepUnprocessedEvents } from "../sweeper"

const NOW = new Date("2026-10-19T12:00:00Z")

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.spyOn(console, "warn").mockImplementation(() => {})
  count.mockResolvedValue(0)
  vi.stubEnv("WHATSAPP_ENABLED", "true")
  getBoss.mockResolvedValue({ send })
  send.mockResolvedValue("job")
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe("sweepUnprocessedEvents", () => {
  it("re-enqueues unprocessed events older than 60 s", async () => {
    findMany.mockResolvedValue([{ id: "e1" }, { id: "e2" }])

    expect(await sweepUnprocessedEvents(NOW)).toBe(2)

    const where = findMany.mock.calls[0][0].where
    expect(where.processedAt).toBeNull()
    expect(where.receivedAt.lt).toEqual(new Date(NOW.getTime() - SWEEP_MIN_AGE_MS))
    expect(send.mock.calls.map((call) => call[1])).toEqual([{ eventId: "e1" }, { eventId: "e2" }])
  })

  it.each([undefined, "", "false"])("does nothing and never reads or queues while the flag is %j", async (flag) => {
    vi.stubEnv("WHATSAPP_ENABLED", flag as string)

    expect(await sweepUnprocessedEvents(NOW)).toBe(0)
    expect(findMany).not.toHaveBeenCalled()
    expect(getBoss).not.toHaveBeenCalled()
  })

  it("keeps sweeping the rest when one enqueue fails", async () => {
    findMany.mockResolvedValue([{ id: "e1" }, { id: "e2" }])
    send.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce("job")

    expect(await sweepUnprocessedEvents(NOW)).toBe(1)
  })

  it("never selects events that reached the attempts ceiling", async () => {
    findMany.mockResolvedValue([])

    await sweepUnprocessedEvents(NOW)

    expect(findMany.mock.calls[0][0].where.attempts).toEqual({ lt: SWEEP_MAX_ATTEMPTS })
  })

  it("flags dead-lettered events by logging how many were skipped, without content", async () => {
    findMany.mockResolvedValue([])
    count.mockResolvedValue(3)

    await sweepUnprocessedEvents(NOW)

    expect(count.mock.calls[0][0].where.attempts).toEqual({ gte: SWEEP_MAX_ATTEMPTS })
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("skipped 3 event(s)"))
  })

  it("does not warn when nothing exhausted its attempts", async () => {
    findMany.mockResolvedValue([])

    await sweepUnprocessedEvents(NOW)

    expect(console.warn).not.toHaveBeenCalled()
  })

  it("orders by fewest attempts first so stuck events cannot starve newer ones", async () => {
    findMany.mockResolvedValue([])

    await sweepUnprocessedEvents(NOW)

    const args = findMany.mock.calls[0][0]
    expect(args.orderBy).toEqual([{ attempts: "asc" }, { receivedAt: "asc" }])
    expect(args.take).toBe(SWEEP_BATCH_SIZE)
  })

  it("still queues a newer event behind more than a full batch of stuck ones", async () => {
    const old = new Date(NOW.getTime() - 3_600_000)
    const rows = [
      ...Array.from({ length: SWEEP_BATCH_SIZE + 50 }, (_, i) => ({
        id: `stuck-${i}`,
        attempts: 5,
        receivedAt: new Date(old.getTime() + i),
      })),
      { id: "fresh", attempts: 0, receivedAt: new Date(NOW.getTime() - 120_000) },
    ]
    findMany.mockImplementation(async ({ where, orderBy, take }) => {
      const matching = rows.filter((row) => row.attempts < where.attempts.lt)
      for (const order of [...orderBy].reverse()) {
        const [[key, dir]] = Object.entries(order) as [[keyof (typeof rows)[number], string]]
        matching.sort((a, b) => {
          const delta = Number(a[key]) - Number(b[key])
          return dir === "asc" ? delta : -delta
        })
      }
      return matching.slice(0, take).map(({ id }) => ({ id }))
    })

    await sweepUnprocessedEvents(NOW)

    expect(send.mock.calls.map((call) => call[1].eventId)).toContain("fresh")
    expect(send).toHaveBeenCalledTimes(SWEEP_BATCH_SIZE)
  })
})
