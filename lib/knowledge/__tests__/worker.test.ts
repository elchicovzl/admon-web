import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({ ingest: vi.fn(), isWhatsAppEnabled: vi.fn() }))
vi.mock("../ingest", () => ({ ingestKnowledgeDocument: m.ingest }))
vi.mock("@/lib/whatsapp/ingest", () => ({ isWhatsAppEnabled: m.isWhatsAppEnabled }))

import { clearWorkerRegistry, getRegisteredWorkers } from "@/lib/queue/workers"
import { QUEUES } from "@/lib/queue/queues"
import { handleKbIngestJobs, registerKnowledgeWorkers } from "../worker"

const job = (retryCount: number) => ({ id: "j", data: { documentId: "doc-1" }, retryCount }) as never

beforeEach(() => {
  vi.clearAllMocks()
  clearWorkerRegistry()
  m.isWhatsAppEnabled.mockReturnValue(true)
  m.ingest.mockResolvedValue({ status: "READY", chunkCount: 1 })
})

describe("kb.ingest worker", () => {
  it("passes isLastAttempt once the retry limit (2) is reached", async () => {
    await handleKbIngestJobs([job(0), job(2)])

    expect(m.ingest).toHaveBeenNthCalledWith(1, "doc-1", { isLastAttempt: false })
    expect(m.ingest).toHaveBeenNthCalledWith(2, "doc-1", { isLastAttempt: true })
  })

  it("does nothing while the module is off", async () => {
    m.isWhatsAppEnabled.mockReturnValue(false)

    await handleKbIngestJobs([job(0)])

    expect(m.ingest).not.toHaveBeenCalled()
  })

  it("lets an ingest error fail the job so pg-boss retries it", async () => {
    m.ingest.mockRejectedValue(new Error("503"))

    await expect(handleKbIngestJobs([job(0)])).rejects.toThrow("503")
  })

  it("registers the kb.ingest handler once", () => {
    registerKnowledgeWorkers()
    registerKnowledgeWorkers()

    expect(getRegisteredWorkers().filter((worker) => worker.queue === QUEUES.KB_INGEST)).toHaveLength(1)
  })
})
