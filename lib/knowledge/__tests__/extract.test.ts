import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { EXTRACT_ERRORS, extractDocumentText, resolveDocumentKind } from "../extract"

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
