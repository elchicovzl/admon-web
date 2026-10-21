import { describe, expect, it } from "vitest"
import { EscalationReason, HUMAN_REQUEST_KEYWORDS, detectEscalation, nextFailureState } from "../escalation"

describe("EscalationReason", () => {
  it("lists every reason, stored as plain strings", () => {
    expect(EscalationReason).toEqual({
      USER_REQUEST: "USER_REQUEST",
      COMPLAINT: "COMPLAINT",
      OUT_OF_SCOPE: "OUT_OF_SCOPE",
      FORBIDDEN_TOPIC: "FORBIDDEN_TOPIC",
      LOW_CONFIDENCE: "LOW_CONFIDENCE",
      REPEATED_FAILURE: "REPEATED_FAILURE",
      DOCUMENT_REVIEW: "DOCUMENT_REVIEW",
      AI_FAILURE: "AI_FAILURE",
      TURN_LIMIT: "TURN_LIMIT",
      BUDGET_LIMIT: "BUDGET_LIMIT",
    })
  })
})

describe("detectEscalation (AI-8)", () => {
  it("recognises a request for a person by the design keywords", () => {
    expect(HUMAN_REQUEST_KEYWORDS).toEqual(["asesor", "persona", "humano", "hablar con alguien", "gerente"])
    for (const text of ["Quiero un asesor", "¿Me pasa con una PERSONA?", "necesito un humano", "puedo hablar con alguien?", "el gerente por favor"]) {
      expect(detectEscalation(text, [])).toBe("USER_REQUEST")
    }
  })

  it("ignores accents and case, and matches whole words only", () => {
    expect(detectEscalation("Quiero hablar con un ASESÓR", [])).toBe("USER_REQUEST")
    expect(detectEscalation("Soy asesora contable", [])).toBeNull()
    expect(detectEscalation("¿Cuánto cuesta la afiliación?", [])).toBeNull()
  })

  it("flags a forbidden topic before anything else", () => {
    const forbidden = ["demanda laboral", "abogado"]

    expect(detectEscalation("Necesito un abogado para una DEMANDA LABORAL", forbidden)).toBe("FORBIDDEN_TOPIC")
    expect(detectEscalation("asesor, es por una demanda laboral", forbidden)).toBe("FORBIDDEN_TOPIC")
    expect(detectEscalation("hola", forbidden)).toBeNull()
  })

  it("ignores blank forbidden topics", () => {
    expect(detectEscalation("hola", ["", "  "])).toBeNull()
  })
})

describe("nextFailureState (AI-8, MH-4)", () => {
  it("escalates once consecutive failures reach the cap (2)", () => {
    expect(nextFailureState(1, 2, false)).toEqual({ escalate: false })
    expect(nextFailureState(2, 2, false)).toEqual({ escalate: true, reason: "REPEATED_FAILURE" })
    expect(nextFailureState(3, 2, false)).toEqual({ escalate: true, reason: "REPEATED_FAILURE" })
  })

  it("asks for a document review when the failure was about media", () => {
    expect(nextFailureState(2, 2, true)).toEqual({ escalate: true, reason: "DOCUMENT_REVIEW" })
  })
})
