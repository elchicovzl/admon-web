import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  conversationFindUnique: vi.fn(),
  conversationUpdateMany: vi.fn(),
  messageFindMany: vi.fn(),
  messageCount: vi.fn(),
  usageCount: vi.fn(),
  settingsFindUnique: vi.fn(),
  usageAggregate: vi.fn(),
  globalAi: vi.fn(),
  getAiConfig: vi.fn(),
  generateText: vi.fn(),
  retrieve: vi.fn(),
  commitReply: vi.fn(),
  commitEscalation: vi.fn(),
  recordUsage: vi.fn(),
  setOutcome: vi.fn(),
  getObjectBytes: vi.fn(),
}))
vi.mock("@/lib/db/prisma", () => ({
  default: {
    conversation: { findUnique: m.conversationFindUnique, updateMany: m.conversationUpdateMany },
    whatsAppMessage: { findMany: m.messageFindMany, count: m.messageCount },
    aiUsageRecord: { count: m.usageCount, aggregate: m.usageAggregate },
    whatsAppSettings: { findUnique: m.settingsFindUnique },
  },
}))
vi.mock("@/lib/whatsapp/transitions", () => ({ isAiGloballyEnabled: m.globalAi }))
vi.mock("@/lib/config/runtime-config", () => ({ getAiConfig: m.getAiConfig }))
vi.mock("ai", async (importOriginal) => ({ ...(await importOriginal<typeof import("ai")>()), generateText: m.generateText }))
vi.mock("@/lib/ai/providers", () => ({ chatModel: () => "chat-model" }))
vi.mock("@/lib/knowledge/retrieve", () => ({ retrieveKnowledge: m.retrieve }))
vi.mock("../commit", () => ({ commitAiReply: m.commitReply, commitAiEscalation: m.commitEscalation }))
vi.mock("../usage", () => ({ recordChatTurnUsage: m.recordUsage, setUsageOutcome: m.setOutcome }))
vi.mock("@/lib/storage/r2", () => ({ getObjectBytes: m.getObjectBytes }))

import { FALLBACK_TEXT } from "../guard"
import { AI_FAILURE_HOLDING_TEXT, HANDOFF_IN_HOURS_TEXT, TRANSCRIPTION_FAILED_TEXT, UNSUPPORTED_MEDIA_TEXT } from "../texts"
import { runAiTurn } from "../turn"

// Friday 2026-10-23 10:00 in Bogota (15:00Z): business hours.
const NOW = new Date("2026-10-23T15:00:00Z")
const ago = (seconds: number) => new Date(NOW.getTime() - seconds * 1000)
const SATURDAY = new Date("2026-10-24T15:00:00Z")

const CONFIG = {
  enabled: true,
  chatModel: "claude-sonnet-5-5",
  debounceSeconds: 8,
  debounceMaxSeconds: 30,
  maxSteps: 4,
  maxTurnsPerDay: 30,
  maxConsecutiveFailures: 2,
  maxReplyAgeMinutes: 15,
  forbiddenTopics: ["demanda laboral"],
}

function conversation(overrides: Record<string, unknown> = {}) {
  return {
    id: "conv-1",
    status: "AI",
    stateVersion: 7,
    aiPaused: false,
    aiCursorAt: null,
    consecutiveAiFailures: 0,
    contact: { profileName: "Ana", client: null, lead: { status: "NEW" } },
    ...overrides,
  }
}

function inbound(overrides: Record<string, unknown> = {}) {
  return {
    id: "in-1",
    direction: "IN",
    source: "CLIENT",
    type: "TEXT",
    text: "¿Qué necesito para afiliar a un empleado?",
    timestamp: ago(20),
    createdAt: ago(19),
    media: null,
    ...overrides,
  }
}

