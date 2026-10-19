import { afterEach, describe, expect, it, vi } from "vitest"
import { maskPhone, safeLog, sanitizeFields, scrubText } from "../log"

afterEach(() => vi.restoreAllMocks())

describe("maskPhone (WC-15)", () => {
  it("keeps only the last 4 digits", () => {
    expect(maskPhone("573001234567")).toBe("***4567")
    expect(maskPhone("+57 300 123 4567")).toBe("***4567")
  })

  it("never echoes short or empty input", () => {
    expect(maskPhone("123")).toBe("***")
    expect(maskPhone("")).toBe("***")
    expect(maskPhone(null)).toBe("***")
    expect(maskPhone(undefined)).toBe("***")
  })
})

describe("scrubText", () => {
  it("masks phone-like digit runs", () => {
    expect(scrubText("call +57 300 123 4567 now")).toBe("call ***4567 now")
  })

  it("redacts bearer tokens and URLs (signed media links)", () => {
    expect(scrubText("Authorization: Bearer EAAGabc.def-123")).toBe("Authorization: Bearer [redacted]")
    expect(scrubText("GET https://lookaside.fbsbx.com/x?sig=abc failed")).toBe("GET [redacted] failed")
  })

  it("leaves harmless text alone", () => {
    expect(scrubText("media stored")).toBe("media stored")
  })
})

describe("sanitizeFields", () => {
  it("never logs bodies, captions, transcripts, tokens or secrets, whatever they hold", () => {
    const out = sanitizeFields({
      body: "Hola, mi cédula es 123",
      text: "hola",
      caption: "foto",
      transcript: "audio",
      accessToken: "EAAG...",
      appSecret: "s3cret",
      authorization: "Bearer x",
      mediaUrl: "https://example.com/m",
      s3Key: "whatsapp/a/b",
    })

    expect(Object.values(out).every((value) => value === "[redacted]")).toBe(true)
  })

  it("masks phone fields and keeps ids and counts", () => {
    expect(sanitizeFields({ waId: "573001234567", phone: "3001234567", to: "573001234567", messageId: "m1", count: 3 }))
      .toEqual({ waId: "***4567", phone: "***4567", to: "***4567", messageId: "m1", count: 3 })
  })

  it("redacts nested objects instead of walking into possible content", () => {
    expect(sanitizeFields({ meta: { text: "x" }, list: ["a"] })).toEqual({ meta: "[redacted]", list: "[redacted]" })
  })

  it("scrubs phone numbers hiding in free-text values", () => {
    expect(sanitizeFields({ reason: "failed for 573001234567" })).toEqual({ reason: "failed for ***4567" })
  })
})

describe("safeLog", () => {
  it("writes one sanitized line on the right level", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    safeLog("warn", "media.failed", { messageId: "m1", body: "secret text", waId: "573001234567" })

    expect(warn).toHaveBeenCalledTimes(1)
    const line = warn.mock.calls[0][0] as string
    expect(line).toBe('[whatsapp] media.failed {"messageId":"m1","body":"[redacted]","waId":"***4567"}')
    expect(line).not.toContain("secret text")
    expect(line).not.toContain("573001234567")
  })

  it("routes info and error to their console methods", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {})
    const error = vi.spyOn(console, "error").mockImplementation(() => {})

    safeLog("info", "a")
    safeLog("error", "b")

    expect(info).toHaveBeenCalledWith("[whatsapp] a {}")
    expect(error).toHaveBeenCalledWith("[whatsapp] b {}")
  })
})
