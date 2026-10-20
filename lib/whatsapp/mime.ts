/**
 * MIME policy shared by inbound media storage (media.ts) and outbound attachments
 * (attachments.ts). Pure on purpose: it is also imported by client code for early feedback.
 */

/** Content types that can execute in a browser or on a desktop; never stored. */
export const BLOCKED_MIME = new Set([
  "text/html",
  "application/xhtml+xml",
  "image/svg+xml",
  "text/javascript",
  "application/javascript",
  "application/x-javascript",
  "application/x-sh",
  "application/x-msdownload",
  "application/x-msdos-program",
  "application/x-dosexec",
  "application/vnd.microsoft.portable-executable",
  "application/java-archive",
  "application/x-apple-diskimage",
])

export const MIME_PATTERN = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/

export const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/amr": "amr",
  "video/mp4": "mp4",
  "video/3gpp": "3gp",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/plain": "txt",
}

/** Normalizes "audio/ogg; codecs=opus" to "audio/ogg"; null when it is not a valid media type. */
export function normalizeMime(value: string | null | undefined): string | null {
  const base = value?.split(";")[0]?.trim().toLowerCase()
  return base && MIME_PATTERN.test(base) ? base : null
}

export function isStorableMime(mime: string | null): mime is string {
  return mime !== null && !BLOCKED_MIME.has(mime)
}

export function extensionFor(mime: string): string {
  return EXTENSIONS[mime] ?? "bin"
}

