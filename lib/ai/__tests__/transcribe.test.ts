import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  mediaFindUnique: vi.fn(),
  mediaUpdateMany: vi.fn(),
  mediaUpdate: vi.fn(),
  messageUpdate: vi.fn(),
  getObjectBytes: vi.fn(),
  transcribe: vi.fn(),
  getAiConfig: vi.fn(),
  recordUsage: vi.fn(),
  getAiLimits: vi.fn(),
  repliesLast24h: vi.fn(),
  overBudget: vi.fn(),
}))
vi.mock("@/lib/db/prisma", () => ({
  default: {
    whatsAppMedia: { findUnique: m.mediaFindUnique, updateMany: m.mediaUpdateMany, update: m.mediaUpdate },
    whatsAppMessage: { update: m.messageUpdate },
  },
}))
vi.mock("@/lib/storage/r2", async () => {
  const actual = await vi.importActual<typeof import("@/lib/storage/r2")>("@/lib/storage/r2")
  return { getObjectBytes: m.getObjectBytes, StoredObjectError: actual.StoredObjectError }
})
vi.mock("ai", () => ({ transcribe: m.transcribe }))
vi.mock("@/lib/config/runtime-config", () => ({ getAiConfig: m.getAiConfig }))
vi.mock("@/lib/ai/providers", () => ({ transcriptionModel: () => "stt-model" }))
vi.mock("../responder/usage", () => ({ recordTranscriptionUsage: m.recordUsage }))
vi.mock("@/lib/ai/limits", () => ({ getAiLimits: m.getAiLimits, aiRepliesLast24h: m.repliesLast24h, isOverDailyBudget: m.overBudget }))

import { StoredObjectError } from "@/lib/storage/r2"
import { transcribeAudioMessage } from "../transcribe"

const MEDIA = {
  id: "media-1",
  status: "STORED",
  s3Key: "whatsapp/conv-1/msg-1/a.ogg",
  mimeType: "audio/ogg",
  sizeBytes: 120_000,
  durationSec: null,
  transcriptStatus: null,
  message: { id: "msg-1", conversationId: "conv-1", type: "AUDIO", conversation: { status: "AI" } },
}
const AUDIO = new Uint8Array([1, 2, 3])
const first = { isLastAttempt: false, isRetry: false }
const last = { isLastAttempt: true, isRetry: true }

function mediaWrites(): unknown[] {
  return m.mediaUpdate.mock.calls.map((call) => call[0].data)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
  m.getAiConfig.mockReturnValue({ enabled: true, sttModel: "gpt-4o-mini-transcribe", sttMaxSeconds: 600 })
  m.mediaFindUnique.mockResolvedValue(MEDIA)
  m.mediaUpdateMany.mockResolvedValue({ count: 1 })
  m.mediaUpdate.mockResolvedValue({})
  m.messageUpdate.mockResolvedValue({})
  m.getObjectBytes.mockResolvedValue(AUDIO)
  m.transcribe.mockResolvedValue({ text: " Hola, necesito afiliarme. ", durationInSeconds: 42, segments: [] })
  m.recordUsage.mockResolvedValue("usage-1")
  m.getAiLimits.mockResolvedValue({ dailyBudgetUsd: null, maxTurnsPerDay: 30, maxConsecutiveFailures: 2, forbiddenTopics: [] })
  m.repliesLast24h.mockResolvedValue(0)
  m.overBudget.mockResolvedValue(false)
})

