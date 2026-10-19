import { beforeEach, describe, expect, it, vi } from "vitest"
import { fixtures } from "./fixtures"
import { splitWebhookPayload } from "../split-payload"

const m = vi.hoisted(() => ({ processInboundMessage: vi.fn(), recordAndApplyStatus: vi.fn(), processEcho: vi.fn() }))
vi.mock("../echoes", () => ({ processEcho: m.processEcho }))
vi.mock("../inbound", () => ({ processInboundMessage: m.processInboundMessage }))
vi.mock("../statuses", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../statuses")>()),
  recordAndApplyStatus: m.recordAndApplyStatus,
}))

import { processWebhookEvent } from "../process-event"

const RECEIVED = new Date("2026-10-19T12:00:00Z")

function eventOf(fixture: unknown) {
  const [item] = splitWebhookPayload(fixture)
  return { id: "e1", kind: item.kind, wamid: item.wamid, payload: item.payload }
}

beforeEach(() => vi.clearAllMocks())

describe("processWebhookEvent", () => {
  it("dispatches MESSAGE items to inbound processing", async () => {
    const event = eventOf(fixtures.text)

    await processWebhookEvent(event, RECEIVED)

    expect(m.processInboundMessage).toHaveBeenCalledWith(event.payload, RECEIVED)
  })

  it("applies a delivered status", async () => {
    await processWebhookEvent(eventOf(fixtures.statusDelivered), RECEIVED)

    expect(m.recordAndApplyStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: "DELIVERED", errorCode: null, errorTitle: null })
    )
  })

  it("passes the error code and title of a failed status (S-WC-8)", async () => {
    await processWebhookEvent(eventOf(fixtures.statusFailed), RECEIVED)

    expect(m.recordAndApplyStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        wamid: "wamid.OUT1",
        status: "FAILED",
        errorCode: "131047",
        errorTitle: "Re-engagement message",
        timestamp: new Date(1760000001 * 1000),
      })
    )
  })

  it("ignores untracked statuses", async () => {
    const event = eventOf(fixtures.statusSent)
    ;(event.payload as { item: { status: string } }).item.status = "deleted"

    await processWebhookEvent(event, RECEIVED)

    expect(m.recordAndApplyStatus).not.toHaveBeenCalled()
  })

  it("hands ECHO items to echo reconciliation", async () => {
    const event = eventOf(fixtures.echo)

    await expect(processWebhookEvent(event, RECEIVED)).resolves.toBeUndefined()

    expect(m.processEcho).toHaveBeenCalledWith(event.payload, { eventId: "e1", receivedAt: RECEIVED })

    expect(m.processInboundMessage).not.toHaveBeenCalled()
    expect(m.recordAndApplyStatus).not.toHaveBeenCalled()
  })

  it.each([["unknown", fixtures.unknown]])("has nothing to do for %s items", async (_name, fixture) => {
    await expect(processWebhookEvent(eventOf(fixture), RECEIVED)).resolves.toBeUndefined()

    expect(m.processInboundMessage).not.toHaveBeenCalled()
    expect(m.recordAndApplyStatus).not.toHaveBeenCalled()
  })

  it("propagates processor errors so the raw event is retried (S-WC-9)", async () => {
    m.processInboundMessage.mockRejectedValue(new Error("boom"))

    await expect(processWebhookEvent(eventOf(fixtures.text), RECEIVED)).rejects.toThrow("boom")
  })
})
