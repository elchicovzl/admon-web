import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const TOKEN = "EAAG-super-secret-token"
const config = vi.hoisted(() => ({
  value: {
    accessToken: "EAAG-super-secret-token",
    phoneNumberId: "PNID",
    graphVersion: "v25.0" as string | undefined,
  },
}))
vi.mock("@/lib/config/runtime-config", () => ({ getWhatsAppConfig: () => config.value }))

import {
  CloudApiError,
  downloadMedia,
  getMediaInfo,
  sendMedia,
  sendTemplate,
  sendText,
} from "../cloud-api"

const fetchMock = vi.fn()

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } })
}

function lastCall() {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit]
  return { url, init, headers: init.headers as Record<string, string> }
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
  config.value = { accessToken: TOKEN, phoneNumberId: "PNID", graphVersion: "v25.0" }
})
afterEach(() => vi.unstubAllGlobals())

describe("sendText", () => {
  it("posts to the versioned Graph URL with the Bearer token and returns the wamid (WC-11)", async () => {
    fetchMock.mockResolvedValue(json({ messages: [{ id: "wamid.OUT1" }] }))

    const result = await sendText("573001234567", "Hola")

    const { url, init, headers } = lastCall()
    expect(url).toBe("https://graph.facebook.com/v25.0/PNID/messages")
    expect(init.method).toBe("POST")
    expect(headers.Authorization).toBe(`Bearer ${TOKEN}`)
    expect(JSON.parse(init.body as string)).toMatchObject({
      messaging_product: "whatsapp",
      to: "573001234567",
      type: "text",
      text: { body: "Hola" },
    })
    expect(result).toEqual({ wamid: "wamid.OUT1" })
  })

  it("uses the configured Graph version", async () => {
    config.value = { ...config.value, graphVersion: "v26.0" }
    fetchMock.mockResolvedValue(json({ messages: [{ id: "w" }] }))

    await sendText("573001234567", "Hola")

    expect(lastCall().url).toBe("https://graph.facebook.com/v26.0/PNID/messages")
  })

  it("quotes the replied-to message when a context wamid is given", async () => {
    fetchMock.mockResolvedValue(json({ messages: [{ id: "w" }] }))

    await sendText("573001234567", "Hola", { contextWamid: "wamid.IN1" })

    expect(JSON.parse(lastCall().init.body as string).context).toEqual({ message_id: "wamid.IN1" })
  })

  it("treats a 2xx response without a message id as a permanent failure", async () => {
    fetchMock.mockResolvedValue(json({ messages: [] }))

    await expect(sendText("573001234567", "Hola")).rejects.toMatchObject({ retryable: false })
  })
})

describe("sendTemplate", () => {
  it("builds the template payload with language and positional body params", async () => {
    fetchMock.mockResolvedValue(json({ messages: [{ id: "wamid.T1" }] }))

    await sendTemplate("573001234567", { name: "resume_conversation", language: "es", params: ["Ana", "123"] })

    expect(JSON.parse(lastCall().init.body as string)).toMatchObject({
      type: "template",
      template: {
        name: "resume_conversation",
        language: { code: "es" },
        components: [
          { type: "body", parameters: [{ type: "text", text: "Ana" }, { type: "text", text: "123" }] },
        ],
      },
    })
  })

  it("omits components for a template without variables", async () => {
    fetchMock.mockResolvedValue(json({ messages: [{ id: "wamid.T2" }] }))

    await sendTemplate("573001234567", { name: "hello", language: "es", params: [] })

    expect(JSON.parse(lastCall().init.body as string).template).not.toHaveProperty("components")
  })
})

