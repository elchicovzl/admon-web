import { beforeEach, describe, expect, it, vi } from "vitest"
import type { AiConfig } from "@/lib/config/runtime-config"

const m = vi.hoisted(() => {
  const anthropicModel = vi.fn((id: string) => ({ provider: "anthropic", id }))
  const openaiEmbedding = vi.fn((id: string) => ({ provider: "openai.embedding", id }))
  const openaiTranscription = vi.fn((id: string) => ({ provider: "openai.transcription", id }))
  return {
    anthropicModel,
    openaiEmbedding,
    openaiTranscription,
    createAnthropic: vi.fn(() => anthropicModel),
    createOpenAI: vi.fn(() => ({ embedding: openaiEmbedding, transcription: openaiTranscription })),
    getAiConfig: vi.fn(),
  }
})
vi.mock("@ai-sdk/anthropic", () => ({ createAnthropic: m.createAnthropic }))
vi.mock("@ai-sdk/openai", () => ({ createOpenAI: m.createOpenAI }))
vi.mock("@/lib/config/runtime-config", () => ({ getAiConfig: m.getAiConfig }))

function config(overrides: Partial<AiConfig> = {}): AiConfig {
  return {
    enabled: true,
    draftsEnabled: false,
    anthropicApiKey: "sk-ant-test",
    openaiApiKey: "sk-openai-test",
    chatModel: "claude-opus-5-5",
    embeddingModel: "text-embedding-3-small",
    embeddingDimensions: 1536,
    sttModel: "gpt-4o-mini-transcribe",
    sttMaxSeconds: 600,
    minSimilarity: 0.35,
    debounceSeconds: 8,
    debounceMaxSeconds: 30,
    maxSteps: 4,
    maxTurnsPerDay: 30,
    maxConsecutiveFailures: 2,
    maxReplyAgeMinutes: 15,
    forbiddenTopics: [],
    kbUploadMaxBytes: 15728640,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  m.getAiConfig.mockReturnValue(config())
})

describe("AI providers (A11, D20)", () => {
  it("reads no configuration and creates no client when the module is imported", async () => {
    vi.resetModules()
    await import("../providers")

    expect(m.getAiConfig).not.toHaveBeenCalled()
    expect(m.createAnthropic).not.toHaveBeenCalled()
    expect(m.createOpenAI).not.toHaveBeenCalled()
  })

  it("chatModel uses Anthropic with the configured key and AI_CHAT_MODEL", async () => {
    const { chatModel } = await import("../providers")

    const model = chatModel()

    expect(m.createAnthropic).toHaveBeenCalledWith({ apiKey: "sk-ant-test" })
    expect(m.anthropicModel).toHaveBeenCalledWith("claude-opus-5-5")
    expect(model).toEqual({ provider: "anthropic", id: "claude-opus-5-5" })
  })

  it("embeddingModel and transcriptionModel use OpenAI with their configured models", async () => {
    const { embeddingModel, transcriptionModel } = await import("../providers")

    expect(embeddingModel()).toEqual({ provider: "openai.embedding", id: "text-embedding-3-small" })
    expect(transcriptionModel()).toEqual({ provider: "openai.transcription", id: "gpt-4o-mini-transcribe" })
    expect(m.createOpenAI).toHaveBeenCalledWith({ apiKey: "sk-openai-test" })
  })

  it("asks OpenAI for the configured embedding dimensions", async () => {
    const { embeddingProviderOptions } = await import("../providers")

    expect(embeddingProviderOptions()).toEqual({ openai: { dimensions: 1536 } })
  })

  it("fails with a clear error naming the missing variable, never a value", async () => {
    const { chatModel, embeddingModel, transcriptionModel } = await import("../providers")

    m.getAiConfig.mockReturnValue(config({ anthropicApiKey: undefined }))
    expect(() => chatModel()).toThrow("ANTHROPIC_API_KEY")

    m.getAiConfig.mockReturnValue(config({ chatModel: undefined }))
    expect(() => chatModel()).toThrow("AI_CHAT_MODEL")

    m.getAiConfig.mockReturnValue(config({ openaiApiKey: undefined }))
    expect(() => embeddingModel()).toThrow("OPENAI_API_KEY")
    expect(() => transcriptionModel()).toThrow("OPENAI_API_KEY")

    m.getAiConfig.mockReturnValue(config({ anthropicApiKey: undefined }))
    try {
      chatModel()
    } catch (error) {
      expect(String(error)).not.toContain("sk-openai-test")
    }
  })

  it("refuses embedding dimensions the vector column cannot store (KB-6)", async () => {
    const { embeddingModel, EMBEDDING_COLUMN_DIMENSIONS } = await import("../providers")
    m.getAiConfig.mockReturnValue(config({ embeddingDimensions: 3072 }))

    expect(EMBEDDING_COLUMN_DIMENSIONS).toBe(1536)
    expect(() => embeddingModel()).toThrow("AI_EMBEDDING_DIMENSIONS")
  })

  it("lets the embedding and transcription models work with AI replies off (KB ingestion needs them)", async () => {
    const { embeddingModel, transcriptionModel } = await import("../providers")
    m.getAiConfig.mockReturnValue(config({ enabled: false, anthropicApiKey: undefined, chatModel: undefined }))

    expect(() => embeddingModel()).not.toThrow()
    expect(() => transcriptionModel()).not.toThrow()
  })
})