describe("transcribeAudioMessage: claim (S-MH-7, MH-10)", () => {
  it("claims the media with updateMany where transcriptStatus is null, so a redelivered job never transcribes twice", async () => {
    await transcribeAudioMessage("msg-1", first)

    expect(m.mediaUpdateMany).toHaveBeenCalledWith({
      where: { id: "media-1", OR: [{ transcriptStatus: null }] },
      data: { transcriptStatus: "PENDING" },
    })
  })

  it("skips without calling the provider when another job already claimed it", async () => {
    m.mediaUpdateMany.mockResolvedValue({ count: 0 })

    expect(await transcribeAudioMessage("msg-1", first)).toEqual({ status: "SKIPPED" })
    expect(m.transcribe).not.toHaveBeenCalled()
  })

  it("lets its own retry continue a claim it left PENDING", async () => {
    await transcribeAudioMessage("msg-1", { isLastAttempt: false, isRetry: true })

    expect(m.mediaUpdateMany.mock.calls[0][0].where).toEqual({
      id: "media-1",
      OR: [{ transcriptStatus: null }, { transcriptStatus: "PENDING" }],
    })
  })

  it("does nothing while AI is off, for missing media and for media not stored yet", async () => {
    m.getAiConfig.mockReturnValue({ enabled: false, sttModel: "gpt-4o-mini-transcribe", sttMaxSeconds: 600 })
    expect(await transcribeAudioMessage("msg-1", first)).toEqual({ status: "SKIPPED" })

    m.getAiConfig.mockReturnValue({ enabled: true, sttModel: "gpt-4o-mini-transcribe", sttMaxSeconds: 600 })
    m.mediaFindUnique.mockResolvedValue(null)
    expect(await transcribeAudioMessage("msg-1", first)).toEqual({ status: "SKIPPED" })

    m.mediaFindUnique.mockResolvedValue({ ...MEDIA, status: "PENDING" })
    expect(await transcribeAudioMessage("msg-1", first)).toEqual({ status: "SKIPPED" })

    expect(m.mediaUpdateMany).not.toHaveBeenCalled()
    expect(m.transcribe).not.toHaveBeenCalled()
  })
})

describe("transcribeAudioMessage: success (MH-3, AI-13, S-MH-1)", () => {
  it("stores the trimmed transcript and duration, records usage and refreshes the message for the inbox", async () => {
    const r = await transcribeAudioMessage("msg-1", first)

    expect(r).toEqual({ status: "DONE" })
    expect(m.getObjectBytes).toHaveBeenCalledWith("whatsapp/conv-1/msg-1/a.ogg", 25 * 1024 * 1024)
    expect(m.transcribe).toHaveBeenCalledWith({
      model: "stt-model",
      audio: AUDIO,
      providerOptions: { openai: { language: "es" } },
      maxRetries: 2,
    })
    expect(mediaWrites()).toEqual([{ transcript: "Hola, necesito afiliarme.", transcriptStatus: "DONE", durationSec: 42 }])
    expect(m.recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: "conv-1", messageId: "msg-1", model: "gpt-4o-mini-transcribe", audioSeconds: 42 })
    )
    // Claim and result both bump the message, so pollers show «Transcribiendo…» and then the text.
    expect(m.messageUpdate).toHaveBeenCalledTimes(2)
    expect(m.messageUpdate).toHaveBeenCalledWith({ where: { id: "msg-1" }, data: { updatedAt: expect.any(Date) } })
  })

  it("falls back to the last segment's end when the provider reports no duration", async () => {
    m.transcribe.mockResolvedValue({ text: "hola", durationInSeconds: undefined, segments: [{ text: "hola", startSecond: 0, endSecond: 3.5 }] })

    await transcribeAudioMessage("msg-1", first)

    expect(mediaWrites()[0]).toMatchObject({ durationSec: 3.5 })
  })
})