/** The model calls searchKnowledge, then ends with the given terminal tool call. */
function modelEndsWith(toolName: "sendReply" | "escalateToHuman", input: Record<string, unknown>) {
  m.generateText.mockImplementation(async (options: { tools: Record<string, { execute?: (i: unknown, o: unknown) => Promise<unknown> }> }) => {
    await options.tools.searchKnowledge.execute!({ query: "requisitos" }, { toolCallId: "t1", messages: [] })
    return {
      steps: [
        { toolCalls: [{ toolName: "searchKnowledge", input: { query: "requisitos" } }] },
        { toolCalls: [{ toolName, input }] },
      ],
      totalUsage: { inputTokens: 5000, outputTokens: 300 },
    }
  })
}

const RETRIEVED = {
  status: "OK",
  topSimilarity: 0.82,
  chunks: [{ id: "chunk-1", documentId: "d1", documentTitle: "Guía", heading: null, content: "Se necesita la cédula.", ordinal: 0, similarity: 0.82, rrfScore: 0.03 }],
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
  m.getAiConfig.mockReturnValue(CONFIG)
  m.globalAi.mockResolvedValue(true)
  m.conversationFindUnique.mockResolvedValue(conversation())
  m.conversationUpdateMany.mockResolvedValue({ count: 1 })
  // First call: pending inbound; second call: earlier history.
  m.messageFindMany.mockResolvedValueOnce([inbound()]).mockResolvedValue([])
  m.messageCount.mockResolvedValue(0)
  m.usageCount.mockResolvedValue(0)
  m.settingsFindUnique.mockResolvedValue(null)
  m.usageAggregate.mockResolvedValue({ _sum: { estimatedCostUsd: null } })
  m.retrieve.mockResolvedValue(RETRIEVED)
  m.recordUsage.mockResolvedValue("usage-1")
  m.commitReply.mockResolvedValue({ status: "QUEUED", messageId: "out-1" })
  m.commitEscalation.mockResolvedValue({ status: "ESCALATED", messageId: "out-1" })
  modelEndsWith("sendReply", { type: "ANSWER", text: "Necesita la cédula.", sourceIds: ["chunk-1"] })
})

describe("kill switches (AI-1, AI-12, S-AI-9)", () => {
  it("skips without a model call when AI is off globally, paused, or the conversation left AI", async () => {
    m.globalAi.mockResolvedValue(false)
    expect(await runAiTurn({ conversationId: "conv-1" }, { now: () => NOW })).toEqual({ status: "SKIPPED", reason: "AI_OFF" })

    m.globalAi.mockResolvedValue(true)
    m.conversationFindUnique.mockResolvedValue(conversation({ aiPaused: true }))
    expect(await runAiTurn({ conversationId: "conv-1" }, { now: () => NOW })).toEqual({ status: "SKIPPED", reason: "NOT_AI" })

    m.conversationFindUnique.mockResolvedValue(conversation({ status: "HUMAN" }))
    expect(await runAiTurn({ conversationId: "conv-1" }, { now: () => NOW })).toEqual({ status: "SKIPPED", reason: "NOT_AI" })

    expect(m.generateText).not.toHaveBeenCalled()
    expect(m.commitReply).not.toHaveBeenCalled()
  })
})

