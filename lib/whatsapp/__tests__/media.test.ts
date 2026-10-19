import { createHash } from "node:crypto"
import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  mediaFindUnique: vi.fn(),
  mediaUpdateMany: vi.fn(),
  getMediaInfo: vi.fn(),
  downloadMedia: vi.fn(),
  putObject: vi.fn(),
}))

vi.mock("@/lib/db/prisma", () => ({
  default: { whatsAppMedia: { findUnique: m.mediaFindUnique, updateMany: m.mediaUpdateMany } },
}))
vi.mock("@/lib/storage/r2", () => ({ putObject: m.putObject }))
vi.mock("@/lib/config/runtime-config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/config/runtime-config")>()),
  getWhatsAppConfig: () => ({ mediaMaxBytes: 1000 }),
}))
vi.mock("../cloud-api", async () => {
  const actual = await vi.importActual<typeof import("../cloud-api")>("../cloud-api")
  return { ...actual, getMediaInfo: m.getMediaInfo, downloadMedia: m.downloadMedia }
})

import { CloudApiError, MEDIA_TOO_LARGE_MESSAGE } from "../cloud-api"
import {
  buildMediaKey,
  downloadInboundMedia,
  handleMediaJobs,
  isStorableMime,
  normalizeMime,
  setAudioStoredPort,
} from "../media"

const BYTES = new Uint8Array([1, 2, 3, 4])
const HEX = createHash("sha256").update(BYTES).digest("hex")
const BASE64 = createHash("sha256").update(BYTES).digest("base64")
const META_URL = "https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=SECRET&ext=1&hash=abc"
const RETRYING = { isLastAttempt: false }
const LAST = { isLastAttempt: true }

function mediaRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "media-1",
    status: "PENDING",
    metaMediaId: "META123",
    mimeType: "image/jpeg",
    sha256: null,
    message: { id: "msg-1", conversationId: "conv-1", type: "IMAGE" },
    ...overrides,
  }
}

function updates() {
  return m.mediaUpdateMany.mock.calls.map(([arg]) => arg)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, "info").mockImplementation(() => {})
  vi.spyOn(console, "warn").mockImplementation(() => {})
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.stubEnv("WHATSAPP_ENABLED", "true")
  setAudioStoredPort(undefined)
  m.mediaFindUnique.mockResolvedValue(mediaRow())
  m.mediaUpdateMany.mockResolvedValue({ count: 1 })
  m.getMediaInfo.mockResolvedValue({ url: META_URL, mimeType: "image/jpeg", sha256: HEX, fileSize: 4 })
  m.downloadMedia.mockResolvedValue({ bytes: BYTES, contentType: "image/jpeg" })
  m.putObject.mockResolvedValue(undefined)
})

describe("helpers", () => {
  it("builds the key whatsapp/{conversationId}/{messageId}/{mediaId}.{ext}", () => {
    expect(buildMediaKey("c1", "m1", "ID42", "application/pdf")).toBe("whatsapp/c1/m1/ID42.pdf")
    expect(buildMediaKey("c1", "m1", "ID42", "audio/ogg")).toBe("whatsapp/c1/m1/ID42.ogg")
    expect(buildMediaKey("c1", "m1", "ID42", "application/x-unknown")).toBe("whatsapp/c1/m1/ID42.bin")
  })

  it("sanitizes the Meta id so it cannot escape the key prefix", () => {
    expect(buildMediaKey("c1", "m1", "../../etc/passwd", "image/png")).toBe("whatsapp/c1/m1/______etc_passwd.png")
  })

  it("normalizes content types and rejects malformed or active ones", () => {
    expect(normalizeMime("Audio/OGG; codecs=opus")).toBe("audio/ogg")
    expect(normalizeMime("not a mime")).toBeNull()
    expect(normalizeMime(undefined)).toBeNull()
    expect(isStorableMime("image/jpeg")).toBe(true)
    expect(isStorableMime("video/mp4")).toBe(true)
    expect(isStorableMime("text/html")).toBe(false)
    expect(isStorableMime("image/svg+xml")).toBe(false)
    expect(isStorableMime(null)).toBe(false)
  })
})

