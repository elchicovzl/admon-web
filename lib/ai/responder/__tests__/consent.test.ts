import { describe, expect, it } from "vitest"
import { consentNotice, prefixConsent, siteUrlFrom } from "../consent"

const SITE = "https://administracionsegura.co"

describe("consent notice (AI-5)", () => {
  it("says it is an AI, that continuing accepts the privacy policy, and links it", () => {
    const notice = consentNotice(SITE)

    expect(notice).toContain("asistente virtual")
    expect(notice).toContain("inteligencia artificial")
    expect(notice).toContain("Al continuar esta conversación, acepta")
    expect(notice).toContain("https://administracionsegura.co/privacy")
    expect(notice).toContain("asesor")
  })

  it("builds the link from NEXT_PUBLIC_SITE_URL, without a double slash, with the site's default", () => {
    expect(siteUrlFrom({ NEXT_PUBLIC_SITE_URL: "https://example.co/" })).toBe("https://example.co")
    expect(siteUrlFrom({})).toBe(SITE)
    expect(consentNotice("https://example.co")).toContain("https://example.co/privacy")
  })
})

describe("prefixConsent (S-AI-2)", () => {
  it("prefixes the notice while the conversation has not received it", () => {
    expect(prefixConsent("Necesita su cédula.", null, SITE)).toBe(`${consentNotice(SITE)}\n\nNecesita su cédula.`)
  })

  it("leaves replies alone once the notice was sent", () => {
    expect(prefixConsent("Necesita su cédula.", new Date("2026-10-20T10:00:00Z"), SITE)).toBe("Necesita su cédula.")
  })

  it("prefixes holding and handoff texts too, so no first message goes out without it", () => {
    const handoff = "Un asesor lo atenderá en breve."

    expect(prefixConsent(handoff, null, SITE).startsWith(consentNotice(SITE))).toBe(true)
  })
})