describe("cursor, staleness and debounce (S-AI-13, AI-7)", () => {
  it("does not answer twice: nothing pending after aiCursorAt means no turn", async () => {
    m.conversationFindUnique.mockResolvedValue(conversation({ aiCursorAt: ago(20) }))
    m.messageFindMany.mockReset().mockResolvedValue([])

    expect(await runAiTurn({ conversationId: "conv-1" }, { now: () => NOW })).toEqual({ status: "SKIPPED", reason: "NOTHING_PENDING" })
    // The cursor is server time (createdAt, ms precision), not WhatsApp's second-resolution timestamp.
    expect(m.messageFindMany.mock.calls[0][0].where).toMatchObject({ createdAt: { gt: ago(20) } })
  })

  it("reads the newest 50 pending messages, so a long backlog never hides the latest one", async () => {
    await runAiTurn({ conversationId: "conv-1" }, { now: () => NOW })

    expect(m.messageFindMany.mock.calls[0][0]).toMatchObject({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50 })
  })

  it("skips a stale batch (older than AI_MAX_REPLY_AGE_MINUTES) and moves the cursor past it", async () => {
    m.messageFindMany.mockReset().mockResolvedValueOnce([inbound({ timestamp: ago(16 * 60), createdAt: ago(16 * 60 - 1) })]).mockResolvedValue([])

    expect(await runAiTurn({ conversationId: "conv-1" }, { now: () => NOW })).toEqual({ status: "SKIPPED", reason: "STALE" })
    expect(m.conversationUpdateMany).toHaveBeenCalledWith({
      where: { id: "conv-1", OR: [{ aiCursorAt: null }, { aiCursorAt: { lt: ago(16 * 60 - 1) } }] },
      data: { aiCursorAt: ago(16 * 60 - 1) },
    })
    expect(m.generateText).not.toHaveBeenCalled()
  })

  it("waits while the client is still typing", async () => {
    m.messageFindMany.mockReset().mockResolvedValueOnce([inbound({ timestamp: ago(3) })]).mockResolvedValue([])

    expect(await runAiTurn({ conversationId: "conv-1" }, { now: () => NOW })).toEqual({ status: "WAIT", delaySeconds: 5 })
    expect(m.generateText).not.toHaveBeenCalled()
  })
})

describe("answer (AI-16, AI-13)", () => {
  it("answers through the guard and commits the reply with its sources and usage record", async () => {
    const r = await runAiTurn({ conversationId: "conv-1" }, { now: () => NOW })

    expect(r).toEqual({ status: "REPLIED" })
    const call = m.generateText.mock.calls[0][0]
    // Thinking is always on in the chat model and counts against this budget: 600 cut the
    // sendReply call of a list answer in half, so the turn ended without a reply.
    expect(call).toMatchObject({ model: "chat-model", toolChoice: "auto", maxOutputTokens: 4000, maxRetries: 2 })
    expect(call).not.toHaveProperty("temperature")
    expect(call.providerOptions).toEqual({ anthropic: { effort: "medium" } })
    expect(call.system).toContain("Asistente de Administración Segura")
    expect(call.system).toContain("«Ana»")
    expect(call.messages.at(-1)).toEqual({ role: "user", content: [{ type: "text", text: "¿Qué necesito para afiliar a un empleado?" }] })
    expect(m.commitReply).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshot: { conversationId: "conv-1", stateVersion: 7, newestPendingAt: ago(19) },
        text: "Necesita la cédula.",
        sourceChunkIds: ["chunk-1"],
        usageRecordId: "usage-1",
        consecutiveFailures: 0,
        ignoreNewerInbound: false,
        globalAi: true,
      })
    )
    expect(m.recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: "conv-1",
        model: "claude-sonnet-5-5",
        steps: 2,
        inputTokens: 5000,
        outputTokens: 300,
        toolCalls: [{ name: "searchKnowledge" }, { name: "sendReply" }],
        retrievalScores: [{ id: "chunk-1", similarity: 0.82, rrfScore: 0.03 }],
        retrievedChunkIds: ["chunk-1"],
        topSimilarity: 0.82,
      })
    )
    expect(m.setOutcome).toHaveBeenCalledWith("usage-1", "REPLIED")
  })

  it("sends the fallback for an ungrounded answer and counts the failure (S-AI-3)", async () => {
    modelEndsWith("sendReply", { type: "ANSWER", text: "Cuesta 50.000.", sourceIds: [] })

    await runAiTurn({ conversationId: "conv-1" }, { now: () => NOW })

    expect(m.commitReply).toHaveBeenCalledWith(expect.objectContaining({ text: FALLBACK_TEXT, sourceChunkIds: [], consecutiveFailures: 1 }))
  })

  it("escalates with REPEATED_FAILURE when the fallback reaches the failure cap", async () => {
    m.conversationFindUnique.mockResolvedValue(conversation({ consecutiveAiFailures: 1 }))
    modelEndsWith("sendReply", { type: "ANSWER", text: "x", sourceIds: [] })

    expect(await runAiTurn({ conversationId: "conv-1" }, { now: () => NOW })).toEqual({ status: "ESCALATED" })
    expect(m.commitEscalation).toHaveBeenCalledWith(expect.objectContaining({ reason: "REPEATED_FAILURE", text: HANDOFF_IN_HOURS_TEXT }))
  })
})

