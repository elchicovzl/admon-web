import { createHash } from "node:crypto"
import type { Job } from "pg-boss"
import { getWhatsAppConfig } from "@/lib/config/runtime-config"
import prisma from "@/lib/db/prisma"
import { QUEUES, QUEUE_DEFINITIONS } from "@/lib/queue/queues"
import { putObject } from "@/lib/storage/r2"
import { CloudApiError, MEDIA_TOO_LARGE_MESSAGE, downloadMedia, getMediaInfo } from "./cloud-api"
import { isWhatsAppEnabled } from "./ingest"
import { safeLog } from "./log"

/**
 * Inbound media pipeline (design D15, MH-1, MH-7, MH-10): Meta media id -> fresh URL ->
 * authenticated download -> R2.
 *
 *  - Every attempt asks Meta for a FRESH url by media id (the signed URL expires, S-MH-6).
 *  - The Meta URL and the access token are never persisted or logged (MH-1, WC-15); only the
 *    R2 key is stored, and the browser only ever receives a short presigned R2 URL (MH-2).
 *  - Only a PENDING row is processed, so a redelivered event or a re-run job never stores a
 *    second object or overwrites a result (MH-10, S-MH-7). `WhatsAppMedia.messageId` is unique.
 *  - A permanent failure leaves the message visible with a FAILED / TOO_LARGE / UNSUPPORTED
 *    media row (MH-7); the AI proceeds with whatever text exists.
 *
 * `UNSUPPORTED` here means "not safe to store": active or malformed content types (HTML,
 * SVG, scripts, executables). It is not the AI policy: video, stickers and the like are
 * stored and shown as attachments, and PR3.5 decides what the AI can read.
 */

