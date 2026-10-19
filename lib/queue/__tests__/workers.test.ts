import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  registerWorker,
  getRegisteredWorkers,
  clearWorkerRegistry,
  startWorkers,
} from "../workers"

describe("worker registry", () => {
  beforeEach(() => clearWorkerRegistry())

  it("starts empty (no handlers ship in PR0.2)", async () => {
    const boss = { work: vi.fn() }

    expect(getRegisteredWorkers()).toEqual([])
    expect(await startWorkers(boss as never)).toBe(0)
    expect(boss.work).not.toHaveBeenCalled()
  })

  it("attaches each registered handler to its queue", async () => {
    const handler = vi.fn(async () => {})
    const boss = { work: vi.fn(async () => "id") }
    registerWorker({ queue: "wa.event.process", handler })
    registerWorker({ queue: "wa.media.download", handler, options: { batchSize: 1 } })

    expect(await startWorkers(boss as never)).toBe(2)

    expect(boss.work).toHaveBeenCalledWith("wa.event.process", handler)
    expect(boss.work).toHaveBeenCalledWith("wa.media.download", { batchSize: 1 }, handler)
  })

  it("rejects a second worker for the same queue", () => {
    registerWorker({ queue: "kb.ingest", handler: async () => {} })

    expect(() => registerWorker({ queue: "kb.ingest", handler: async () => {} })).toThrow(
      /already registered/
    )
  })
})