describe("downloadInboundMedia: success", () => {
  it("fetches a fresh URL by media id, stores the bytes in R2 and marks the row STORED (MH-1)", async () => {
    await expect(downloadInboundMedia({ messageId: "msg-1" }, RETRYING)).resolves.toBe("stored")

    expect(m.getMediaInfo).toHaveBeenCalledWith("META123")
    expect(m.downloadMedia).toHaveBeenCalledWith(META_URL, { maxBytes: 1000 })
    expect(m.putObject).toHaveBeenCalledWith("whatsapp/conv-1/msg-1/META123.jpg", BYTES, "image/jpeg")
    expect(updates().at(-1)).toEqual({
      where: { id: "media-1", status: "PENDING" },
      data: {
        status: "STORED",
        s3Key: "whatsapp/conv-1/msg-1/META123.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 4,
        sha256: HEX,
        failureReason: null,
      },
    })
  })

  it("never persists or logs the Meta URL or its query secrets (MH-1, WC-15)", async () => {
    await downloadInboundMedia({ messageId: "msg-1" }, RETRYING)

    expect(JSON.stringify(m.mediaUpdateMany.mock.calls)).not.toContain("lookaside")
    expect(JSON.stringify(m.mediaUpdateMany.mock.calls)).not.toContain("SECRET")
    const logged = JSON.stringify([
      ...vi.mocked(console.info).mock.calls,
      ...vi.mocked(console.warn).mock.calls,
      ...vi.mocked(console.error).mock.calls,
    ])
    expect(logged).not.toContain("lookaside")
    expect(logged).not.toContain("SECRET")
  })

  it("accepts a base64 checksum from the webhook when the lookup has none", async () => {
    m.getMediaInfo.mockResolvedValue({ url: META_URL, mimeType: "image/jpeg", sha256: null, fileSize: null })
    m.mediaFindUnique.mockResolvedValue(mediaRow({ sha256: BASE64 }))

    await expect(downloadInboundMedia({ messageId: "msg-1" }, RETRYING)).resolves.toBe("stored")
  })

  it("stores media with no declared checksum", async () => {
    m.getMediaInfo.mockResolvedValue({ url: META_URL, mimeType: "image/jpeg", sha256: null, fileSize: null })

    await expect(downloadInboundMedia({ messageId: "msg-1" }, RETRYING)).resolves.toBe("stored")
  })

  it("hands a stored audio file to the audio port, and a port failure does not fail the download", async () => {
    const port = vi.fn().mockRejectedValue(new Error("queue down"))
    setAudioStoredPort(port)
    m.mediaFindUnique.mockResolvedValue(
      mediaRow({ mimeType: "audio/ogg; codecs=opus", message: { id: "msg-1", conversationId: "conv-1", type: "AUDIO" } })
    )
    m.getMediaInfo.mockResolvedValue({ url: META_URL, mimeType: "audio/ogg; codecs=opus", sha256: HEX, fileSize: 4 })

    await expect(downloadInboundMedia({ messageId: "msg-1" }, RETRYING)).resolves.toBe("stored")

    expect(port).toHaveBeenCalledWith("msg-1")
  })

  it("does not call the audio port for images", async () => {
    const port = vi.fn()
    setAudioStoredPort(port)

    await downloadInboundMedia({ messageId: "msg-1" }, RETRYING)

    expect(port).not.toHaveBeenCalled()
  })
})

describe("downloadInboundMedia: idempotency (MH-10, S-MH-7)", () => {
  it.each(["STORED", "FAILED", "TOO_LARGE", "UNSUPPORTED"])("does nothing for a %s row", async (status) => {
    m.mediaFindUnique.mockResolvedValue(mediaRow({ status }))

    await expect(downloadInboundMedia({ messageId: "msg-1" }, RETRYING)).resolves.toBe("skipped")

    expect(m.getMediaInfo).not.toHaveBeenCalled()
    expect(m.putObject).not.toHaveBeenCalled()
  })

  it("does nothing when the message has no media row", async () => {
    m.mediaFindUnique.mockResolvedValue(null)

    await expect(downloadInboundMedia({ messageId: "ghost" }, RETRYING)).resolves.toBe("skipped")
  })

  it("reports skipped (and not stored) when a concurrent run already finished the row", async () => {
    m.mediaUpdateMany.mockResolvedValue({ count: 0 })

    await expect(downloadInboundMedia({ messageId: "msg-1" }, RETRYING)).resolves.toBe("skipped")
  })

  it("only ever writes through PENDING-guarded updates", async () => {
    await downloadInboundMedia({ messageId: "msg-1" }, RETRYING)

    expect(updates().every((arg) => arg.where.status === "PENDING")).toBe(true)
  })
})

describe("downloadInboundMedia: limits and type policy", () => {
  it("marks TOO_LARGE from the declared size without downloading", async () => {
    m.getMediaInfo.mockResolvedValue({ url: META_URL, mimeType: "application/pdf", sha256: null, fileSize: 5000 })

    await expect(downloadInboundMedia({ messageId: "msg-1" }, RETRYING)).resolves.toBe("too-large")

    expect(m.downloadMedia).not.toHaveBeenCalled()
    expect(updates().at(-1)?.data).toMatchObject({ status: "TOO_LARGE", sizeBytes: 5000 })
  })

  it("marks TOO_LARGE when the download itself exceeds the limit", async () => {
    m.downloadMedia.mockRejectedValue(new CloudApiError(MEDIA_TOO_LARGE_MESSAGE, 200, null, false))

    await expect(downloadInboundMedia({ messageId: "msg-1" }, RETRYING)).resolves.toBe("too-large")

    expect(m.putObject).not.toHaveBeenCalled()
    expect(updates().at(-1)?.data).toMatchObject({ status: "TOO_LARGE" })
  })

  it("marks UNSUPPORTED (and stores nothing) for active content types", async () => {
    m.getMediaInfo.mockResolvedValue({ url: META_URL, mimeType: "text/html", sha256: null, fileSize: 10 })

    await expect(downloadInboundMedia({ messageId: "msg-1" }, RETRYING)).resolves.toBe("unsupported")

    expect(m.downloadMedia).not.toHaveBeenCalled()
    expect(updates().at(-1)?.data).toMatchObject({ status: "UNSUPPORTED" })
  })

  it("stores video and other types the AI cannot read; that policy belongs to PR3.5 (MH-6)", async () => {
    m.getMediaInfo.mockResolvedValue({ url: META_URL, mimeType: "video/mp4", sha256: null, fileSize: 4 })

    await expect(downloadInboundMedia({ messageId: "msg-1" }, RETRYING)).resolves.toBe("stored")
    expect(m.putObject).toHaveBeenCalledWith(expect.stringMatching(/\.mp4$/), BYTES, "video/mp4")
  })
})

