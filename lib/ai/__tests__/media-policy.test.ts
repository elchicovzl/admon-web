import { describe, expect, it } from "vitest"
import { MEDIA_POLICY_LIMITS, classifyMedia } from "../responder/media-policy"

const MB = 1024 * 1024

describe("classifyMedia (MH-6)", () => {
  it("uses the design limits: audio 10 min, images 5 MB, PDF 10 MB", () => {
    expect(MEDIA_POLICY_LIMITS).toEqual({ audioSeconds: 600, audioBytes: 25 * MB, imageBytes: 5 * MB, pdfBytes: 10 * MB })
  })

  it("transcribes audio up to 10 minutes", () => {
    expect(classifyMedia({ mimeType: "audio/ogg; codecs=opus", sizeBytes: 200_000, durationSec: 30 })).toBe("TRANSCRIBE")
    expect(classifyMedia({ mimeType: "audio/mpeg", sizeBytes: 2 * MB, durationSec: 600 })).toBe("TRANSCRIBE")
    expect(classifyMedia({ mimeType: "audio/mp4", sizeBytes: 2 * MB })).toBe("TRANSCRIBE")
    expect(classifyMedia({ mimeType: "audio/ogg", sizeBytes: 1 * MB, durationSec: 601 })).toBe("TOO_LARGE")
    expect(classifyMedia({ mimeType: "audio/ogg", sizeBytes: 26 * MB })).toBe("TOO_LARGE")
  })

  it("reads JPEG, PNG and WEBP images up to 5 MB", () => {
    for (const mimeType of ["image/jpeg", "image/png", "image/webp"]) {
      expect(classifyMedia({ mimeType, sizeBytes: 5 * MB })).toBe("VISION_IMAGE")
      expect(classifyMedia({ mimeType, sizeBytes: 5 * MB + 1 })).toBe("TOO_LARGE")
    }
  })

  it("reads PDFs up to 10 MB", () => {
    expect(classifyMedia({ mimeType: "application/pdf", sizeBytes: 10 * MB })).toBe("VISION_PDF")
    expect(classifyMedia({ mimeType: "application/pdf", sizeBytes: 10 * MB + 1 })).toBe("TOO_LARGE")
  })

  it("does not read video, stickers, animations, locations, contacts, DOCX or XLSX (S-MH-4/5)", () => {
    expect(classifyMedia({ mimeType: "video/mp4", sizeBytes: MB })).toBe("UNSUPPORTED")
    expect(classifyMedia({ mimeType: "image/webp", sizeBytes: 50_000, messageType: "STICKER" })).toBe("UNSUPPORTED")
    expect(classifyMedia({ mimeType: "image/gif", sizeBytes: 50_000 })).toBe("UNSUPPORTED")
    expect(classifyMedia({ mimeType: "", sizeBytes: null, messageType: "LOCATION" })).toBe("UNSUPPORTED")
    expect(classifyMedia({ mimeType: "", sizeBytes: null, messageType: "CONTACTS" })).toBe("UNSUPPORTED")
    expect(
      classifyMedia({ mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", sizeBytes: MB })
    ).toBe("UNSUPPORTED")
    expect(
      classifyMedia({ mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", sizeBytes: MB })
    ).toBe("UNSUPPORTED")
  })

  it("treats an unknown size as within limits (the type still decides)", () => {
    expect(classifyMedia({ mimeType: "image/png", sizeBytes: null })).toBe("VISION_IMAGE")
  })

  it("ignores letter case and MIME parameters", () => {
    expect(classifyMedia({ mimeType: "IMAGE/JPEG", sizeBytes: 1000 })).toBe("VISION_IMAGE")
    expect(classifyMedia({ mimeType: "application/pdf; charset=binary", sizeBytes: 1000 })).toBe("VISION_PDF")
  })
})
