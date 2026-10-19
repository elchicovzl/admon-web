import { createHmac, timingSafeEqual } from "node:crypto"

const SIGNATURE_PATTERN = /^sha256=([0-9a-f]{64})$/i

/**
 * Verifies Meta's `X-Hub-Signature-256` header (HMAC-SHA256 of the RAW body keyed
 * with the app secret). The caller must pass the bytes exactly as received: any
 * parse/re-serialize round trip invalidates the signature.
 *
 * The compare is constant-time; the length is checked first because
 * `timingSafeEqual` throws on unequal lengths.
 */
export function verifySignature(
  rawBody: string | Uint8Array,
  header: string | null | undefined,
  appSecret: string
): boolean {
  if (!header || !appSecret) return false

  const match = SIGNATURE_PATTERN.exec(header.trim())
  if (!match) return false

  const received = Buffer.from(match[1], "hex")
  const expected = createHmac("sha256", appSecret).update(rawBody).digest()
  if (received.length !== expected.length) return false

  return timingSafeEqual(received, expected)
}
