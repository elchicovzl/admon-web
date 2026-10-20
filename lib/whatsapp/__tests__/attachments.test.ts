import { describe, expect, it } from "vitest"
import {
  ATTACHMENT_ACCEPT,
  MAX_DOCUMENT_BYTES,
  MAX_IMAGE_BYTES,
  bytesMatchMime,
  sanitizeFileName,
  sniffMime,
  validateAttachment,
} from "../attachments"

const MB = 1024 * 1024

describe("validateAttachment", () => {
  it("accepts JPEG, PNG and PDF within their limits", () => {
    const jpeg = validateAttachment({ mimeType: "image/jpeg", sizeBytes: 2 * MB, fileName: "foto.JPG" })
    expect(jpeg).toEqual({
      ok: true,
      attachment: { mimeType: "image/jpeg", kind: "image", extension: "jpg", fileName: "foto.JPG" },
    })
    expect(validateAttachment({ mimeType: "image/png", sizeBytes: MAX_IMAGE_BYTES }).ok).toBe(true)
    expect(validateAttachment({ mimeType: "application/pdf", sizeBytes: MAX_DOCUMENT_BYTES })).toMatchObject({
      ok: true,
      attachment: { kind: "document", extension: "pdf" },
    })
  })

  it("normalizes parameters and case in the declared type", () => {
    expect(validateAttachment({ mimeType: "Image/PNG; charset=binary", sizeBytes: 10 })).toMatchObject({
      ok: true,
      attachment: { mimeType: "image/png" },
    })
  })

  it("enforces the per-kind size limit (images 5 MB, PDF 10 MB)", () => {
    expect(validateAttachment({ mimeType: "image/jpeg", sizeBytes: MAX_IMAGE_BYTES + 1 })).toEqual({
      ok: false,
      error: "La imagen JPG no puede superar 5 MB",
    })
    expect(validateAttachment({ mimeType: "application/pdf", sizeBytes: MAX_DOCUMENT_BYTES + 1 })).toEqual({
      ok: false,
      error: "La PDF no puede superar 10 MB",
    })
  })

  it("rejects empty files and unusable sizes", () => {
    for (const sizeBytes of [0, -1, Number.NaN]) {
      expect(validateAttachment({ mimeType: "application/pdf", sizeBytes })).toEqual({
        ok: false,
        error: "El archivo está vacío",
      })
    }
  })

  it("blocks the same dangerous types as inbound storage", () => {
    for (const mimeType of ["text/html", "image/svg+xml", "application/javascript", "application/x-msdownload"]) {
      expect(validateAttachment({ mimeType, sizeBytes: 100 })).toEqual({
        ok: false,
        error: "Este tipo de archivo no está permitido",
      })
    }
  })

  it("rejects types outside the allowlist, even harmless ones", () => {
    for (const mimeType of ["image/webp", "image/gif", "video/mp4", "audio/ogg", "text/plain", "application/zip"]) {
      expect(validateAttachment({ mimeType, sizeBytes: 100 })).toEqual({
        ok: false,
        error: "Solo se pueden enviar imágenes JPG o PNG y archivos PDF",
      })
    }
  })

  it("rejects a missing or malformed type", () => {
    for (const mimeType of [undefined, null, "", "not a mime"]) {
      expect(validateAttachment({ mimeType, sizeBytes: 100 })).toEqual({
        ok: false,
        error: "No se pudo determinar el tipo de archivo",
      })
    }
  })

  it("advertises exactly the allowed types", () => {
    expect(ATTACHMENT_ACCEPT).toBe("image/jpeg,image/png,application/pdf")
  })
})

describe("sanitizeFileName", () => {
  it("drops path pieces and unsafe characters", () => {
    expect(sanitizeFileName("../../etc/passwd", "pdf")).toBe("passwd")
    expect(sanitizeFileName("C:\\Users\\ana\\cédula 1.pdf", "pdf")).toBe("cedula 1.pdf")
    expect(sanitizeFileName('a"b<c>.png', "png")).toBe("a_b_c_.png")
  })

  it("falls back to a generic name", () => {
    expect(sanitizeFileName("", "pdf")).toBe("archivo.pdf")
    expect(sanitizeFileName(null, "jpg")).toBe("archivo.jpg")
    expect(sanitizeFileName("...", "png")).toBe("archivo.png")
  })

  it("caps the length", () => {
    expect(sanitizeFileName(`${"a".repeat(300)}.pdf`, "pdf").length).toBe(100)
  })
})

describe("file signatures", () => {
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10])
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])
  const pdf = new TextEncoder().encode("%PDF-1.7\n...")
  const html = new TextEncoder().encode("<html><script>alert(1)</script></html>")

  it("recognizes the allowed types by their first bytes", () => {
    expect(sniffMime(jpeg)).toBe("image/jpeg")
    expect(sniffMime(png)).toBe("image/png")
    expect(sniffMime(pdf)).toBe("application/pdf")
  })

  it("returns null for anything else", () => {
    expect(sniffMime(html)).toBeNull()
    expect(sniffMime(new Uint8Array())).toBeNull()
  })

  it("rejects bytes that do not match the declared type", () => {
    expect(bytesMatchMime("image/jpeg", jpeg)).toBe(true)
    expect(bytesMatchMime("application/pdf", html)).toBe(false)
    expect(bytesMatchMime("image/png", jpeg)).toBe(false)
  })
})
