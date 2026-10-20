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
  TOO_LARGE_UNCOMPRESSED: "El DOCX es demasiado grande al descomprimirse (máximo 50 MB).",
} as const

/** A DOCX is a zip; refuse to inflate more than this (a small upload can expand enormously). */
export const DOCX_MAX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024

const EOCD_SIGNATURE = 0x06054b50
const CENTRAL_ENTRY_SIGNATURE = 0x02014b50
const ZIP64_MARKER = 0xffffffff

/**
 * Total uncompressed size a zip declares in its central directory, read without inflating
 * anything. `Infinity` for ZIP64 archives (sizes live elsewhere; a DOCX never needs them) and
 * null when there is no readable central directory. The declared size can be forged, so this
 * bounds honest-but-huge files and naive bombs; uploads are also limited to staff with access.
 */
export function docxUncompressedBytes(bytes: Uint8Array): number | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const lowest = Math.max(0, bytes.byteLength - 22 - 0xffff)
  let eocd = -1
  for (let i = bytes.byteLength - 22; i >= lowest; i--) {
    if (view.getUint32(i, true) === EOCD_SIGNATURE) {
      eocd = i
      break
    }
  }
  if (eocd < 0) return null

  const entries = view.getUint16(eocd + 10, true)
  const directoryOffset = view.getUint32(eocd + 16, true)
  if (entries === 0xffff || directoryOffset === ZIP64_MARKER) return Number.POSITIVE_INFINITY

  let total = 0
  let position = directoryOffset
  for (let entry = 0; entry < entries; entry++) {
    if (position + 46 > bytes.byteLength || view.getUint32(position, true) !== CENTRAL_ENTRY_SIGNATURE) return null
    const size = view.getUint32(position + 24, true)
    if (size === ZIP64_MARKER) return Number.POSITIVE_INFINITY
    total += size
    position += 46 + view.getUint16(position + 28, true) + view.getUint16(position + 30, true) + view.getUint16(position + 32, true)
  }
  return total
}

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
      const declared = docxUncompressedBytes(bytes)
      if (declared === null) return { ok: false, error: EXTRACT_ERRORS.UNREADABLE }
      if (declared > DOCX_MAX_UNCOMPRESSED_BYTES) return { ok: false, error: EXTRACT_ERRORS.TOO_LARGE_UNCOMPRESSED }
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
