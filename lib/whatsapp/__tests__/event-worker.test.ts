import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { findUnique, update, processWebhookEvent } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  processWebhookEvent: vi.fn(),
}))
vi.mock("../process-event", () => ({ processWebhookEvent }))
vi.mock("@/lib/db/prisma", () => ({ default: { whatsAppWebhookEvent: { findUnique, update } } }))
vi.mock("../sweeper", () => ({ sweepUnprocessedEvents: vi.fn() }))

import { clearWorkerRegistry, getRegisteredWorkers } from "@/lib/queue/workers"
import { handleEventJobs, registerWhatsAppWorkers, setEventProcessor } from "../event-worker"

const job = { id: "j1", name: "wa.event.process", data: { eventId: "e1" } } as never
const event = { id: "e1", kind: "MESSAGE", wamid: "wamid.1", payload: {}, processedAt: null }

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("WHATSAPP_ENABLED", "true")
  update.mockResolvedValue({})
  findUnique.mockResolvedValue(event)
  setEventProcessor(undefined)
})
afterEach(() => {
  vi.unstubAllEnvs()
  clearWorkerRegistry()
})

describe("handleEventJobs", () => {
  it("counts the attempt and marks the event processed after the processor succeeds", async () => {
    const processor = vi.fn(async () => {})
    setEventProcessor(processor)

    await handleEventJobs([job])

    expect(processor).toHaveBeenCalledWith(expect.objectContaining({ id: "e1" }))
    expect(update.mock.calls[0][0].data).toEqual({ attempts: { increment: 1 } })
    expect(update.mock.calls[1][0].data).toMatchObject({ processedAt: expect.any(Date), lastError: null })
  })

  it("keeps the raw event unprocessed, records the error and rethrows so pg-boss retries (S-WC-9)", async () => {
    setEventProcessor(async () => {
      throw new Error("boom")
    })

    await expect(handleEventJobs([job])).rejects.toThrow("boom")

    const datas = update.mock.calls.map((call) => call[0].data)
    expect(datas.some((data) => "processedAt" in data)).toBe(false)
    expect(datas.at(-1)).toEqual({ lastError: "Error: boom" })
  })

  it("leaves the event for the sweeper when no processor is registered yet", async () => {
    await handleEventJobs([job])

    expect(update).toHaveBeenCalledTimes(1) // attempts only
    expect(update.mock.calls[0][0].data).toEqual({ attempts: { increment: 1 } })
  })

  it("skips events that are missing or already processed", async () => {
    const processor = vi.fn()
    setEventProcessor(processor)
    findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ ...event, processedAt: new Date() })

    await handleEventJobs([job, job])

    expect(processor).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it("is a no-op while WHATSAPP_ENABLED is off (S-WC-10)", async () => {
    vi.stubEnv("WHATSAPP_ENABLED", "false")
    const processor = vi.fn()
    setEventProcessor(processor)

    await handleEventJobs([job])

    expect(findUnique).not.toHaveBeenCalled()
    expect(processor).not.toHaveBeenCalled()
  })
})

describe("registerWhatsAppWorkers", () => {
  it("registers the process and sweep handlers once, even if called twice", () => {
    registerWhatsAppWorkers()
    registerWhatsAppWorkers()

    expect(getRegisteredWorkers().map((worker) => worker.queue).sort()).toEqual([
      "wa.event.process",
      "wa.event.sweep",
    ])
  })

  it("installs the real event processor so stored events are processed (S-WC-9 path)", async () => {
    registerWhatsAppWorkers()

    await handleEventJobs([job])

    expect(processWebhookEvent).toHaveBeenCalledWith(expect.objectContaining({ id: "e1" }))
    expect(update.mock.calls.at(-1)?.[0].data).toMatchObject({ processedAt: expect.any(Date) })
  })

  it("keeps a processor that was set explicitly", () => {
    const custom = vi.fn(async () => {})
    setEventProcessor(custom)

    registerWhatsAppWorkers()

    return handleEventJobs([job]).then(() => {
      expect(custom).toHaveBeenCalledTimes(1)
      expect(processWebhookEvent).not.toHaveBeenCalled()
    })
  })
})
