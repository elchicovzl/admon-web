import type { MessageType } from "@prisma/client"

/**
 * What the AI assistant can do with an inbound attachment (MH-6). Pure. Anything it cannot
 * read is answered deterministically by the responder (S-MH-4/5), never guessed at.
 */

const MB = 1024 * 1024

export const MEDIA_POLICY_LIMITS = {
  /** Voice notes longer than this are not transcribed (cost and latency). */
  audioSeconds: 600,
  /** The speech-to-text API rejects larger uploads. */
  audioBytes: 25 * MB,
  imageBytes: 5 * MB,
  pdfBytes: 10 * MB,
} as const

export type MediaDecision = "TRANSCRIBE" | "VISION_IMAGE" | "VISION_PDF" | "UNSUPPORTED" | "TOO_LARGE"

const VISION_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])
/** Message kinds that never carry something the assistant can read. */
const UNREADABLE_MESSAGE_TYPES = new Set<MessageType>(["STICKER", "LOCATION", "CONTACTS", "VIDEO"])

const within = (size: number | null, limit: number) => size === null || size <= limit

export function classifyMedia(media: {
  mimeType: string
  sizeBytes: number | null
  durationSec?: number | null
  messageType?: MessageType
}): MediaDecision {
  if (media.messageType && UNREADABLE_MESSAGE_TYPES.has(media.messageType)) return "UNSUPPORTED"
  const mime = media.mimeType.toLowerCase().split(";")[0].trim()

  if (mime.startsWith("audio/")) {
    const tooLong = typeof media.durationSec === "number" && media.durationSec > MEDIA_POLICY_LIMITS.audioSeconds
    return tooLong || !within(media.sizeBytes, MEDIA_POLICY_LIMITS.audioBytes) ? "TOO_LARGE" : "TRANSCRIBE"
  }
  if (VISION_IMAGE_TYPES.has(mime)) {
    return within(media.sizeBytes, MEDIA_POLICY_LIMITS.imageBytes) ? "VISION_IMAGE" : "TOO_LARGE"
  }
  if (mime === "application/pdf") {
    return within(media.sizeBytes, MEDIA_POLICY_LIMITS.pdfBytes) ? "VISION_PDF" : "TOO_LARGE"
  }
  // Video, GIF and other animations, Office files and anything else.
  return "UNSUPPORTED"
}
