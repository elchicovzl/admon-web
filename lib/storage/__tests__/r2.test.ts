import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({ send: vi.fn(), getSignedUrl: vi.fn(), constructed: vi.fn() }))

vi.mock("@aws-sdk/client-s3", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@aws-sdk/client-s3")>()
  class FakeS3Client {
    send = m.send
    constructor(config: unknown) {
      m.constructed(config)
    }
  }
  return { ...actual, S3Client: FakeS3Client }
})
vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: m.getSignedUrl }))

import { StoredObjectError, copyObject, deleteObjects, getObjectBytes, presignGet, putObject, resetR2Client } from "../r2"

beforeEach(() => {
  vi.clearAllMocks()
  resetR2Client()
  vi.stubEnv("R2_ACCOUNT_ID", "acct")
  vi.stubEnv("R2_ACCESS_KEY_ID", "ak")
  vi.stubEnv("R2_SECRET_ACCESS_KEY", "sk")
  vi.stubEnv("R2_BUCKET_NAME", "bucket")
  m.send.mockResolvedValue({})
  m.getSignedUrl.mockResolvedValue("https://signed.example/object")
})

describe("client configuration", () => {
  it("builds an R2 endpoint client lazily and reuses it", async () => {
    await putObject("a", new Uint8Array([1]), "text/plain")
    await putObject("b", new Uint8Array([1]), "text/plain")

    expect(m.constructed).toHaveBeenCalledTimes(1)
    expect(m.constructed).toHaveBeenCalledWith({
      region: "auto",
      endpoint: "https://acct.r2.cloudflarestorage.com",
      credentials: { accessKeyId: "ak", secretAccessKey: "sk" },
    })
  })

  it("fails with a clear error when credentials or the bucket are missing", async () => {
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "")
    await expect(putObject("a", new Uint8Array(), "text/plain")).rejects.toThrow("credentials not configured")

    resetR2Client()
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "sk")
    vi.stubEnv("R2_BUCKET_NAME", "")
    await expect(putObject("a", new Uint8Array(), "text/plain")).rejects.toThrow("R2_BUCKET_NAME")
  })
})

describe("putObject", () => {
  it("uploads bytes with their content type", async () => {
    const body = new Uint8Array([1, 2, 3])

    await putObject("whatsapp/c/m/id.jpg", body, "image/jpeg")

    expect(m.send.mock.calls[0][0].input).toEqual({
      Bucket: "bucket",
      Key: "whatsapp/c/m/id.jpg",
      Body: body,
      ContentType: "image/jpeg",
    })
  })
})

describe("copyObject", () => {
  it("copies inside the bucket with an encoded CopySource", async () => {
    await copyObject("whatsapp/c 1/m/id.jpg", "affiliations/a/s/id.jpg")

    expect(m.send.mock.calls[0][0].input).toEqual({
      Bucket: "bucket",
      Key: "affiliations/a/s/id.jpg",
      CopySource: "bucket/whatsapp/c%201/m/id.jpg",
    })
  })
})

describe("deleteObjects", () => {
  it("returns immediately for no keys", async () => {
    await expect(deleteObjects([])).resolves.toEqual({ deleted: [], failed: [] })
    expect(m.send).not.toHaveBeenCalled()
  })

  it("deletes the keys and reports them", async () => {
    const result = await deleteObjects(["a", "b", "a"])

    expect(m.send.mock.calls[0][0].input.Delete.Objects).toEqual([{ Key: "a" }, { Key: "b" }])
    expect(result).toEqual({ deleted: ["a", "b"], failed: [] })
  })

  it("treats a missing key as success", async () => {
    m.send.mockResolvedValue({ Errors: [{ Key: "gone", Code: "NoSuchKey" }] })

    await expect(deleteObjects(["gone"])).resolves.toEqual({ deleted: ["gone"], failed: [] })
  })

  it("reports per-key failures without throwing, so the caller can keep those rows", async () => {
    m.send.mockResolvedValue({ Errors: [{ Key: "b", Code: "AccessDenied" }] })

    await expect(deleteObjects(["a", "b"])).resolves.toEqual({
      deleted: ["a"],
      failed: [{ key: "b", code: "AccessDenied" }],
    })
  })

  it("marks a whole batch failed when the request itself fails, and still tries the next batch", async () => {
    const keys = Array.from({ length: 1001 }, (_, i) => `k${i}`)
    m.send.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce({})

    const result = await deleteObjects(keys)

    expect(m.send).toHaveBeenCalledTimes(2)
    expect(result.failed).toHaveLength(1000)
    expect(result.failed[0]).toEqual({ key: "k0", code: "REQUEST_FAILED" })
    expect(result.deleted).toEqual(["k1000"])
  })
})

