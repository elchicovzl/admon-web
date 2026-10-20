import { extensionFor, isStorableMime, normalizeMime } from "./mime"

/**
 * Outbound attachment rules for the composer (D6, WC-10). Pure: the UI runs them for early
 * feedback and the server runs them again on the real bytes.
 *
 * Allowed: JPEG and PNG images, and PDF. Limits follow the design (PDF up to 10 MB) except
 * images, which are capped at 5 MB because that is Meta's image limit; a larger image would only
 * come back as a failed send. The declared type is never trusted on its own: the server also
 * checks the file signature, and the inbound blocklist (HTML, SVG, scripts, executables) applies.
 */

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024
export const CAPTION_MAX_LENGTH = 1024

export type AttachmentKind = "image" | "document"

interface AttachmentRule {
  kind: AttachmentKind
  maxBytes: number
  label: string
}

const RULES: Record<string, AttachmentRule> = {
  "image/jpeg": { kind: "image", maxBytes: MAX_IMAGE_BYTES, label: "imagen JPG" },
  "image/png": { kind: "image", maxBytes: MAX_IMAGE_BYTES, label: "imagen PNG" },
  "application/pdf": { kind: "document", maxBytes: MAX_DOCUMENT_BYTES, label: "PDF" },
}

/** Value for `<input accept>`. */
export const ATTACHMENT_ACCEPT = Object.keys(RULES).join(",")

export interface AttachmentInfo {
  mimeType: string
  kind: AttachmentKind
  extension: string
  fileName: string
}

export type AttachmentCheck = { ok: true; attachment: AttachmentInfo } | { ok: false; error: string }

function megabytes(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`
}

/** Keeps a readable name without path pieces or characters that break headers and keys. */
export function sanitizeFileName(name: string | null | undefined, fallbackExtension: string): string {
  const base = (name ?? "").split(/[\\/]/).pop() ?? ""
  const cleaned = base
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._ -]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .slice(0, 100)
  return cleaned || `archivo.${fallbackExtension}`
}

/** Checks what the browser or the request declares: type, size and name. */
export function validateAttachment(input: {
  mimeType: string | null | undefined
  sizeBytes: number
  fileName?: string | null
}): AttachmentCheck {
  const mimeType = normalizeMime(input.mimeType)
  if (!mimeType) return { ok: false, error: "No se pudo determinar el tipo de archivo" }
  if (!isStorableMime(mimeType)) return { ok: false, error: "Este tipo de archivo no está permitido" }

  const rule = RULES[mimeType]
  if (!rule) return { ok: false, error: "Solo se pueden enviar imágenes JPG o PNG y archivos PDF" }

  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) {
    return { ok: false, error: "El archivo está vacío" }
  }
  if (input.sizeBytes > rule.maxBytes) {
    return { ok: false, error: `La ${rule.label} no puede superar ${megabytes(rule.maxBytes)}` }
  }

  const extension = extensionFor(mimeType)
  return {
    ok: true,
    attachment: { mimeType, kind: rule.kind, extension, fileName: sanitizeFileName(input.fileName, extension) },
  }
}

/** Detects the real type from the first bytes; null when it is none of the allowed ones. */
export function sniffMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg"
  if (
    bytes.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)
  ) {
    return "image/png"
  }
  // %PDF- may be preceded by a few bytes of junk, which PDF readers tolerate.
  const head = String.fromCharCode(...bytes.subarray(0, 1024))
  if (head.includes("%PDF-")) return "application/pdf"
  return null
}

/** The declared type must match the bytes; a mismatch means a renamed or hostile file. */
export function bytesMatchMime(declaredMime: string, bytes: Uint8Array): boolean {
  return sniffMime(bytes) === declaredMime
}
