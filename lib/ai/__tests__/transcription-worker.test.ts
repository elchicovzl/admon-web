import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  transcribe: vi.fn(),
  isWhatsAppEnabled: vi.fn(),
  getAiConfig: vi.fn(),
  send: vi.fn(),
  getBoss: vi.fn(),
  setAudioStoredPort: vi.fn(),
}))
vi.mock("../transcribe", () => ({ transcribeAudioMessage: m.transcribe }))
vi.mock("@/lib/whatsapp/ingest", () => ({ isWhatsAppEnabled: m.isWhatsAppEnabled }))
vi.mock("@/lib/config/runtime-config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/config/runtime-config")>()),
  getAiConfig: m.getAiConfig,
}))
vi.mock("@/lib/queue/boss", () => ({ getBoss: m.getBoss }))
vi.mock("@/lib/whatsapp/media", () => ({ setAudioStoredPort: m.setAudioStoredPort }))

import { clearWorkerRegistry, getRegisteredWorkers } from "@/lib/queue/workers"
import { QUEUES } from "@/lib/queue/queues"
import { enqueueTranscription, handleTranscribeJobs, registerTranscriptionWorkers } from "../transcription-worker"

const job = (retryCount: number) => ({ id: "j", data: { messageId: "msg-1" }, retryCount }) as never

beforeEach(() => {
  vi.clearAllMocks()
  clearWorkerRegistry()
  m.isWhatsAppEnabled.mockReturnValue(true)
  m.getAiConfig.mockReturnValue({ enabled: true })
  m.transcribe.mockResolvedValue({ status: "DONE" })
  m.getBoss.mockResolvedValue({ send: m.send })
  m.send.mockResolvedValue("job-1")
})

describe("ai.transcribe worker", () => {
  it("marks retries and the last attempt (retry limit 2)", async () => {
    await handleTranscribeJobs([job(0), job(1), job(2)])

    expect(m.transcribe.mock.calls.map((call) => call[1])).toEqual([
      { isLastAttempt: false, isRetry: false },
      { isLastAttempt: false, isRetry: true },
      { isLastAttempt: true, isRetry: true },
    ])
  })

  it("does nothing while the channel is off", async () => {
    m.isWhatsAppEnabled.mockReturnValue(false)

    await handleTranscribeJobs([job(0)])

    expect(m.transcribe).not.toHaveBeenCalled()
  })

  it("lets a provider error fail the job so pg-boss retries it", async () => {
    m.transcribe.mockRejectedValue(new Error("503"))

    await expect(handleTranscribeJobs([job(0)])).rejects.toThrow("503")
  })
})

describe("enqueueTranscription (audio STORED port)", () => {
  it("queues ai.transcribe for the message while AI is on", async () => {
    await enqueueTranscription("msg-1")

    expect(m.send).toHaveBeenCalledWith("ai.transcribe", { messageId: "msg-1" })
  })

  it("queues nothing while AI is off (no model calls with the flag off)", async () => {
    m.getAiConfig.mockReturnValue({ enabled: false })

    await enqueueTranscription("msg-1")

    expect(m.getBoss).not.toHaveBeenCalled()
  })
})

describe("registerTranscriptionWorkers", () => {
  it("plugs the audio port and registers the handler once", () => {
    registerTranscriptionWorkers()
    registerTranscriptionWorkers()

    expect(m.setAudioStoredPort).toHaveBeenCalledWith(enqueueTranscription)
    expect(getRegisteredWorkers().filter((worker) => worker.queue === QUEUES.AI_TRANSCRIBE)).toHaveLength(1)
  })
})
