import { timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { enqueueEvent, isWhatsAppEnabled, storeWebhookItems } from "@/lib/whatsapp/ingest"
import { verifySignature } from "@/lib/whatsapp/signature"
import {
  malformedWebhookItem,
  sha256Hex,
  splitWebhookPayload,
  type WebhookItem,
} from "@/lib/whatsapp/split-payload"

/**
 * Meta WhatsApp webhook. This is a documented exception to "no API routes": an
 * external caller cannot use a Server Action. It sits outside the middleware
 * matcher (`/api` is excluded) and authenticates ONLY by signature.
 *
 * It does no business logic: verify, split, store, best-effort enqueue, 200.
 */
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Meta payloads are small; anything bigger is not a legitimate delivery. */
export const MAX_BODY_BYTES = 1_048_576

function safeEqual(a: string, b: string): boolean {
  // Compare fixed-length digests so neither the content nor the length leaks.
  return timingSafeEqual(Buffer.from(sha256Hex(a), "hex"), Buffer.from(sha256Hex(b), "hex"))
}

/** Reads the raw body without ever buffering more than the cap. Returns null when too large. */
async function readRawBody(request: Request): Promise<Uint8Array | null> {
  const declared = Number(request.headers.get("content-length"))
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return null

  const reader = request.body?.getReader()
  if (!reader) return new Uint8Array(0)

  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_BODY_BYTES) {
      await reader.cancel().catch(() => undefined)
      return null
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks)
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const expected = process.env.WHATSAPP_VERIFY_TOKEN?.trim()
  const provided = params.get("hub.verify_token")

  if (
    !expected ||
    params.get("hub.mode") !== "subscribe" ||
    provided === null ||
    !safeEqual(provided, expected)
  ) {
    return new NextResponse("Forbidden", { status: 403 })
  }

  const challenge = params.get("hub.challenge")
  if (!challenge) return new NextResponse("Bad Request", { status: 400 })

  return new NextResponse(challenge, {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8" },
  })
}

export async function POST(request: Request) {
  const appSecret = process.env.WHATSAPP_APP_SECRET?.trim()
  if (!appSecret) {
    console.error("[whatsapp] webhook received but WHATSAPP_APP_SECRET is not configured")
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 })
  }

  const rawBody = await readRawBody(request)
  if (rawBody === null) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 })
  }

  // Nothing is parsed, stored or enqueued before this check passes (WC-2).
  if (!verifySignature(rawBody, request.headers.get("x-hub-signature-256"), appSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  const payloadHash = sha256Hex(rawBody)
  let items: WebhookItem[]
  let lastError: string | undefined
  try {
    items = splitWebhookPayload(JSON.parse(Buffer.from(rawBody).toString("utf8")))
  } catch {
    items = [malformedWebhookItem(rawBody)]
    lastError = "Invalid JSON body"
  }

  let newEventIds: string[]
  try {
    ;({ newEventIds } = await storeWebhookItems(items, payloadHash, lastError))
  } catch (error) {
    // Nothing was acknowledged, so Meta redelivers.
    console.error("[whatsapp] failed to store webhook items:", error instanceof Error ? error.name : "unknown")
    return NextResponse.json({ error: "Storage failure" }, { status: 500 })
  }

  // Flag off: store-only, never touch pg-boss (WC-12, S-WC-10).
  if (isWhatsAppEnabled()) {
    await Promise.all(newEventIds.map((id) => enqueueEvent(id)))
  }

  return NextResponse.json({ ok: true })
}