describe("race and newer messages (CH-5, S-CH-2, S-AI-8)", () => {
  it("reports a discarded reply (a person took over) and keeps its usage", async () => {
    m.commitReply.mockResolvedValue({ status: "DISCARDED", reason: "NOT_AI" })

    expect(await runAiTurn({ conversationId: "conv-1" }, { now: () => NOW })).toEqual({ status: "DISCARDED", reason: "NOT_AI" })
    expect(m.recordUsage).toHaveBeenCalled()
    expect(m.setOutcome).toHaveBeenCalledWith("usage-1", "DISCARDED", "NOT_AI")
  })

  it("counts earlier discards for this batch in the database (the stately queue keeps only one queued job)", async () => {
    m.usageCount.mockResolvedValue(2)

    await runAiTurn({ conversationId: "conv-1" }, { now: () => NOW })

    expect(m.usageCount).toHaveBeenCalledWith({
      where: { conversationId: "conv-1", kind: "CHAT_TURN", outcome: "DISCARDED", error: "NEWER_INBOUND", createdAt: { gte: ago(19) } },
    })
    expect(m.commitReply).toHaveBeenCalledWith(expect.objectContaining({ ignoreNewerInbound: true }))
  })

  it("keeps checking for newer messages before the second discard", async () => {
    m.usageCount.mockResolvedValue(1)

    await runAiTurn({ conversationId: "conv-1" }, { now: () => NOW })

    expect(m.commitReply).toHaveBeenCalledWith(expect.objectContaining({ ignoreNewerInbound: false }))
  })
})

describe("handoff (AI-9, S-AI-4/5)", () => {
  it("escalates a request for a person without calling the model, in business hours", async () => {
    m.messageFindMany.mockReset().mockResolvedValueOnce([inbound({ text: "Quiero hablar con un asesor" })]).mockResolvedValue([])

    expect(await runAiTurn({ conversationId: "conv-1" }, { now: () => NOW })).toEqual({ status: "ESCALATED" })
    expect(m.generateText).not.toHaveBeenCalled()
    expect(m.commitEscalation).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "USER_REQUEST", outOfHours: false, attentionDueAt: NOW, text: HANDOFF_IN_HOURS_TEXT })
    )
  })

  it("on Saturday escalates out of hours with the next business slot and the out-of-hours text", async () => {
    m.messageFindMany.mockReset().mockResolvedValueOnce([inbound({ text: "un asesor por favor", timestamp: new Date(SATURDAY.getTime() - 20_000) })]).mockResolvedValue([])

    await runAiTurn({ conversationId: "conv-1" }, { now: () => SATURDAY })

    const call = m.commitEscalation.mock.calls[0][0]
    expect(call).toMatchObject({ reason: "USER_REQUEST", outOfHours: true, attentionDueAt: new Date("2026-10-26T13:00:00Z") })
    expect(call.text).toContain("lunes 26 de octubre a las 8:00")
  })

  it("escalates a forbidden topic", async () => {
    m.messageFindMany.mockReset().mockResolvedValueOnce([inbound({ text: "Es por una demanda laboral" })]).mockResolvedValue([])

    await runAiTurn({ conversationId: "conv-1" }, { now: () => NOW })

    expect(m.commitEscalation).toHaveBeenCalledWith(expect.objectContaining({ reason: "FORBIDDEN_TOPIC" }))
  })

  it("escalates when the model calls escalateToHuman", async () => {
    modelEndsWith("escalateToHuman", { reason: "COMPLAINT", summary: "Queja" })

    expect(await runAiTurn({ conversationId: "conv-1" }, { now: () => NOW })).toEqual({ status: "ESCALATED" })
    expect(m.commitEscalation).toHaveBeenCalledWith(expect.objectContaining({ reason: "COMPLAINT", usageRecordId: "usage-1" }))
  })

  it("escalates once the daily turn limit is reached", async () => {
    m.messageCount.mockResolvedValue(30)

    await runAiTurn({ conversationId: "conv-1" }, { now: () => NOW })

    expect(m.messageCount).toHaveBeenCalledWith({
      where: {
        conversationId: "conv-1",
        direction: "OUT",
        source: "AI",
        status: { not: "FAILED" },
        createdAt: { gte: new Date(NOW.getTime() - 24 * 3600 * 1000) },
      },
    })
    expect(m.commitEscalation).toHaveBeenCalledWith(expect.objectContaining({ reason: "TURN_LIMIT" }))
    expect(m.generateText).not.toHaveBeenCalled()
  })
})

