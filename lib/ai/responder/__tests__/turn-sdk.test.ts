import { generateText, hasToolCall, isStepCount } from "ai"
import { MockLanguageModelV4 } from "ai/test"
import { describe, expect, it, vi } from "vitest"
import { buildResponderTools } from "../tools"

/**
 * The real AI SDK loop with a scripted model (no network): checks the assumptions turn.ts relies on —
 * a terminal tool without `execute` ends the loop, and `steps[].toolCalls` carries `toolName` and the
 * parsed `input`.
 */

const usage = { inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 20, text: 20, reasoning: 0 } }

function scriptedModel(responses: { toolName: string; input: unknown }[]) {
  let call = 0
  return new MockLanguageModelV4({
    doGenerate: async () => {
      const next = responses[Math.min(call++, responses.length - 1)]
      return {
        content: [{ type: "tool-call", toolCallId: `call-${call}`, toolName: next.toolName, input: JSON.stringify(next.input) }],
        finishReason: { unified: "tool-calls", raw: "tool_use" },
        usage,
        warnings: [],
      }
    },
  })
}

describe("responder tools in the real AI SDK loop", () => {
  it("runs searchKnowledge, stops at sendReply and exposes both calls with parsed input", async () => {
    const search = vi.fn(async () => ({ status: "OK" as const, results: [{ sourceId: "chunk-1", document: "Guía", section: null, text: "Cédula" }] }))
    const model = scriptedModel([
      { toolName: "searchKnowledge", input: { query: "requisitos" } },
      { toolName: "sendReply", input: { type: "ANSWER", text: "Necesita la cédula.", sourceIds: ["chunk-1"] } },
      // A third step must never be requested.
      { toolName: "searchKnowledge", input: { query: "otra" } },
    ])

    const result = await generateText({
      model,
      prompt: "¿Qué necesito?",
      tools: buildResponderTools({ searchKnowledge: search, recordIdentityDocument: vi.fn() }),
      toolChoice: "auto",
      stopWhen: [isStepCount(4), hasToolCall("sendReply"), hasToolCall("escalateToHuman")],
    })

    expect(search).toHaveBeenCalledTimes(1)
    expect(result.steps).toHaveLength(2)
    const calls = result.steps.flatMap((step) => step.toolCalls)
    expect(calls.map((call) => call.toolName)).toEqual(["searchKnowledge", "sendReply"])
    expect(calls[1].input).toEqual({ type: "ANSWER", text: "Necesita la cédula.", sourceIds: ["chunk-1"] })
    expect(result.totalUsage.inputTokens).toBe(200)
  })

  it("stops at escalateToHuman too", async () => {
    const result = await generateText({
      model: scriptedModel([{ toolName: "escalateToHuman", input: { reason: "USER_REQUEST", summary: "Quiere un asesor" } }]),
      prompt: "asesor",
      tools: buildResponderTools({ searchKnowledge: vi.fn(), recordIdentityDocument: vi.fn() }),
      toolChoice: "auto",
      stopWhen: [isStepCount(4), hasToolCall("sendReply"), hasToolCall("escalateToHuman")],
    })

    expect(result.steps).toHaveLength(1)
    expect(result.steps[0].toolCalls[0]).toMatchObject({ toolName: "escalateToHuman", input: { reason: "USER_REQUEST" } })
  })

  it("keeps going after recordIdentityDocument and stops at the reply that follows", async () => {
    const record = vi.fn()
    const document = { documentType: "NIT", number: "900.123.456-7", fullName: "", businessName: "Comercial Andes SAS" }
    const result = await generateText({
      model: scriptedModel([
        { toolName: "recordIdentityDocument", input: document },
        { toolName: "sendReply", input: { type: "SMALLTALK", text: "Recibí el RUT.", sourceIds: [] } },
      ]),
      prompt: "[Imagen] Este es el RUT",
      tools: buildResponderTools({ searchKnowledge: vi.fn(), recordIdentityDocument: record }),
      toolChoice: "auto",
      stopWhen: [isStepCount(4), hasToolCall("sendReply"), hasToolCall("escalateToHuman")],
    })

    expect(record).toHaveBeenCalledWith(document)
    expect(result.steps.flatMap((step) => step.toolCalls).map((call) => call.toolName)).toEqual(["recordIdentityDocument", "sendReply"])
  })
})
