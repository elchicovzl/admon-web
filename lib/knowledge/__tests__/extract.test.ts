import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { DOCX_MAX_UNCOMPRESSED_BYTES, EXTRACT_ERRORS, docxUncompressedBytes, extractDocumentText, resolveDocumentKind } from "../extract"

const fixture = (name: string) => new Uint8Array(readFileSync(join(__dirname, "fixtures", name)))
const utf8 = (text: string) => new TextEncoder().encode(text)

describe("resolveDocumentKind (KB-2)", () => {
  it("accepts PDF, DOCX, TXT and MD by extension and MIME type", () => {
    expect(resolveDocumentKind("guia.pdf", "application/pdf")).toBe("pdf")
    expect(
      resolveDocumentKind("guia.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    ).toBe("docx")
    expect(resolveDocumentKind("notas.txt", "text/plain")).toBe("txt")
    expect(resolveDocumentKind("faq.md", "text/markdown")).toBe("md")
    expect(resolveDocumentKind("FAQ.MD", "")).toBe("md")
  })

  it("rejects spreadsheets and anything else (S-KB-4)", () => {
    expect(
      resolveDocumentKind("tarifas.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    ).toBeNull()
    expect(resolveDocumentKind("foto.png", "image/png")).toBeNull()
    expect(resolveDocumentKind("guia.pdf.exe", "application/pdf")).toBeNull()
  })

  it("rejects a file whose MIME type contradicts its extension", () => {
    expect(resolveDocumentKind("guia.pdf", "image/png")).toBeNull()
  })
})

describe("extractDocumentText", () => {
  it("extracts the text of a text PDF", async () => {
    const r = await extractDocumentText(fixture("text.pdf"), { fileName: "guia.pdf", mimeType: "application/pdf" })

    expect(r).toEqual({
      ok: true,
      text: "Afiliaciones a EPS\nPara afiliar a un empleado se necesita la cedula y el formulario.",
    })
  })

  it("fails an image-only PDF with the OCR message (S-KB-3, KB-3)", async () => {
    const r = await extractDocumentText(fixture("image-only.pdf"), {
      fileName: "escaneado.pdf",
      mimeType: "application/pdf",
    })

    expect(r).toEqual({
      ok: false,
      error: "El PDF no contiene texto extraíble (posiblemente escaneado). OCR no está soportado.",
    })
  })

  it("keeps DOCX headings as markdown headings", async () => {
    const r = await extractDocumentText(fixture("headings.docx"), {
      fileName: "requisitos.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    })

    expect(r).toEqual({
      ok: true,
      text: "# Requisitos de afiliación\n\nSe necesita la cédula del trabajador.\n\n## Tiempos\n\nEl trámite tarda tres días hábiles.",
    })
  })

  it("returns TXT and MD content as-is", async () => {
    const md = "# Preguntas\n\n*Horario*: lunes a viernes."

    expect(await extractDocumentText(utf8(md), { fileName: "faq.md", mimeType: "text/markdown" })).toEqual({
      ok: true,
      text: md,
    })
    expect(await extractDocumentText(utf8("línea uno\nlínea dos"), { fileName: "a.txt", mimeType: "text/plain" })).toEqual({
      ok: true,
      text: "línea uno\nlínea dos",
    })
  })

  it("rejects an unsupported file without parsing it (S-KB-4)", async () => {
    const r = await extractDocumentText(utf8("PK..."), {
      fileName: "tarifas.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })

    expect(r).toEqual({ ok: false, error: EXTRACT_ERRORS.UNSUPPORTED })
    expect(EXTRACT_ERRORS.UNSUPPORTED).toBe("Tipo de archivo no soportado. Use PDF, DOCX, TXT o MD.")
  })

  it("reports a corrupt file instead of throwing", async () => {
    const r = await extractDocumentText(utf8("not a pdf"), { fileName: "roto.pdf", mimeType: "application/pdf" })

    expect(r).toEqual({ ok: false, error: EXTRACT_ERRORS.UNREADABLE })
  })

  it("reports a text file with no content as empty", async () => {
    const r = await extractDocumentText(utf8("  \n "), { fileName: "vacio.txt", mimeType: "text/plain" })

    expect(r).toEqual({ ok: false, error: EXTRACT_ERRORS.EMPTY })
  })
})

/** A minimal zip whose central directory declares `entries` with the given uncompressed sizes. */
function zipDeclaring(sizes: number[]): Uint8Array {
  const central: number[] = []
  sizes.forEach((size, i) => {
    const name = new TextEncoder().encode(`f${i}.xml`)
    const header = new Uint8Array(46 + name.length)
    const view = new DataView(header.buffer)
    view.setUint32(0, 0x02014b50, true)
    view.setUint32(24, size, true)
    view.setUint16(28, name.length, true)
    header.set(name, 46)
    central.push(...header)
  })
  const eocd = new Uint8Array(22)
  const view = new DataView(eocd.buffer)
  view.setUint32(0, 0x06054b50, true)
  view.setUint16(10, sizes.length, true)
  view.setUint32(12, central.length, true)
  view.setUint32(16, 0, true)
  return new Uint8Array([...central, ...eocd])
}

describe("DOCX decompression cap (zip bomb)", () => {
  it("reads the declared uncompressed size of a real DOCX", () => {
    const size = docxUncompressedBytes(fixture("headings.docx"))

    expect(size).toBeGreaterThan(0)
    expect(size).toBeLessThan(DOCX_MAX_UNCOMPRESSED_BYTES)
  })

  it("rejects a DOCX that would expand past the cap, without parsing it", async () => {
    const bomb = zipDeclaring([DOCX_MAX_UNCOMPRESSED_BYTES, 1])

    expect(docxUncompressedBytes(bomb)).toBe(DOCX_MAX_UNCOMPRESSED_BYTES + 1)
    expect(
      await extractDocumentText(bomb, {
        fileName: "bomba.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      })
    ).toEqual({ ok: false, error: EXTRACT_ERRORS.TOO_LARGE_UNCOMPRESSED })
  })

  it("treats ZIP64 sizes and a missing central directory as unreadable sizes", () => {
    expect(docxUncompressedBytes(zipDeclaring([0xffffffff]))).toBe(Number.POSITIVE_INFINITY)
    expect(docxUncompressedBytes(new Uint8Array([1, 2, 3]))).toBeNull()
  })
})