describe("limits saved in Configuración → WhatsApp (S3, S4)", () => {
  const saved = (overrides: Record<string, unknown>) =>
    m.settingsFindUnique.mockResolvedValue({
      dailyBudgetUsd: null,
      maxTurnsPerDay: null,
      maxConsecutiveFailures: null,
      forbiddenTopics: [],
      ...overrides,
    })

  it("uses the saved replies-per-day limit over the env", async () => {
    saved({ maxTurnsPerDay: 5 })
    m.messageCount.mockResolvedValue(5)

    await runAiTurn({ conversationId: "conv-1" }, { now: () => NOW })

    expect(m.commitEscalation).toHaveBeenCalledWith(expect.objectContaining({ reason: "TURN_LIMIT" }))
    expect(m.generateText).not.toHaveBeenCalled()
  })

  it("escalates a saved forbidden topic without calling the model, and keeps the env ones", async () => {
    saved({ forbiddenTopics: ["criptomonedas"] })
    m.messageFindMany.mockReset().mockResolvedValueOnce([inbound({ text: "¿Reciben criptomonedas?" })]).mockResolvedValue([])

    await runAiTurn({ conversationId: "conv-1" }, { now: () => NOW })

    expect(m.commitEscalation).toHaveBeenCalledWith(expect.objectContaining({ reason: "FORBIDDEN_TOPIC" }))
    expect(m.generateText).not.toHaveBeenCalled()
  })

  it("uses the saved failure cap: one failure below it still replies with the fallback", async () => {
    saved({ maxConsecutiveFailures: 3 })
    m.conversationFindUnique.mockResolvedValue(conversation({ consecutiveAiFailures: 1 }))
    modelEndsWith("sendReply", { type: "ANSWER", text: "x", sourceIds: [] })

    await runAiTurn({ conversationId: "conv-1" }, { now: () => NOW })

    expect(m.commitEscalation).not.toHaveBeenCalled()
    expect(m.commitReply).toHaveBeenCalledWith(expect.objectContaining({ text: FALLBACK_TEXT, consecutiveFailures: 2 }))
  })

  it("escalates with BUDGET_LIMIT and no model call once the daily spend reaches the cap", async () => {
    saved({ dailyBudgetUsd: "5.00" })
    m.usageAggregate.mockResolvedValue({ _sum: { estimatedCostUsd: "5.000000" } })

    expect(await runAiTurn({ conversationId: "conv-1" }, { now: () => NOW })).toEqual({ status: "ESCALATED" })
    expect(m.commitEscalation).toHaveBeenCalledWith(expect.objectContaining({ reason: "BUDGET_LIMIT", usageRecordId: null }))
    expect(m.generateText).not.toHaveBeenCalled()
  })

  it("answers normally while the daily spend is under the cap", async () => {
    saved({ dailyBudgetUsd: "5.00" })
    m.usageAggregate.mockResolvedValue({ _sum: { estimatedCostUsd: "4.990000" } })

    expect(await runAiTurn({ conversationId: "conv-1" }, { now: () => NOW })).toEqual({ status: "REPLIED" })
    expect(m.generateText).toHaveBeenCalled()
  })
})

