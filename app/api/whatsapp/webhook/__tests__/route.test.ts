import { createHmac } from "node:crypto"
import { Prisma } from "@prisma/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fixtures } from "@/lib/whatsapp/__tests__/fixtures"

const { createMany, findMany, send, getBoss } = vi.hoisted(() => ({
  createMany: vi.fn(),
  findMany: vi.fn(),
  send: vi.fn(),
  getBoss: vi.fn(),
}))
vi.mock("@/lib/db/prisma", () => ({
  default: { whatsAppWebhookEvent: { createMany, findMany } },
}))
vi.mock("@/lib/queue/boss", () => ({ getBoss }))

import { GET, MAX_BODY_BYTES, POST } from "../route"

const SECRET = "test-app-secret"
const VERIFY = "test-verify-token"
const URL_BASE = "http://localhost/api/whatsapp/webhook"

function sign(body: string, secret = SECRET) {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`
}

function post(body: string, headers: Record<string, string> = { "x-hub-signature-256": sign(body) }) {
  return POST(new Request(URL_BASE, { method: "POST", body, headers }))
}

function get(query: Record<string, string>) {
  return GET(new Request(`${URL_BASE}?${new URLSearchParams(query)}`))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.stubEnv("WHATSAPP_APP_SECRET", SECRET)
  vi.stubEnv("WHATSAPP_VERIFY_TOKEN", VERIFY)
  vi.stubEnv("WHATSAPP_ENABLED", "true")
  getBoss.mockResolvedValue({ send })
  send.mockResolvedValue("job-id")
  // Default: every row is newly inserted.
  createMany.mockImplementation(async ({ data }: { data: unknown[] }) => ({ count: data.length }))
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe("GET verification (S-WC-1)", () => {
  it("echoes the challenge as text/plain for a matching token", async () => {
    const res = await get({ "hub.mode": "subscribe", "hub.verify_token": VERIFY, "hub.challenge": "12345" })
    expect(res.status).toBe(200)
    expect(await res.text()).toBe("12345")
    expect(res.headers.get("content-type")).toContain("text/plain")
  })

  it("answers 403 for a wrong token", async () => {
    const res = await get({ "hub.mode": "subscribe", "hub.verify_token": "nope", "hub.challenge": "12345" })
    expect(res.status).toBe(403)
    expect(await res.text()).not.toContain("12345")
  })

  it("answers 403 for a missing token or a wrong mode", async () => {
    expect((await get({ "hub.mode": "subscribe", "hub.challenge": "1" })).status).toBe(403)
    expect(
      (await get({ "hub.mode": "unsubscribe", "hub.verify_token": VERIFY, "hub.challenge": "1" })).status
    ).toBe(403)
  })

  it("answers 403 when no verify token is configured, even for an empty token", async () => {
    vi.stubEnv("WHATSAPP_VERIFY_TOKEN", "")
    const res = await get({ "hub.mode": "subscribe", "hub.verify_token": "", "hub.challenge": "1" })
    expect(res.status).toBe(403)
  })
})

describe("POST signature (S-WC-2, S-WC-3)", () => {
  const body = JSON.stringify(fixtures.text)

  it("rejects an invalid signature with 401 and touches nothing", async () => {
    const res = await post(body, { "x-hub-signature-256": sign(body, "attacker-secret") })
    expect(res.status).toBe(401)
    expect(createMany).not.toHaveBeenCalled()
    expect(getBoss).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
  })

  it("rejects a missing signature header with 401", async () => {
    const res = await post(body, {})
    expect(res.status).toBe(401)
    expect(createMany).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
  })

  it("rejects a valid signature of a different body (tampered payload)", async () => {
    const res = await post(`${body} `, { "x-hub-signature-256": sign(body) })
    expect(res.status).toBe(401)
    expect(createMany).not.toHaveBeenCalled()
  })

  it("answers 503 and stores nothing when the app secret is not configured", async () => {
    vi.stubEnv("WHATSAPP_APP_SECRET", "")
    const res = await post(body)
    expect(res.status).toBe(503)
    expect(createMany).not.toHaveBeenCalled()
  })
})

describe("POST body size", () => {
  it("rejects an oversized declared Content-Length with 413 before reading the body", async () => {
    const res = await post("{}", {
      "content-length": String(MAX_BODY_BYTES + 1),
      "x-hub-signature-256": sign("{}"),
    })
    expect(res.status).toBe(413)
    expect(createMany).not.toHaveBeenCalled()
  })

  it("rejects an oversized actual body with 413 even with a valid signature", async () => {
    const big = "x".repeat(MAX_BODY_BYTES + 1)
    const res = await post(big)
    expect(res.status).toBe(413)
    expect(createMany).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
  })

  it("accepts a body exactly at the limit (then fails only on signature or parsing, never size)", async () => {
    const res = await post("x".repeat(MAX_BODY_BYTES))
    expect(res.status).toBe(200) // valid signature, malformed JSON stored as one OTHER row
  })
})

describe("POST storage and enqueue (S-WC-4, S-WC-5)", () => {
  it("stores with skipDuplicates then enqueues only the new ids and returns 200", async () => {
    const body = JSON.stringify(fixtures.multiEntry)
    const res = await post(body)

    expect(res.status).toBe(200)
    const arg = createMany.mock.calls[0][0]
    expect(arg.skipDuplicates).toBe(true)
    expect(arg.data.map((row: { dedupKey: string }) => row.dedupKey)).toEqual([
      "msg:wamid.A",
      "msg:wamid.B",
      "status:wamid.OUT1:sent",
    ])
    expect(arg.data.every((row: { payloadHash: string }) => /^[0-9a-f]{64}$/.test(row.payloadHash))).toBe(true)
    expect(send).toHaveBeenCalledTimes(3)
    const queuedIds = send.mock.calls.map((call) => call[1].eventId)
    expect(queuedIds).toEqual(arg.data.map((row: { id: string }) => row.id))
    expect(send.mock.calls[0][0]).toBe("wa.event.process")
    expect(send.mock.calls[0][2]).toMatchObject({ singletonKey: queuedIds[0] })
  })

  it("answers 200 twice for a duplicate delivery and enqueues only once", async () => {
    const body = JSON.stringify(fixtures.text)
    await post(body)
    createMany.mockResolvedValueOnce({ count: 0 }) // second delivery: dedupKey already stored

    const second = await post(body)

    expect(second.status).toBe(200)
    expect(createMany).toHaveBeenCalledTimes(2)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it("enqueues only the rows this delivery actually inserted when part of the batch is a replay", async () => {
    const body = JSON.stringify(fixtures.multiEntry)
    createMany.mockImplementationOnce(async () => ({ count: 1 }))
    findMany.mockImplementationOnce(async ({ where }: { where: { id: { in: string[] } } }) => [
      { id: where.id.in[2] },
    ])

    const res = await post(body)

    expect(res.status).toBe(200)
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][1].eventId).toBe(findMany.mock.calls[0][0].where.id.in[2])
  })

  it("answers 200 for two concurrent deliveries of the same event (unique constraint race)", async () => {
    const body = JSON.stringify(fixtures.text)
    createMany.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "test" })
    )

    const res = await post(body)

    expect(res.status).toBe(200)
    expect(send).not.toHaveBeenCalled()
  })

  it("answers 500 (so Meta redelivers) when storage itself fails", async () => {
    createMany.mockRejectedValueOnce(new Error("db down"))
    const res = await post(JSON.stringify(fixtures.text))
    expect(res.status).toBe(500)
    expect(send).not.toHaveBeenCalled()
  })

  it("still answers 200 when the best-effort enqueue fails (the sweeper is the backstop)", async () => {
    send.mockRejectedValue(new Error("queue down"))
    const res = await post(JSON.stringify(fixtures.text))
    expect(res.status).toBe(200)
  })

  it("stores one OTHER row with lastError for a malformed body with a valid signature", async () => {
    const res = await post("{ not json")

    expect(res.status).toBe(200)
    const rows = createMany.mock.calls[0][0].data
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ kind: "OTHER", lastError: "Invalid JSON body" })
    expect(JSON.stringify(rows[0].payload)).not.toContain("not json")
  })
})

describe("WHATSAPP_ENABLED off (S-WC-10, WC-12)", () => {
  it.each([undefined, "", "false"])("stores and acknowledges without touching pg-boss (flag %j)", async (flag) => {
    if (flag === undefined) vi.stubEnv("WHATSAPP_ENABLED", undefined as unknown as string)
    else vi.stubEnv("WHATSAPP_ENABLED", flag)

    const res = await post(JSON.stringify(fixtures.text))

    expect(res.status).toBe(200)
    expect(createMany).toHaveBeenCalledTimes(1)
    expect(getBoss).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
  })

  it("still verifies the signature while off", async () => {
    vi.stubEnv("WHATSAPP_ENABLED", "false")
    const body = JSON.stringify(fixtures.text)
    const res = await post(body, { "x-hub-signature-256": sign(body, "bad") })
    expect(res.status).toBe(401)
    expect(createMany).not.toHaveBeenCalled()
  })
})

describe("logging hygiene (WC-15)", () => {
  it("never logs the secret, the signature or message content", async () => {
    const logs = [vi.spyOn(console, "error"), vi.spyOn(console, "warn"), vi.spyOn(console, "info"), vi.spyOn(console, "log")]
    createMany.mockRejectedValueOnce(new Error("db down"))
    send.mockRejectedValue(new Error("queue down"))
    const body = JSON.stringify(fixtures.text)

    await post(body)
    createMany.mockImplementation(async ({ data }: { data: unknown[] }) => ({ count: data.length }))
    await post(body)

    const output = JSON.stringify(logs.flatMap((spy) => spy.mock.calls))
    for (const secret of [SECRET, sign(body), "Hola", "573001234567"]) {
      expect(output).not.toContain(secret)
    }
  })
})
