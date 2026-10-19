/**
 * Log hygiene for the WhatsApp module (WC-15, threat row "PII in logs").
 *
 * Logs may carry ids, counts and codes. They must never carry message bodies, captions,
 * transcripts, tokens, secrets, signed URLs or full phone numbers. `safeLog` enforces that by
 * key name and by scrubbing string values, so a careless field cannot leak.
 */

const REDACTED = "[redacted]"
/** Field names whose value is content or a credential: never logged, whatever they hold. */
const SENSITIVE_KEY = /(body|text|transcript|caption|token|secret|authorization|password|payload|signature|url|key)/i
/** Field names that hold a phone number or WhatsApp id: logged masked. */
const PHONE_KEY = /(phone|waid|wa_id|msisdn|^to$|^from$)/i

/** Keeps only the last 4 digits: "573001234567" becomes "***4567". Nothing usable yields "***". */
export function maskPhone(value: string | null | undefined): string {
  const digits = (value ?? "").replace(/\D/g, "")
  return digits.length >= 4 ? `***${digits.slice(-4)}` : "***"
}

/** Masks long digit runs (phone-like) and credentials inside free text. */
export function scrubText(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, `Bearer ${REDACTED}`)
    .replace(/https?:\/\/\S+/gi, REDACTED)
    .replace(/\+?\d[\d\s-]{5,}\d/g, (match) => maskPhone(match))
}

function sanitizeValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEY.test(key)) return REDACTED
  if (PHONE_KEY.test(key)) return typeof value === "string" || typeof value === "number" ? maskPhone(String(value)) : REDACTED
  if (typeof value === "string") return scrubText(value).slice(0, 200)
  if (typeof value === "number" || typeof value === "boolean" || value === null || value === undefined) return value
  return REDACTED // objects and arrays could hide content; log ids or counts instead
}

export function sanitizeFields(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, sanitizeValue(key, value)]))
}

export type LogLevel = "info" | "warn" | "error"

/** One structured line: `[whatsapp] <event> {"field":"value"}`. */
export function safeLog(level: LogLevel, event: string, fields: Record<string, unknown> = {}): void {
  const line = `[whatsapp] ${scrubText(event)} ${JSON.stringify(sanitizeFields(fields))}`
  if (level === "error") console.error(line)
  else if (level === "warn") console.warn(line)
  else console.info(line)
}