describe("invalid tool calls (AI SDK marks them invalid)", () => {
  function modelReturns(calls: Record<string, unknown>[]) {
    m.generateText.mockResolvedValue({ steps: [{ toolCalls: calls }], totalUsage: { inputTokens: 10, outputTokens: 5 } })
  }

  it("ignores a call the SDK marked invalid and sends the fallback instead of crashing", async () => {
    modelReturns([{ toolName: "sendReply", input: { type: "ANSWER", text: "x" }, invalid: true }])

    expect(await runAiTurn({ conversationId: "conv-1" }, { now: () => NOW })).toEqual({ status: "REPLIED" })
    expect(m.commitReply).toHaveBeenCalledWith(expect.objectContaining({ text: FALLBACK_TEXT, consecutiveFailures: 1 }))
  })

  it("never lets the model pick a reason reserved for the code (AI_FAILURE, TURN_LIMIT...)", async () => {
    modelReturns([{ toolName: "escalateToHuman", input: { reason: "AI_FAILURE", summary: "x" } }])

    await runAiTurn({ conversationId: "conv-1" }, { now: () => NOW })

    expect(m.commitEscalation).toHaveBeenCalledWith(expect.objectContaining({ reason: "LOW_CONFIDENCE" }))
  })
})

describe("provider failure (AI-14, S-AI-11)", () => {
  it("records the failure, escalates with AI_FAILURE and one neutral holding message, and does not throw", async () => {
    m.generateText.mockRejectedValue(new Error("overloaded"))

    expect(await runAiTurn({ conversationId: "conv-1" }, { now: () => NOW })).toEqual({ status: "FAILED" })
    expect(m.recordUsage).toHaveBeenCalledWith(expect.objectContaining({ outcome: "FAILED", error: "PROVIDER_ERROR" }))
    expect(m.commitEscalation).toHaveBeenCalledTimes(1)
    expect(m.commitEscalation).toHaveBeenCalledWith(expect.objectContaining({ reason: "AI_FAILURE", text: AI_FAILURE_HOLDING_TEXT }))
  })
})

