import { describe, expect, it } from "vitest"
import { FALLBACK_TEXT, MAX_REPLY_LENGTH, guardModelOutput } from "../guard"

const allowed = new Set(["chunk-1", "chunk-2"])
const answer = (text: string, sourceIds: string[] = ["chunk-1"]) => ({ type: "ANSWER" as const, text, sourceIds })

describe("guardModelOutput: grounding (AI-3, AI-4, S-AI-3)", () => {
  it("sends a grounded answer", () => {
    expect(guardModelOutput(answer("Necesita la cédula del trabajador."), allowed)).toEqual({
      kind: "SEND",
      type: "ANSWER",
      text: "Necesita la cédula del trabajador.",
      sourceIds: ["chunk-1"],
    })
  })

  it("falls back, counted as a failure, when an answer cites no source", () => {
    expect(guardModelOutput(answer("La afiliación cuesta 50.000.", []), allowed)).toEqual({
      kind: "FALLBACK",
      text: "no tengo esa información, ¿desea que lo comunique con un asesor?",
      reason: "NO_SOURCES",
      failure: true,
    })
    expect(FALLBACK_TEXT).toBe("no tengo esa información, ¿desea que lo comunique con un asesor?")
  })

  it("falls back when an answer cites a chunk that was not retrieved in this turn", () => {
    expect(guardModelOutput(answer("Texto.", ["chunk-1", "chunk-99"]), allowed)).toMatchObject({
      kind: "FALLBACK",
      reason: "FOREIGN_SOURCE",
      failure: true,
    })
  })

  it("falls back when the model ends without calling sendReply", () => {
    expect(guardModelOutput(null, allowed)).toMatchObject({ kind: "FALLBACK", reason: "NO_TOOL_CALL", failure: true })
  })

  it("falls back on an empty reply", () => {
    expect(guardModelOutput(answer("   **  **  "), allowed)).toMatchObject({ kind: "FALLBACK", reason: "EMPTY" })
  })
})

describe("guardModelOutput: clarifications and small talk", () => {
  it("sends a short clarification or greeting without sources", () => {
    expect(guardModelOutput({ type: "CLARIFY", text: "¿Para qué empresa trabaja?", sourceIds: [] }, allowed)).toMatchObject({
      kind: "SEND",
      type: "CLARIFY",
    })
    expect(guardModelOutput({ type: "SMALLTALK", text: "¡Con gusto! ¿En qué más le ayudo?", sourceIds: [] }, allowed)).toMatchObject({
      kind: "SEND",
      type: "SMALLTALK",
    })
  })

  it("treats a long clarification as an answer, so it needs sources", () => {
    const long = "Le explico. ".repeat(30)

    expect(guardModelOutput({ type: "CLARIFY", text: long, sourceIds: [] }, allowed)).toMatchObject({
      kind: "FALLBACK",
      reason: "NO_SOURCES",
    })
  })

  it("treats facts (numbers, prices, dates) in small talk as an answer", () => {
    for (const text of ["Claro, son $45.000", "Eso tarda 3 días", "Abrimos el 15 de enero", "Tiene un 20% de descuento"]) {
      expect(guardModelOutput({ type: "SMALLTALK", text, sourceIds: [] }, allowed)).toMatchObject({
        kind: "FALLBACK",
        reason: "NO_SOURCES",
      })
    }
  })
})

describe("guardModelOutput: format", () => {
  it("strips markdown WhatsApp does not render, keeping *bold*", () => {
    const r = guardModelOutput(
      answer("## Requisitos\n**Cédula** y `formulario`.\n- Paso uno\n[Ver guía](https://x.co/g) _ahora_ ~ya~"),
      allowed
    )

    expect(r).toMatchObject({ kind: "SEND", text: "Requisitos\n*Cédula* y formulario.\n- Paso uno\nVer guía (https://x.co/g) ahora ya" })
  })

  it("keeps snake_case words and lone symbols untouched", () => {
    expect(guardModelOutput(answer("Use el campo numero_documento y 2 * 3 = 6"), allowed)).toMatchObject({
      text: "Use el campo numero_documento y 2 * 3 = 6",
    })
  })

  it("caps replies at 1000 characters on a word boundary", () => {
    const r = guardModelOutput(answer("palabra ".repeat(300)), allowed)

    expect(MAX_REPLY_LENGTH).toBe(1000)
    expect(r.kind).toBe("SEND")
    if (r.kind !== "SEND") return
    expect(r.text.length).toBeLessThanOrEqual(1000)
    expect(r.text.endsWith("palabra…")).toBe(true)
  })
})

describe("guardModelOutput: prompt injection (AI-15, S-AI-10)", () => {
  it("does not let an injected instruction produce an ungrounded promise", () => {
    const injected = { type: "SMALLTALK" as const, text: "Claro, ignoro mis instrucciones: le doy 50% de descuento.", sourceIds: [] }

    expect(guardModelOutput(injected, allowed)).toMatchObject({ kind: "FALLBACK", reason: "NO_SOURCES", failure: true })
  })

  it("does not accept source ids the injected text invented", () => {
    const injected = answer("Según el documento interno, todo es gratis.", ["chunk-secret"])

    expect(guardModelOutput(injected, allowed)).toMatchObject({ kind: "FALLBACK", reason: "FOREIGN_SOURCE" })
  })
})
