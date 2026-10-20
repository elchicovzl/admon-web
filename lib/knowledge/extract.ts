import mammoth from "mammoth"
import { extractText, getDocumentProxy } from "unpdf"

/**
 * Text extraction for knowledge-base uploads (KB-2, KB-3). Supported: text PDFs, DOCX, TXT and
 * MD. Scanned (image-only) PDFs fail with a clear message: OCR is out of scope. DOCX headings
 * become `#` lines so the chunker can split by section. Never throws: a corrupt file is
 * reported as a failure the document keeps, and the upload can be replaced.
 */

export type DocumentKind = "pdf" | "docx" | "txt" | "md"

export const EXTRACT_ERRORS = {
  UNSUPPORTED: "Tipo de archivo no soportado. Use PDF, DOCX, TXT o MD.",
  SCANNED_PDF: "El PDF no contiene texto extraíble (posiblemente escaneado). OCR no está soportado.",
  UNREADABLE: "No se pudo leer el archivo. Verifique que no esté dañado ni protegido con contraseña.",
  EMPTY: "El documento no contiene texto.",
} as const

export type ExtractResult = { ok: true; text: string } | { ok: false; error: string }

/** Generic types some browsers send for any file; the extension decides then. */
const GENERIC_MIME = ["", "application/octet-stream"]

const KINDS: Record<DocumentKind, { extensions: string[]; mimeTypes: string[] }> = {
  pdf: { extensions: ["pdf"], mimeTypes: ["application/pdf"] },
  docx: {
    extensions: ["docx"],
    mimeTypes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  },
  txt: { extensions: ["txt"], mimeTypes: ["text/plain"] },
  md: { extensions: ["md", "markdown"], mimeTypes: ["text/markdown", "text/x-markdown", "text/plain"] },
}

/** The document kind for a file, or null when it is not supported or its type contradicts its extension. */
export function resolveDocumentKind(fileName: string, mimeType: string): DocumentKind | null {
  const extension = fileName.toLowerCase().split(".").pop() ?? ""
  const mime = mimeType.toLowerCase().split(";")[0].trim()
  for (const [kind, rule] of Object.entries(KINDS) as [DocumentKind, (typeof KINDS)[DocumentKind]][]) {
    if (rule.extensions.includes(extension)) {
      return rule.mimeTypes.includes(mime) || GENERIC_MIME.includes(mime) ? kind : null
    }
  }
  return null
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " " }

function decodeEntities(text: string): string {
  return text
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, name: string) => ENTITIES[name])
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
}

/** mammoth HTML to markdown-like text: headings become `#` lines, every block a paragraph. */
function htmlToText(html: string): string {
  const blocks: string[] = []
  const block = /<(h[1-6]|p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi
  for (let match = block.exec(html); match; match = block.exec(html)) {
    const text = decodeEntities(match[2].replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "")).trim()
    if (!text) continue
    const tag = match[1].toLowerCase()
    blocks.push(tag.startsWith("h") ? `${"#".repeat(Number(tag[1]))} ${text}` : text)
  }
  return blocks.join("\n\n")
}

async function pdfText(bytes: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(bytes)
  const { text } = await extractText(pdf, { mergePages: false })
  return text.map((page) => page.trim()).filter(Boolean).join("\n\n")
}

export async function extractDocumentText(
  bytes: Uint8Array,
  file: { fileName: string; mimeType: string }
): Promise<ExtractResult> {
  const kind = resolveDocumentKind(file.fileName, file.mimeType)
  if (!kind) return { ok: false, error: EXTRACT_ERRORS.UNSUPPORTED }

  let text: string
  try {
    if (kind === "pdf") {
      text = await pdfText(bytes)
      // A PDF that parses but carries no letters or digits is an image (scanned) document.
      if (!/[\p{L}\p{N}]/u.test(text)) return { ok: false, error: EXTRACT_ERRORS.SCANNED_PDF }
    } else if (kind === "docx") {
      const { value } = await mammoth.convertToHtml({ buffer: Buffer.from(bytes) })
      text = htmlToText(value)
    } else {
      text = new TextDecoder("utf-8").decode(bytes)
    }
  } catch {
    return { ok: false, error: EXTRACT_ERRORS.UNREADABLE }
  }

  // TXT/MD stay exactly as uploaded; only an all-blank file is rejected.
  if (!text.trim()) return { ok: false, error: EXTRACT_ERRORS.EMPTY }
  return { ok: true, text: kind === "txt" || kind === "md" ? text : text.trim() }
}