describe("media (S-MH-2/4/5, MH-5)", () => {
  const voice = (transcriptStatus: string | null, transcript: string | null = null) =>
    inbound({ type: "AUDIO", text: null, media: { status: "STORED", mimeType: "audio/ogg", sizeBytes: 1000, durationSec: 5, transcript, transcriptStatus, s3Key: "a" } })

  it("answers a sticker-only batch deterministically, without the model, counting a failure", async () => {
    m.messageFindMany.mockReset().mockResolvedValueOnce([
      inbound({ type: "STICKER", text: null, media: { status: "STORED", mimeType: "image/webp", sizeBytes: 100, durationSec: null, transcript: null, transcriptStatus: null, s3Key: "s" } }),
    ]).mockResolvedValue([])

    await runAiTurn({ conversationId: "conv-1" }, { now: () => NOW })

    expect(m.generateText).not.toHaveBeenCalled()
    expect(m.commitReply).toHaveBeenCalledWith(expect.objectContaining({ text: UNSUPPORTED_MEDIA_TEXT, consecutiveFailures: 1, usageRecordId: null }))
  })

  it("asks for a document review once unreadable attachments reach the failure cap", async () => {
    m.conversationFindUnique.mockResolvedValue(conversation({ consecutiveAiFailures: 1 }))
    m.messageFindMany.mockReset().mockResolvedValueOnce([
      inbound({ type: "VIDEO", text: null, media: { status: "STORED", mimeType: "video/mp4", sizeBytes: 100, durationSec: 3, transcript: null, transcriptStatus: null, s3Key: "v" } }),
    ]).mockResolvedValue([])

    await runAiTurn({ conversationId: "conv-1" }, { now: () => NOW })

    expect(m.commitEscalation).toHaveBeenCalledWith(expect.objectContaining({ reason: "DOCUMENT_REVIEW" }))
  })

  it("asks the client to write when the voice note could not be transcribed", async () => {
    m.messageFindMany.mockReset().mockResolvedValueOnce([voice("FAILED")]).mockResolvedValue([])

    await runAiTurn({ conversationId: "conv-1" }, { now: () => NOW })

    expect(m.commitReply).toHaveBeenCalledWith(expect.objectContaining({ text: TRANSCRIPTION_FAILED_TEXT }))
    expect(m.generateText).not.toHaveBeenCalled()
  })

  it("waits for a voice note still being transcribed", async () => {
    m.messageFindMany.mockReset().mockResolvedValueOnce([voice("PENDING")]).mockResolvedValue([])

    expect(await runAiTurn({ conversationId: "conv-1" }, { now: () => NOW })).toEqual({ status: "WAIT", delaySeconds: 8 })
  })

  it("gives the model the transcript of a voice note", async () => {
    m.messageFindMany.mockReset().mockResolvedValueOnce([voice("DONE", "quiero afiliarme")]).mockResolvedValue([])

    await runAiTurn({ conversationId: "conv-1" }, { now: () => NOW })

    expect(m.generateText.mock.calls[0][0].messages.at(-1).content).toEqual([{ type: "text", text: "[Nota de voz] quiero afiliarme" }])
  })

  it("gives the model images and PDFs within the media policy (MH-5)", async () => {
    const bytes = new Uint8Array([1, 2])
    m.getObjectBytes.mockResolvedValue(bytes)
    // Newest first, as the query returns them.
    m.messageFindMany.mockReset().mockResolvedValueOnce([
      inbound({ id: "in-2", type: "DOCUMENT", text: null, timestamp: ago(15), createdAt: ago(14), media: { status: "STORED", mimeType: "application/pdf", sizeBytes: 1000, durationSec: null, transcript: null, transcriptStatus: null, s3Key: "pdf" } }),
      inbound({ type: "IMAGE", text: "mi cédula", media: { status: "STORED", mimeType: "image/jpeg", sizeBytes: 1000, durationSec: null, transcript: null, transcriptStatus: null, s3Key: "img" } }),
    ]).mockResolvedValue([])

    await runAiTurn({ conversationId: "conv-1" }, { now: () => NOW })

    expect(m.generateText.mock.calls[0][0].messages.at(-1).content).toEqual([
      { type: "text", text: "[Imagen] mi cédula" },
      { type: "image", image: bytes, mediaType: "image/jpeg" },
      { type: "text", text: "[Documento]" },
      { type: "file", data: bytes, mediaType: "application/pdf" },
    ])
  })

  it("tells the model about a voice note it could not hear when the client also wrote", async () => {
    m.messageFindMany.mockReset().mockResolvedValueOnce([inbound({ createdAt: ago(10) }), voice("FAILED")]).mockResolvedValue([])

    await runAiTurn({ conversationId: "conv-1" }, { now: () => NOW })

    expect(m.generateText.mock.calls[0][0].messages.at(-1).content).toEqual([
      { type: "text", text: "[Nota de voz que no se pudo transcribir]" },
      { type: "text", text: "¿Qué necesito para afiliar a un empleado?" },
    ])
  })

  it("gives the model at most 4 attachments per turn", async () => {
    m.getObjectBytes.mockResolvedValue(new Uint8Array([1]))
    const images = Array.from({ length: 6 }, (_, i) =>
      inbound({ id: `img-${i}`, type: "IMAGE", text: null, createdAt: ago(30 - i), media: { status: "STORED", mimeType: "image/png", sizeBytes: 10, durationSec: null, transcript: null, transcriptStatus: null, s3Key: `k${i}` } })
    ).reverse()
    m.messageFindMany.mockReset().mockResolvedValueOnce(images).mockResolvedValue([])

    await runAiTurn({ conversationId: "conv-1" }, { now: () => NOW })

    const content = m.generateText.mock.calls[0][0].messages.at(-1).content as { type: string; text?: string }[]
    expect(content.filter((part) => part.type === "image")).toHaveLength(4)
    expect(content.filter((part) => part.text === "[Imagen no revisada: demasiados adjuntos]")).toHaveLength(2)
  })
})
