import { processInboundMessage } from "./inbound"
import type { ProcessOutcome, StoredWebhookEvent } from "./event-worker"
import { parseMetaStatus, recordAndApplyStatus } from "./statuses"
import { asRecord, parseTimestamp } from "./utils"


async function processStatus(payload: unknown, receivedAt: Date): Promise<void> {
  const item = asRecord(asRecord(payload)?.item)
  const wamid = typeof item?.id === "string" ? item.id : null
  const status = typeof item?.status === "string" ? parseMetaStatus(item.status) : null
  if (!item || !wamid || !status) return // untracked status (e.g. "deleted"): nothing to apply

  const error = Array.isArray(item.errors) ? asRecord(item.errors[0]) : null
  await recordAndApplyStatus({
    wamid,
    status,
    timestamp: parseTimestamp(item.timestamp, receivedAt),
    errorCode: error?.code != null ? String(error.code) : null,
    errorTitle: typeof error?.title === "string" ? error.title : null,
  })
}

/**
 * Dispatches one stored webhook item by kind. Plugged into `wa.event.process` through
 * `setEventProcessor`. Throwing leaves the raw event intact for retry (S-WC-9).
 * ECHO is deferred (left unprocessed) until the echo handler exists so no echo is lost;
 * OTHER has nothing to process.
 */
export async function processWebhookEvent(
  event: StoredWebhookEvent,
  receivedAt: Date = new Date()
): Promise<ProcessOutcome> {
  switch (event.kind) {
    case "MESSAGE":
      return processInboundMessage(event.payload, receivedAt)
    case "STATUS":
      return processStatus(event.payload, receivedAt)
    case "ECHO":
      return "deferred"
    default:
      return
  }
}
