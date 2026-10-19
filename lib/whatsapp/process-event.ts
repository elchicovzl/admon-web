import { processInboundMessage } from "./inbound"
import type { StoredWebhookEvent } from "./event-worker"
import { parseMetaStatus, recordAndApplyStatus } from "./statuses"

type Json = Record<string, unknown>

function asRecord(value: unknown): Json | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : null
}

async function processStatus(payload: unknown, receivedAt: Date): Promise<void> {
  const item = asRecord(asRecord(payload)?.item)
  const wamid = typeof item?.id === "string" ? item.id : null
  const status = typeof item?.status === "string" ? parseMetaStatus(item.status) : null
  if (!item || !wamid || !status) return // untracked status (e.g. "deleted"): nothing to apply

  const seconds = Number(item.timestamp)
  const error = Array.isArray(item.errors) ? asRecord(item.errors[0]) : null
  await recordAndApplyStatus({
    wamid,
    status,
    timestamp: Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000) : receivedAt,
    errorCode: error?.code != null ? String(error.code) : null,
    errorTitle: typeof error?.title === "string" ? error.title : null,
  })
}

/**
 * Dispatches one stored webhook item by kind. Plugged into `wa.event.process` through
 * `setEventProcessor`. Throwing leaves the raw event intact for retry (S-WC-9).
 * ECHO is stored raw only until PR1.4 reconciles it; OTHER has nothing to process.
 */
export async function processWebhookEvent(
  event: StoredWebhookEvent,
  receivedAt: Date = new Date()
): Promise<void> {
  switch (event.kind) {
    case "MESSAGE":
      return processInboundMessage(event.payload, receivedAt)
    case "STATUS":
      return processStatus(event.payload, receivedAt)
    default:
      return
  }
}
