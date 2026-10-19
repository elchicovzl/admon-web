import { describe, expect, it } from "vitest"
import { malformedWebhookItem, sha256Hex, splitWebhookPayload } from "../split-payload"
import { fixtures } from "./fixtures"

describe("splitWebhookPayload", () => {
  it.each([
    ["text", fixtures.text, "msg:wamid.TEXT1"],
    ["audio", fixtures.audio, "msg:wamid.AUDIO1"],
    ["image", fixtures.image, "msg:wamid.IMG1"],
    ["unsupported type", fixtures.unsupported, "msg:wamid.STICK1"],
  ])("keys a %s message by wamid", (_name, body, dedupKey) => {
    const [item, ...rest] = splitWebhookPayload(body)
    expect(rest).toHaveLength(0)
    expect(item).toMatchObject({ kind: "MESSAGE", dedupKey })
    expect(item.wamid).toBe(dedupKey.slice(4))
  })

  it.each([
    ["sent", fixtures.statusSent],
    ["delivered", fixtures.statusDelivered],
    ["read", fixtures.statusRead],
    ["failed", fixtures.statusFailed],
  ])("keys a %s status by wamid and status", (status, body) => {
    const [item] = splitWebhookPayload(body)
    expect(item).toMatchObject({ kind: "STATUS", dedupKey: `status:wamid.OUT1:${status}`, wamid: "wamid.OUT1" })
  })

  it("keeps the failure error code inside the stored status item", () => {
    const [item] = splitWebhookPayload(fixtures.statusFailed)
    expect(JSON.stringify(item.payload)).toContain("131047")
  })

  it("keys an echo by wamid", () => {
    const [item] = splitWebhookPayload(fixtures.echo)
    expect(item).toMatchObject({ kind: "ECHO", dedupKey: "echo:wamid.ECHO1", wamid: "wamid.ECHO1" })
  })

  it("stores each message with its contact/metadata context", () => {
    const [item] = splitWebhookPayload(fixtures.text)
    expect(item.payload).toMatchObject({
      metadata: { phone_number_id: "PNID" },
      contacts: [{ wa_id: "573001234567" }],
      item: { id: "wamid.TEXT1" },
    })
  })

  it("splits multi-entry payloads into one item per message/status", () => {
    const items = splitWebhookPayload(fixtures.multiEntry)
    expect(items.map((item) => item.dedupKey)).toEqual([
      "msg:wamid.A",
      "msg:wamid.B",
      "status:wamid.OUT1:sent",
    ])
  })

  it("keeps unknown change fields as OTHER with a content hash key", () => {
    const [item, ...rest] = splitWebhookPayload(fixtures.unknown)
    expect(rest).toHaveLength(0)
    expect(item.kind).toBe("OTHER")
    expect(item.dedupKey).toMatch(/^other:[0-9a-f]{64}$/)
    expect(item.wamid).toBeNull()
  })

  it("gives identical unknown items identical keys (idempotent) and different ones different keys", () => {
    const a = splitWebhookPayload(fixtures.unknown)[0].dedupKey
    expect(splitWebhookPayload(structuredClone(fixtures.unknown))[0].dedupKey).toBe(a)
    expect(splitWebhookPayload(fixtures.malformed)[0].dedupKey).not.toBe(a)
  })

  it("never throws on a structurally invalid envelope", () => {
    expect(splitWebhookPayload(fixtures.malformed)).toHaveLength(1)
    for (const body of [null, 42, "text", [], {}, { entry: [] }, { entry: [{ changes: "x" }] }]) {
      const items = splitWebhookPayload(body)
      expect(items).toHaveLength(1)
      expect(items[0].kind).toBe("OTHER")
    }
  })

  it("turns a message without an id into an OTHER item instead of dropping it", () => {
    const body = structuredClone(fixtures.text) as { entry: { changes: { value: { messages: object[] } }[] }[] }
    body.entry[0].changes[0].value.messages = [{ type: "text" }]
    expect(splitWebhookPayload(body)[0].kind).toBe("OTHER")
  })
})

describe("malformedWebhookItem", () => {
  it("records only the hash and size, never the body", () => {
    const raw = Buffer.from("not json {{ secret-ish")
    const item = malformedWebhookItem(raw)
    expect(item.kind).toBe("OTHER")
    expect(item.dedupKey).toBe(`other:${sha256Hex(raw)}`)
    expect(JSON.stringify(item.payload)).not.toContain("secret-ish")
    expect(item.payload).toEqual({ malformed: true, bytes: raw.byteLength })
  })
})
