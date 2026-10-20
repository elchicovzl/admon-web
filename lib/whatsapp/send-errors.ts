/**
 * Error codes stored on FAILED outbound messages (alongside Meta's numeric codes). Kept free of
 * server imports so the inbox UI can recognise them (for example to ask for confirmation before
 * resending an unconfirmed delivery).
 */
export const SendErrorCode = {
  WINDOW_CLOSED: "WINDOW_CLOSED",
  STALE_STATE: "STALE_STATE",
  RETRIES_EXHAUSTED: "RETRIES_EXHAUSTED",
  QUEUE_UNAVAILABLE: "QUEUE_UNAVAILABLE",
  INVALID_MESSAGE: "INVALID_MESSAGE",
  /** Meta may or may not have accepted the message; never resent automatically (at-most-once). */
  UNKNOWN_DELIVERY: "UNKNOWN_DELIVERY",
} as const
