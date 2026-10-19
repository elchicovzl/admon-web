import { createHash } from "node:crypto"
import type { WebhookItemKind } from "@prisma/client"
import {
  changeValueSchema,
  echoSchema,
  messageSchema,
  statusSchema,
  webhookEnvelopeSchema,
} from "./payload.schema"

export interface WebhookItem {
  kind: WebhookItemKind
  /** Unique per logical event: msg:<wamid> | status:<wamid>:<status> | echo:<wamid> | other:<sha256>. */
  dedupKey: string
  wamid: string | null
  /** The single item plus the metadata/contacts context of its change. */
  payload: Record<string, unknown>
}

export function sha256Hex(input: string | Uint8Array): string {
  return createHash("sha256").update(input).digest("hex")
}

function otherItem(payload: Record<string, unknown>): WebhookItem {
  return {
    kind: "OTHER",
    dedupKey: `other:${sha256Hex(JSON.stringify(payload))}`,
    wamid: null,
    payload,
  }
}

/**
 * Stand-in for a body that signed correctly but is not JSON. The content is NOT
 * stored (it may carry personal data and is unusable anyway); only its hash and size.
 */
export function malformedWebhookItem(rawBody: Uint8Array): WebhookItem {
  return {
    kind: "OTHER",
    dedupKey: `other:${sha256Hex(rawBody)}`,
    wamid: null,
    payload: { malformed: true, bytes: rawBody.byteLength },
  }
}

/**
 * Splits one webhook delivery into independently idempotent items. This is
 * structural parsing only: no business logic, no I/O. Never throws; whatever it
 * cannot classify is kept as an OTHER item so no signed delivery is dropped.
 */
export function splitWebhookPayload(body: unknown): WebhookItem[] {
  const envelope = webhookEnvelopeSchema.safeParse(body)
  if (!envelope.success || !envelope.data.entry?.length) {
    return [otherItem({ unrecognized: true, body })]
  }

  const items: WebhookItem[] = []

  for (const entry of envelope.data.entry) {
    for (const change of entry.changes ?? []) {
      const value = changeValueSchema.safeParse(change.value)
      if (!value.success) {
        items.push(otherItem({ field: change.field, value: change.value }))
        continue
      }

      const { messages, statuses, message_echoes: echoes, metadata, contacts } = value.data
      const context = { field: change.field, metadata, contacts }
      let recognized = false

      for (const raw of messages ?? []) {
        recognized = true
        const parsed = messageSchema.safeParse(raw)
        items.push(
          parsed.success
            ? { kind: "MESSAGE", dedupKey: `msg:${parsed.data.id}`, wamid: parsed.data.id, payload: { ...context, item: raw } }
            : otherItem({ ...context, item: raw })
        )
      }

      for (const raw of statuses ?? []) {
        recognized = true
        const parsed = statusSchema.safeParse(raw)
        items.push(
          parsed.success
            ? {
                kind: "STATUS",
                dedupKey: `status:${parsed.data.id}:${parsed.data.status}`,
                wamid: parsed.data.id,
                payload: { ...context, item: raw },
              }
            : otherItem({ ...context, item: raw })
        )
      }

      for (const raw of echoes ?? []) {
        recognized = true
        const parsed = echoSchema.safeParse(raw)
        items.push(
          parsed.success
            ? { kind: "ECHO", dedupKey: `echo:${parsed.data.id}`, wamid: parsed.data.id, payload: { ...context, item: raw } }
            : otherItem({ ...context, item: raw })
        )
      }

      if (!recognized) items.push(otherItem({ ...context, value: change.value }))
    }
  }

  return items.length > 0 ? items : [otherItem({ unrecognized: true, body })]
}
