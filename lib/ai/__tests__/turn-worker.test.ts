import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  runAiTurn: vi.fn(),
  isWhatsAppEnabled: vi.fn(),
  getAiConfig: vi.fn(),
  send: vi.fn(),
  getBoss: vi.fn(),
  setAiTurnScheduler: vi.fn(),
  setOnSentHook: vi.fn(),
}))
vi.mock("../responder/turn", () => ({ runAiTurn: m.runAiTurn }))
vi.mock("@/lib/whatsapp/ingest", () => ({ isWhatsAppEnabled: m.isWhatsAppEnabled }))
vi.mock("@/lib/config/runtime-config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/config/runtime-config")>()),
  getAiConfig: m.getAiConfig,
}))
vi.mock("@/lib/queue/boss", () => ({ getBoss: m.getBoss }))
vi.mock("@/lib/whatsapp/ai-turn-port", () => ({ setAiTurnScheduler: m.setAiTurnScheduler }))
vi.mock("@/lib/whatsapp/send", () => ({ setOnSentHook: m.setOnSentHook }))
vi.mock("../sent-hook", () => ({ recordAiMessageSent: vi.fn() }))

import { clearWorkerRegistry, getRegisteredWorkers } from "@/lib/queue/workers"
import { QUEUES } from "@/lib/queue/queues"
import { recordAiMessageSent } from "../sent-hook"
import { enqueueAiTurn, handleAiTurnJobs, registerAiTurnWorkers } from "../turn-worker"

const job = (data: Record<string, unknown>) => ({ id: "j", data: { conversationId: "conv-1", ...data }, retryCount: 0 }) as never

beforeEach(() => {
  vi.clearAllMocks()
  clearWorkerRegistry()
  m.isWhatsAppEnabled.mockReturnValue(true)
  m.getAiConfig.mockReturnValue({ enabled: true, debounceSeconds: 8 })
  m.getBoss.mockResolvedValue({ send: m.send })
  m.send.mockResolvedValue("job-1")
  m.runAiTurn.mockResolvedValue({ status: "REPLIED" })
})

describe("enqueueAiTurn", () => {
  it("queues one turn per conversation (stately singletonKey) after the debounce delay", async () => {
    await enqueueAiTurn("conv-1")

    expect(m.send).toHaveBeenCalledWith("ai.turn", { conversationId: "conv-1" }, { startAfter: 8, singletonKey: "conv-1" })
  })

  it("can ask for a specific delay", async () => {
    await enqueueAiTurn("conv-1", { delaySeconds: 5 })

    expect(m.send).toHaveBeenCalledWith("ai.turn", { conversationId: "conv-1" }, { startAfter: 5, singletonKey: "conv-1" })
  })

  it("queues nothing while AI is off", async () => {
    m.getAiConfig.mockReturnValue({ enabled: false, debounceSeconds: 8 })

    await enqueueAiTurn("conv-1")

    expect(m.getBoss).not.toHaveBeenCalled()
  })
})

describe("ai.turn handler (AI-14)", () => {
  it("runs the turn and does nothing more on a final outcome", async () => {
    await handleAiTurnJobs([job({})])

    expect(m.runAiTurn).toHaveBeenCalledWith({ conversationId: "conv-1" })
    expect(m.send).not.toHaveBeenCalled()
  })

  it("re-queues itself after the debounce wait", async () => {
    m.runAiTurn.mockResolvedValue({ status: "WAIT", delaySeconds: 5 })

    await handleAiTurnJobs([job({})])

    expect(m.send).toHaveBeenCalledWith("ai.turn", { conversationId: "conv-1" }, { startAfter: 5, singletonKey: "conv-1" })
  })

  it("asks for another turn when the client wrote again (usually already queued by that message)", async () => {
    m.runAiTurn.mockResolvedValue({ status: "DISCARDED", reason: "NEWER_INBOUND" })

    await handleAiTurnJobs([job({})])

    expect(m.send).toHaveBeenCalledWith("ai.turn", { conversationId: "conv-1" }, { startAfter: 8, singletonKey: "conv-1" })
  })

  it("does not re-queue other discards (a person took over)", async () => {
    m.runAiTurn.mockResolvedValue({ status: "DISCARDED", reason: "NOT_AI" })

    await handleAiTurnJobs([job({})])

    expect(m.send).not.toHaveBeenCalled()
  })

  it("does nothing while the channel is off", async () => {
    m.isWhatsAppEnabled.mockReturnValue(false)

    await handleAiTurnJobs([job({})])

    expect(m.runAiTurn).not.toHaveBeenCalled()
  })
})

describe("registerAiTurnWorkers", () => {
  it("plugs the inbound scheduler and the onSent hook, and registers the handler once", () => {
    registerAiTurnWorkers()
    registerAiTurnWorkers()

    expect(m.setAiTurnScheduler).toHaveBeenCalledWith(expect.any(Function))
    expect(m.setOnSentHook).toHaveBeenCalledWith(recordAiMessageSent)
    expect(getRegisteredWorkers().filter((worker) => worker.queue === QUEUES.AI_TURN)).toHaveLength(1)
  })
})