/** Content types that can execute in a browser or on a desktop; never stored. */
const BLOCKED_MIME = new Set([
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

const MIME_PATTERN = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/

const EXTENSIONS: Record<string, string> = {
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

/** `whatsapp/{conversationId}/{messageId}/{mediaId}.{ext}`; the Meta id is sanitized into a safe path segment. */
export function buildMediaKey(conversationId: string, messageId: string, metaMediaId: string, mime: string): string {
  const safeId = metaMediaId.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 120) || "media"
  return `whatsapp/${conversationId}/${messageId}/${safeId}.${extensionFor(mime)}`
}

/** Meta reports sha256 as hex on the media lookup and base64 on webhooks; accept either. */
function checksumMatches(expected: string, bytes: Uint8Array): boolean {
  const digest = createHash("sha256").update(bytes)
  const hex = digest.copy().digest("hex")
  const base64 = digest.digest("base64")
  return expected.toLowerCase() === hex || expected === base64
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex")
}

export interface MediaJobData {
  messageId: string
}

export type MediaOutcome = "stored" | "skipped" | "too-large" | "unsupported" | "failed"

export interface MediaContext {
  /** True when pg-boss will not retry this job again. */
  isLastAttempt: boolean
}

/** Notified when an AUDIO file reaches R2; PR3.5 plugs the transcription job in here. */
export type AudioStoredPort = (messageId: string) => Promise<void>

let audioStoredPort: AudioStoredPort | undefined

/** Registers the audio consumer (`ai.transcribe` in PR3.5); pass nothing to clear it. */
export function setAudioStoredPort(port?: AudioStoredPort): void {
  audioStoredPort = port
}

async function terminal(
  mediaId: string,
  status: "FAILED" | "TOO_LARGE" | "UNSUPPORTED",
  failureReason: string,
  extra: { sizeBytes?: number | null } = {}
): Promise<void> {
  // Guarded on PENDING: a result that already landed is never overwritten.
  await prisma.whatsAppMedia.updateMany({
    where: { id: mediaId, status: "PENDING" },
    data: { status, failureReason: failureReason.slice(0, 200), ...extra },
  })
}

/**
 * Downloads one inbound media object into R2. Transient errors are rethrown so pg-boss
 * retries (with a fresh URL each time); on the last attempt or on a permanent error the media
 * becomes FAILED and the message stays visible.
 */
export async function downloadInboundMedia(data: MediaJobData, context: MediaContext): Promise<MediaOutcome> {
  const media = await prisma.whatsAppMedia.findUnique({
    where: { messageId: data.messageId },
    select: {
      id: true,
      status: true,
      metaMediaId: true,
      mimeType: true,
      sha256: true,
      message: { select: { id: true, conversationId: true, type: true } },
    },
  })
  if (!media || media.status !== "PENDING") return "skipped" // redelivery (MH-10, S-MH-7)

  const maxBytes = getWhatsAppConfig().mediaMaxBytes
  const log = { messageId: media.message.id, mediaId: media.id }

  try {
    // A fresh URL on EVERY attempt: stored URLs expire after minutes (S-MH-6).
    const info = await getMediaInfo(media.metaMediaId)

    const mime = normalizeMime(info.mimeType) ?? normalizeMime(media.mimeType)
    if (!isStorableMime(mime)) {
      await terminal(media.id, "UNSUPPORTED", "Tipo de archivo no permitido")
      safeLog("warn", "media.unsupported", log)
      return "unsupported"
    }
    if (info.fileSize !== null && info.fileSize > maxBytes) {
      await terminal(media.id, "TOO_LARGE", "El archivo excede el tamaño máximo", { sizeBytes: info.fileSize })
      safeLog("warn", "media.too_large", { ...log, sizeBytes: info.fileSize })
      return "too-large"
    }

    const { bytes } = await downloadMedia(info.url, { maxBytes })

    const expected = info.sha256 ?? media.sha256
    if (expected && !checksumMatches(expected, bytes)) {
      // Corrupted in transit: treated as retryable so the next attempt downloads again.
      throw new CloudApiError("Media checksum mismatch", null, null, true)
    }

    const key = buildMediaKey(media.message.conversationId, media.message.id, media.metaMediaId, mime)
    await putObject(key, bytes, mime)

    const { count } = await prisma.whatsAppMedia.updateMany({
      where: { id: media.id, status: "PENDING" },
      data: {
        status: "STORED",
        s3Key: key,
        mimeType: mime,
        sizeBytes: bytes.byteLength,
        sha256: sha256Hex(bytes),
        failureReason: null,
      },
    })
    if (count === 0) return "skipped" // a concurrent run finished first; same key, same bytes

    safeLog("info", "media.stored", { ...log, sizeBytes: bytes.byteLength })
    if ((mime.startsWith("audio/") || media.message.type === "AUDIO") && audioStoredPort) {
      try {
        await audioStoredPort(media.message.id)
      } catch {
        safeLog("error", "media.audio_port_failed", log)
      }
    }
    return "stored"
  } catch (error) {
    if (error instanceof CloudApiError && error.message === MEDIA_TOO_LARGE_MESSAGE) {
      await terminal(media.id, "TOO_LARGE", "El archivo excede el tamaño máximo")
      safeLog("warn", "media.too_large", log)
      return "too-large"
    }
    const retryable = error instanceof CloudApiError ? error.retryable : true // R2 and unknown errors: try again
    if (retryable && !context.isLastAttempt) {
      safeLog("warn", "media.retry", { ...log, status: error instanceof CloudApiError ? error.status : null })
      throw error // pg-boss retries with backoff and a fresh URL
    }
    const code = error instanceof CloudApiError ? (error.code ?? error.status ?? "red") : "almacenamiento"
    await terminal(media.id, "FAILED", `No se pudo descargar el archivo (${code})`)
    safeLog("error", "media.failed", { ...log, status: error instanceof CloudApiError ? error.status : null })
    return "failed"
  }
}

function retryLimitFor(queue: string): number {
  return QUEUE_DEFINITIONS.find((definition) => definition.name === queue)?.retryLimit ?? 0
}

/** `wa.media.download` handler. */
export async function handleMediaJobs(jobs: Job<MediaJobData>[]): Promise<void> {
  if (!isWhatsAppEnabled()) return // WC-12: store-only while the channel is off
  const retryLimit = retryLimitFor(QUEUES.MEDIA_DOWNLOAD)
  for (const job of jobs) {
    await downloadInboundMedia(job.data, { isLastAttempt: job.retryCount >= retryLimit })
  }
}