describe("downloadInboundMedia: failures (MH-7, S-MH-6)", () => {
  it("rethrows a transient Meta error so pg-boss retries, leaving the row PENDING", async () => {
    m.downloadMedia.mockRejectedValue(new CloudApiError("busy", 503, null, true))

    await expect(downloadInboundMedia({ messageId: "msg-1" }, RETRYING)).rejects.toThrow("busy")

    expect(m.mediaUpdateMany).not.toHaveBeenCalled()
  })

  it("asks Meta for a new URL on every attempt, because the old one may have expired", async () => {
    m.downloadMedia.mockRejectedValueOnce(new CloudApiError("url expired", 410, null, true))

    await expect(downloadInboundMedia({ messageId: "msg-1" }, RETRYING)).rejects.toThrow()
    await expect(downloadInboundMedia({ messageId: "msg-1" }, RETRYING)).resolves.toBe("stored")

    expect(m.getMediaInfo).toHaveBeenCalledTimes(2)
    expect(m.getMediaInfo).toHaveBeenNthCalledWith(1, "META123")
    expect(m.getMediaInfo).toHaveBeenNthCalledWith(2, "META123")
  })

  it("marks FAILED, with a safe reason, on a permanent error", async () => {
    m.getMediaInfo.mockRejectedValue(new CloudApiError("Media ID not found", 404, "100", false))

    await expect(downloadInboundMedia({ messageId: "msg-1" }, RETRYING)).resolves.toBe("failed")

    const failed = updates().at(-1)
    expect(failed?.data).toEqual({ status: "FAILED", failureReason: "No se pudo descargar el archivo (100)" })
  })

  it("marks FAILED when a transient error exhausts its attempts", async () => {
    m.downloadMedia.mockRejectedValue(new CloudApiError("busy", 503, null, true))

    await expect(downloadInboundMedia({ messageId: "msg-1" }, LAST)).resolves.toBe("failed")
    expect(updates().at(-1)?.data).toMatchObject({ status: "FAILED" })
  })

  it("retries an R2 failure, then fails permanently on the last attempt", async () => {
    m.putObject.mockRejectedValue(new Error("r2 down"))

    await expect(downloadInboundMedia({ messageId: "msg-1" }, RETRYING)).rejects.toThrow("r2 down")
    await expect(downloadInboundMedia({ messageId: "msg-1" }, LAST)).resolves.toBe("failed")
  })

  it("treats a checksum mismatch as transient and never stores the corrupt bytes", async () => {
    m.getMediaInfo.mockResolvedValue({ url: META_URL, mimeType: "image/jpeg", sha256: "deadbeef", fileSize: 4 })

    await expect(downloadInboundMedia({ messageId: "msg-1" }, RETRYING)).rejects.toThrow("checksum")
    await expect(downloadInboundMedia({ messageId: "msg-1" }, LAST)).resolves.toBe("failed")

    expect(m.putObject).not.toHaveBeenCalled()
  })

  it("keeps the failure reason free of URLs and tokens", async () => {
    m.getMediaInfo.mockRejectedValue(new CloudApiError(`bad ${META_URL}`, 500, null, true))

    await downloadInboundMedia({ messageId: "msg-1" }, LAST)

    expect(JSON.stringify(m.mediaUpdateMany.mock.calls)).not.toContain("lookaside")
  })
})

describe("handleMediaJobs", () => {
  it("is a no-op while WHATSAPP_ENABLED is off (WC-12)", async () => {
    vi.stubEnv("WHATSAPP_ENABLED", "false")

    await handleMediaJobs([{ id: "j", data: { messageId: "msg-1" }, retryCount: 0 } as never])

    expect(m.mediaFindUnique).not.toHaveBeenCalled()
  })

  it("treats the retry-limit attempt as the last one (wa.media.download retryLimit is 3)", async () => {
    m.downloadMedia.mockRejectedValue(new CloudApiError("busy", 503, null, true))

    await expect(handleMediaJobs([{ id: "j", data: { messageId: "msg-1" }, retryCount: 2 } as never])).rejects.toThrow("busy")
    await expect(
      handleMediaJobs([{ id: "j", data: { messageId: "msg-1" }, retryCount: 3 } as never])
    ).resolves.toBeUndefined()
    expect(updates().at(-1)?.data).toMatchObject({ status: "FAILED" })
  })
})