describe("presignGet", () => {
  it("signs a GET for 10 minutes by default", async () => {
    const url = await presignGet("whatsapp/c/m/id.jpg")

    expect(url).toBe("https://signed.example/object")
    const [, command, options] = m.getSignedUrl.mock.calls[0]
    expect(command.input).toEqual({ Bucket: "bucket", Key: "whatsapp/c/m/id.jpg", ResponseContentDisposition: "inline" })
    expect(options).toEqual({ expiresIn: 600 })
  })

  it("passes content type and a sanitized file name", async () => {
    await presignGet("k", { contentType: "application/pdf", fileName: 'a"b\r\n.pdf', expiresInSeconds: 60 })

    const [, command, options] = m.getSignedUrl.mock.calls[0]
    expect(command.input.ResponseContentType).toBe("application/pdf")
    expect(command.input.ResponseContentDisposition).toBe('inline; filename="a_b__.pdf"')
    expect(options).toEqual({ expiresIn: 60 })
  })

  it("can force a download", async () => {
    await presignGet("k", { disposition: "attachment" })

    expect(m.getSignedUrl.mock.calls[0][1].input.ResponseContentDisposition).toBe("attachment")
  })
})

describe("getObjectBytes", () => {
  const body = (bytes: Uint8Array) => ({ transformToByteArray: async () => bytes })

  it("reads the object into memory", async () => {
    m.send.mockResolvedValue({ ContentLength: 3, Body: body(new Uint8Array([1, 2, 3])) })

    await expect(getObjectBytes("a/b.pdf", 10)).resolves.toEqual(new Uint8Array([1, 2, 3]))
    expect(m.send.mock.calls[0][0].input).toEqual({ Bucket: "bucket", Key: "a/b.pdf" })
  })

  it("refuses an object larger than the limit, by header or by size", async () => {
    m.send.mockResolvedValue({ ContentLength: 11, Body: body(new Uint8Array(11)) })
    await expect(getObjectBytes("a", 10)).rejects.toThrow("larger")

    m.send.mockResolvedValue({ Body: body(new Uint8Array(11)) })
    await expect(getObjectBytes("a", 10)).rejects.toThrow("larger")
  })

  it("fails when there is no body", async () => {
    m.send.mockResolvedValue({})
    await expect(getObjectBytes("a", 10)).rejects.toThrow("no body")
  })

  it("marks missing and oversized objects as permanent, typed errors", async () => {
    m.send.mockResolvedValue({ ContentLength: 11, Body: body(new Uint8Array(11)) })
    await expect(getObjectBytes("a", 10)).rejects.toMatchObject({ name: "StoredObjectError", code: "TOO_LARGE" })

    m.send.mockRejectedValue(Object.assign(new Error("The specified key does not exist."), { name: "NoSuchKey" }))
    const missing = await getObjectBytes("a", 10).catch((error: unknown) => error)
    expect(missing).toBeInstanceOf(StoredObjectError)
    expect(missing).toMatchObject({ code: "MISSING" })
  })

  it("lets other storage errors through unchanged (outages stay retryable)", async () => {
    const outage = Object.assign(new Error("socket hang up"), { name: "TimeoutError" })
    m.send.mockRejectedValue(outage)

    await expect(getObjectBytes("a", 10)).rejects.toBe(outage)
  })
})
