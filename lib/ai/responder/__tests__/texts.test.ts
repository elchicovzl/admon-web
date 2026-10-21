import { describe, expect, it } from "vitest"
import { AI_FAILURE_HOLDING_TEXT, HANDOFF_IN_HOURS_TEXT, TRANSCRIPTION_FAILED_TEXT, UNSUPPORTED_MEDIA_TEXT, handoffText } from "../texts"

describe("deterministic responder texts", () => {
  it("hands off in business hours with the design text (S-AI-4)", () => {
    expect(HANDOFF_IN_HOURS_TEXT).toBe("Un asesor lo atenderá en breve.")
    expect(handoffText({ isBusinessHours: true, nextBusinessSlot: null })).toBe(HANDOFF_IN_HOURS_TEXT)
  })

  it("tells the client when staff will answer outside business hours (S-AI-5)", () => {
    const text = handoffText({ isBusinessHours: false, nextBusinessSlot: new Date("2026-10-26T13:00:00Z") })

    expect(text).toContain("lunes a viernes de 8:00 a. m. a 5:00 p. m.")
    expect(text).toContain("a partir del lunes 26 de octubre a las 8:00.")
  })

  it("has one neutral holding message for AI failures and asks to write for unreadable media (S-AI-11, S-MH-2/4)", () => {
    expect(AI_FAILURE_HOLDING_TEXT).toContain("asesor")
    expect(AI_FAILURE_HOLDING_TEXT).not.toMatch(/error|falla|IA|inteligencia/i)
    expect(TRANSCRIPTION_FAILED_TEXT).toContain("¿Podría escribirme su consulta?")
    expect(UNSUPPORTED_MEDIA_TEXT).toContain("texto, notas de voz, imágenes y documentos PDF")
  })
})