describe("sendMedia", () => {
  it("uploads the bytes, then sends by media id", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ id: "MEDIA1" }))
      .mockResolvedValueOnce(json({ messages: [{ id: "wamid.M1" }] }))

    const result = await sendMedia("573001234567", {
      kind: "document",
      bytes: new Uint8Array([1, 2, 3]),
      mimeType: "application/pdf",
      fileName: "cert.pdf",
      caption: "Su certificado",
    })

    const [upload, send] = fetchMock.mock.calls as [string, RequestInit][]
    expect(upload[0]).toBe("https://graph.facebook.com/v25.0/PNID/media")
    expect(upload[1].body).toBeInstanceOf(FormData)
    expect(send[0]).toBe("https://graph.facebook.com/v25.0/PNID/messages")
    expect(JSON.parse(send[1].body as string)).toMatchObject({
      type: "document",
      document: { id: "MEDIA1", caption: "Su certificado", filename: "cert.pdf" },
    })
    expect(result).toEqual({ wamid: "wamid.M1" })
  })

  it("fails permanently when the upload returns no media id", async () => {
    fetchMock.mockResolvedValueOnce(json({}))

    await expect(
      sendMedia("573001234567", { kind: "image", bytes: new Uint8Array([1]), mimeType: "image/png" })
    ).rejects.toMatchObject({ retryable: false })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe("getMediaInfo", () => {
  it("resolves a media id to a fresh URL with metadata", async () => {
    fetchMock.mockResolvedValue(
      json({ url: "https://lookaside.fbsbx.com/x", mime_type: "audio/ogg", sha256: "abc", file_size: 2048 })
    )

    const info = await getMediaInfo("MEDIA1")

    expect(lastCall().url).toBe("https://graph.facebook.com/v25.0/MEDIA1")
    expect(lastCall().init.method).toBe("GET")
    expect(info).toEqual({ url: "https://lookaside.fbsbx.com/x", mimeType: "audio/ogg", sha256: "abc", fileSize: 2048 })
  })
})

describe("downloadMedia", () => {
  it("downloads with the Bearer token", async () => {
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array([9, 8, 7]), { status: 200, headers: { "content-type": "audio/ogg" } })
    )

    const media = await downloadMedia("https://lookaside.fbsbx.com/x")

    expect(lastCall().url).toBe("https://lookaside.fbsbx.com/x")
    expect(lastCall().headers.Authorization).toBe(`Bearer ${TOKEN}`)
    expect(Array.from(media.bytes)).toEqual([9, 8, 7])
    expect(media.contentType).toBe("audio/ogg")
  })

  it("rejects oversize files before reading the body", async () => {
    fetchMock.mockResolvedValue(new Response("x", { status: 200, headers: { "content-length": "5000" } }))

    await expect(downloadMedia("https://lookaside.fbsbx.com/x", { maxBytes: 1000 })).rejects.toMatchObject({
      retryable: false,
    })
  })

  it("never sends the token over plain HTTP or to a non-URL", async () => {
    await expect(downloadMedia("http://lookaside.fbsbx.com/x")).rejects.toBeInstanceOf(CloudApiError)
    await expect(downloadMedia("not a url")).rejects.toBeInstanceOf(CloudApiError)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("error classification (WC-10)", () => {
  it.each([429, 500, 502, 503])("treats HTTP %s as retryable", async (status) => {
    fetchMock.mockResolvedValue(json({ error: { message: "slow down", code: 4 } }, status))

    await expect(sendText("573001234567", "Hola")).rejects.toMatchObject({ retryable: true, status })
  })

  it.each([400, 401, 403, 404])("treats HTTP %s as permanent", async (status) => {
    fetchMock.mockResolvedValue(json({ error: { message: "bad", code: 100 } }, status))

    await expect(sendText("573001234567", "Hola")).rejects.toMatchObject({ retryable: false, status })
  })

  it("exposes Meta's error code", async () => {
    fetchMock.mockResolvedValue(json({ error: { message: "Re-engagement message", code: 131047 } }, 400))

    await expect(sendText("573001234567", "Hola")).rejects.toMatchObject({ code: "131047" })
  })

  it("treats network failures as retryable", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"))

    await expect(sendText("573001234567", "Hola")).rejects.toMatchObject({ retryable: true, status: null })
  })

  it("survives a non-JSON error body", async () => {
    fetchMock.mockResolvedValue(new Response("<html>bad gateway</html>", { status: 502 }))

    await expect(sendText("573001234567", "Hola")).rejects.toMatchObject({ retryable: true, status: 502 })
  })
})

describe("token hygiene (WC-15)", () => {
  it("never leaks the token into thrown errors, even when Meta echoes it", async () => {
    fetchMock.mockResolvedValue(json({ error: { message: `Invalid token ${TOKEN}`, code: 190 } }, 401))

    const error = await sendText("573001234567", "Hola").catch((e: unknown) => e as Error)

    expect(error).toBeInstanceOf(CloudApiError)
    expect(JSON.stringify({ message: (error as Error).message, stack: (error as Error).stack })).not.toContain(TOKEN)
    expect((error as Error).message).toContain("[redacted]")
  })

  it("does not carry network error details that could echo the request", async () => {
    fetchMock.mockRejectedValue(new TypeError(`failed https://x?token=${TOKEN}`))

    const error = await sendText("573001234567", "Hola").catch((e: unknown) => e as Error)

    expect(JSON.stringify({ message: (error as Error).message, cause: (error as Error).cause })).not.toContain(TOKEN)
  })

  it("is permanent and clear when credentials are not configured", async () => {
    config.value = { accessToken: "", phoneNumberId: "PNID", graphVersion: "v25.0" }

    await expect(sendText("573001234567", "Hola")).rejects.toMatchObject({ retryable: false })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
