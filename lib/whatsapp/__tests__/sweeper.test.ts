import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { findMany, send, getBoss } = vi.hoisted(() => ({
  findMany: vi.fn(),
  send: vi.fn(),
  getBoss: vi.fn(),
}))
vi.mock("@/lib/db/prisma", () => ({ default: { whatsAppWebhookEvent: { findMany } } }))
vi.mock("@/lib/queue/boss", () => ({ getBoss }))

import { SWEEP_MIN_AGE_MS, sweepUnprocessedEvents } from "../sweeper"

const NOW = new Date("2026-10-19T12:00:00Z")

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
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
})