describe("transcribeAudioMessage: failures (MH-4, S-MH-2)", () => {
  it("fails at once, without the provider, audio that the media policy rejects (over 10 minutes)", async () => {
    m.mediaFindUnique.mockResolvedValue({ ...MEDIA, durationSec: 900 })

    expect(await transcribeAudioMessage("msg-1", first)).toEqual({ status: "FAILED" })
    expect(m.transcribe).not.toHaveBeenCalled()
    expect(mediaWrites()).toEqual([{ transcriptStatus: "FAILED" }])
  })

  it("fails audio the provider measured longer than AI_STT_MAX_SECONDS and does not keep the text", async () => {
    m.transcribe.mockResolvedValue({ text: "muy largo", durationInSeconds: 700, segments: [] })

    expect(await transcribeAudioMessage("msg-1", first)).toEqual({ status: "FAILED" })
    expect(mediaWrites()).toEqual([{ transcriptStatus: "FAILED", durationSec: 700 }])
    expect(m.recordUsage).toHaveBeenCalledWith(expect.objectContaining({ audioSeconds: 700 }))
  })

  it("retries a provider error, then marks FAILED on the last attempt and records the failed call", async () => {
    m.transcribe.mockRejectedValue(new Error("503"))

    await expect(transcribeAudioMessage("msg-1", first)).rejects.toThrow("503")
    expect(mediaWrites()).toEqual([])

    expect(await transcribeAudioMessage("msg-1", last)).toEqual({ status: "FAILED" })
    expect(mediaWrites()).toEqual([{ transcriptStatus: "FAILED" }])
    expect(m.recordUsage).toHaveBeenLastCalledWith(expect.objectContaining({ error: "PROVIDER_ERROR", audioSeconds: null }))
  })

  it("treats an empty transcript like a provider failure (retried, then FAILED)", async () => {
    m.transcribe.mockResolvedValue({ text: "   ", durationInSeconds: 4, segments: [] })

    await expect(transcribeAudioMessage("msg-1", first)).rejects.toThrow("empty")
    expect(await transcribeAudioMessage("msg-1", last)).toEqual({ status: "FAILED" })
  })

  it("fails at once when the stored file is missing or too large (no retry can help)", async () => {
    m.getObjectBytes.mockRejectedValue(new StoredObjectError("MISSING", "gone"))

    expect(await transcribeAudioMessage("msg-1", first)).toEqual({ status: "FAILED" })
    expect(m.transcribe).not.toHaveBeenCalled()
  })

  it("refreshes the message on failure too, so the inbox shows «Transcripción fallida»", async () => {
    m.mediaFindUnique.mockResolvedValue({ ...MEDIA, durationSec: 900 })

    await transcribeAudioMessage("msg-1", first)

    expect(m.messageUpdate).toHaveBeenLastCalledWith({ where: { id: "msg-1" }, data: { updatedAt: expect.any(Date) } })
  })
})

describe("transcribeAudioMessage: cost and abuse limits (S5)", () => {
  const withStatus = (status: string) => ({ ...MEDIA, message: { ...MEDIA.message, conversation: { status } } })

  it("skips an escalated conversation without claiming the media or calling the provider", async () => {
    m.mediaFindUnique.mockResolvedValue(withStatus("ESCALATED"))

    expect(await transcribeAudioMessage("msg-1", first)).toEqual({ status: "SKIPPED" })
    expect(m.mediaUpdateMany).not.toHaveBeenCalled()
    expect(m.transcribe).not.toHaveBeenCalled()
  })

  it("still transcribes a conversation a person is attending (advisors read the transcript)", async () => {
    m.mediaFindUnique.mockResolvedValue(withStatus("HUMAN"))

    expect(await transcribeAudioMessage("msg-1", first)).toEqual({ status: "DONE" })
    expect(m.transcribe).toHaveBeenCalled()
  })

  it.each([
    ["its AI replies per day", () => m.repliesLast24h.mockResolvedValue(30)],
    ["the daily spend cap", () => m.overBudget.mockResolvedValue(true)],
  ])("keeps transcribing for an advisor even past %s (an escalated chat reaches HUMAN with its counters full)", async (_label, reach) => {
    m.mediaFindUnique.mockResolvedValue(withStatus("HUMAN"))
    reach()

    expect(await transcribeAudioMessage("msg-1", first)).toEqual({ status: "DONE" })
    expect(m.transcribe).toHaveBeenCalled()
  })

  it("skips once the conversation reached its AI replies per day", async () => {
    m.repliesLast24h.mockResolvedValue(30)

    expect(await transcribeAudioMessage("msg-1", first)).toEqual({ status: "SKIPPED" })
    expect(m.repliesLast24h).toHaveBeenCalledWith("conv-1", expect.any(Date))
    expect(m.transcribe).not.toHaveBeenCalled()
  })

  it("skips once the daily spend cap is reached", async () => {
    m.overBudget.mockResolvedValue(true)

    expect(await transcribeAudioMessage("msg-1", first)).toEqual({ status: "SKIPPED" })
    expect(m.mediaUpdateMany).not.toHaveBeenCalled()
    expect(m.transcribe).not.toHaveBeenCalled()
  })
})
