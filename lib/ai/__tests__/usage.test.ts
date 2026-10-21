import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({ create: vi.fn() }))
vi.mock("@/lib/db/prisma", () => ({ default: { aiUsageRecord: { create: m.create } } }))

import { estimateChatCostUsd, estimateTranscriptionCostUsd, recordChatTurnUsage, recordTranscriptionUsage } from "../responder/usage"

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
  m.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "usage-1", ...data }))
})

describe("cost estimates (AI-13)", () => {
  it("prices transcription per minute, rounding up partial minutes like the provider", () => {
    expect(estimateTranscriptionCostUsd("gpt-4o-mini-transcribe", 30)).toBeCloseTo(0.003)
    expect(estimateTranscriptionCostUsd("gpt-4o-mini-transcribe", 61)).toBeCloseTo(0.006)
    expect(estimateTranscriptionCostUsd("gpt-4o-transcribe", 60)).toBeCloseTo(0.006)
    expect(estimateTranscriptionCostUsd("whisper-1", 120)).toBeCloseTo(0.012)
  })

  it("prices chat turns per million input and output tokens", () => {
    expect(estimateChatCostUsd("claude-opus-5-5", 1_000_000, 0)).toBeCloseTo(4)
    expect(estimateChatCostUsd("claude-opus-5-5", 0, 1_000_000)).toBeCloseTo(20)
    expect(estimateChatCostUsd("claude-sonnet-5-5", 10_000, 1_000)).toBeCloseTo(0.03)
    expect(estimateChatCostUsd("claude-haiku-5-5", 10_000, 1_000)).toBeCloseTo(0.0015)
  })

  it("returns null for an unknown model or duration instead of guessing", () => {
    expect(estimateTranscriptionCostUsd("some-new-stt", 60)).toBeNull()
    expect(estimateTranscriptionCostUsd("gpt-4o-mini-transcribe", null)).toBeNull()
    expect(estimateChatCostUsd("unknown-model", 10, 10)).toBeNull()
  })
})

describe("recordTranscriptionUsage", () => {
  it("stores a TRANSCRIPTION record with audio seconds, latency and the estimated cost, no content", async () => {
    const id = await recordTranscriptionUsage({
      conversationId: "conv-1",
      messageId: "msg-1",
      model: "gpt-4o-mini-transcribe",
      audioSeconds: 42.5,
      latencyMs: 1200,
    })

    expect(id).toBe("usage-1")
    expect(m.create).toHaveBeenCalledWith({
      data: {
        kind: "TRANSCRIPTION",
        conversationId: "conv-1",
        messageId: "msg-1",
        model: "gpt-4o-mini-transcribe",
        audioSeconds: 42.5,
        latencyMs: 1200,
        estimatedCostUsd: 0.003,
        error: null,
      },
      select: { id: true },
    })
  })

  it("records a failed call with its short error code", async () => {
    await recordTranscriptionUsage({ conversationId: "conv-1", messageId: "msg-1", model: "gpt-4o-mini-transcribe", audioSeconds: null, latencyMs: 900, error: "PROVIDER_ERROR" })

    expect(m.create.mock.calls[0][0].data).toMatchObject({ audioSeconds: null, estimatedCostUsd: null, error: "PROVIDER_ERROR" })
  })

  it("never throws: a usage write failure must not fail the transcription", async () => {
    m.create.mockRejectedValue(new Error("db down"))

    await expect(
      recordTranscriptionUsage({ conversationId: null, messageId: "msg-1", model: "gpt-4o-mini-transcribe", audioSeconds: 10, latencyMs: 10 })
    ).resolves.toBeNull()
  })
})

describe("recordChatTurnUsage (AI-13)", () => {
  it("stores a CHAT_TURN record with model, prompt version, tokens, tool calls and retrieval scores, no content", async () => {
    const id = await recordChatTurnUsage({
      conversationId: "conv-1",
      outcome: "REPLIED",
      model: "claude-sonnet-5-5",
      promptVersion: "2026-10-20.2",
      steps: 2,
      inputTokens: 10_000,
      outputTokens: 1_000,
      toolCalls: [{ name: "searchKnowledge" }, { name: "sendReply" }],
      retrievalScores: [{ id: "chunk-1", similarity: 0.8, rrfScore: 0.03 }],
      retrievedChunkIds: ["chunk-1"],
      topSimilarity: 0.8,
      latencyMs: 2500,
    })

    expect(id).toBe("usage-1")
    expect(m.create).toHaveBeenCalledWith({
      data: {
        kind: "CHAT_TURN",
        conversationId: "conv-1",
        messageId: null,
        outcome: "REPLIED",
        model: "claude-sonnet-5-5",
        promptVersion: "2026-10-20.2",
        steps: 2,
        inputTokens: 10_000,
        outputTokens: 1_000,
        toolCalls: [{ name: "searchKnowledge" }, { name: "sendReply" }],
        retrievalScores: [{ id: "chunk-1", similarity: 0.8, rrfScore: 0.03 }],
        retrievedChunkIds: ["chunk-1"],
        topSimilarity: 0.8,
        latencyMs: 2500,
        estimatedCostUsd: 0.03,
        error: null,
      },
      select: { id: true },
    })
  })

  it("never throws", async () => {
    m.create.mockRejectedValue(new Error("db down"))

    await expect(
      recordChatTurnUsage({ conversationId: "c", outcome: "FAILED", model: "m", promptVersion: "v", steps: 0, inputTokens: 0, outputTokens: 0, toolCalls: [], retrievalScores: [], retrievedChunkIds: [], topSimilarity: null, latencyMs: 1, error: "PROVIDER_ERROR" })
    ).resolves.toBeNull()
  })
})
