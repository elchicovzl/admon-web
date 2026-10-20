import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  findUnique: vi.fn(),
  deleteDoc: vi.fn(),
  chunkDeleteMany: vi.fn(),
  chunkCount: vi.fn(),
  documentCount: vi.fn(),
  transaction: vi.fn(),
  putObject: vi.fn(),
  deleteObjects: vi.fn(),
  send: vi.fn(),
  getBoss: vi.fn(),
  getAiConfig: vi.fn(),
}))
vi.mock("@/lib/db/prisma", () => ({
  default: {
    knowledgeDocument: {
      create: m.create,
      update: m.update,
      updateMany: m.updateMany,
      findUnique: m.findUnique,
      delete: m.deleteDoc,
      count: m.documentCount,
    },
    knowledgeChunk: { deleteMany: m.chunkDeleteMany, count: m.chunkCount },
    $transaction: m.transaction,
  },
}))
vi.mock("@/lib/storage/r2", () => ({ putObject: m.putObject, deleteObjects: m.deleteObjects }))
vi.mock("@/lib/queue/boss", () => ({ getBoss: m.getBoss }))
vi.mock("@/lib/config/runtime-config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/config/runtime-config")>()),
  getAiConfig: m.getAiConfig,
}))
vi.mock("@/lib/ai/providers", () => ({ embeddingModelKey: () => "openai/text-embedding-3-small" }))

import {
  DOCUMENT_ERRORS,
  REINDEX_STALE_MS,
  createKnowledgeDocument,
  deleteKnowledgeDocument,
  getKnowledgeHealth,
  reindexKnowledgeDocument,
  safeFileName,
} from "../documents"

const PDF = new TextEncoder().encode("%PDF-1.4 cuerpo")
const NOW = new Date("2026-10-20T15:00:00Z")

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
  m.getAiConfig.mockReturnValue({ kbUploadMaxBytes: 1000, embeddingDimensions: 1536 })
  m.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "doc-1", ...data }))
  m.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "doc-1", ...data }))
  m.putObject.mockResolvedValue(undefined)
  m.deleteObjects.mockResolvedValue({ deleted: 1, failed: [] })
  m.send.mockResolvedValue("job-1")
  m.getBoss.mockResolvedValue({ send: m.send })
  m.transaction.mockImplementation(async (ops: Promise<unknown>[]) => Promise.all(ops))
})

describe("safeFileName", () => {
  it("keeps a readable base name and drops paths and odd characters", () => {
    expect(safeFileName("C:\\fakepath\\Guía de afiliación.pdf")).toBe("Guía de afiliación.pdf")
    expect(safeFileName("../../etc/passwd")).toBe("passwd")
    expect(safeFileName("a<b>:c?.md")).toBe("a_b__c_.md")
    expect(safeFileName("   ")).toBe("documento")
  })

  it("keeps accents sent in decomposed (NFD) form, as macOS does", () => {
    expect(safeFileName("Pol\u0069\u0301tica.md")).toBe("Política.md")
  })
})

describe("createKnowledgeDocument (KB-2, KB-11)", () => {
  const input = { bytes: PDF, fileName: "guia.pdf", mimeType: "application/pdf", title: "", userId: "u1" }

  it("records the upload, stores it at knowledge/{docId}/{name} and enqueues kb.ingest", async () => {
    const r = await createKnowledgeDocument(input)

    expect(m.create).toHaveBeenCalledWith({
      data: {
        title: "guia",
        fileName: "guia.pdf",
        mimeType: "application/pdf",
        sizeBytes: PDF.byteLength,
        s3Key: "",
        uploadedById: "u1",
        status: "PENDING",
      },
    })
    expect(m.putObject).toHaveBeenCalledWith("knowledge/doc-1/guia.pdf", PDF, "application/pdf")
    expect(m.update).toHaveBeenCalledWith({ where: { id: "doc-1" }, data: { s3Key: "knowledge/doc-1/guia.pdf" } })
    expect(m.send).toHaveBeenCalledWith("kb.ingest", { documentId: "doc-1" })
    expect(r).toEqual({ ok: true, documentId: "doc-1", queued: true })
  })

  it("uses the given title", async () => {
    await createKnowledgeDocument({ ...input, title: "  Guía EPS  " })

    expect(m.create.mock.calls[0][0].data.title).toBe("Guía EPS")
  })

  it("rejects a file over KB_UPLOAD_MAX_BYTES before storing anything", async () => {
    const r = await createKnowledgeDocument({ ...input, bytes: new Uint8Array(1001) })

    expect(r).toEqual({ ok: false, error: DOCUMENT_ERRORS.TOO_LARGE })
    expect(m.create).not.toHaveBeenCalled()
    expect(m.putObject).not.toHaveBeenCalled()
  })

  it("rejects unsupported types and mismatched extension/MIME (S-KB-4)", async () => {
    const xlsx = await createKnowledgeDocument({
      ...input,
      fileName: "tarifas.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
    const lying = await createKnowledgeDocument({ ...input, fileName: "foto.pdf", mimeType: "image/png" })

    expect(xlsx).toEqual({ ok: false, error: DOCUMENT_ERRORS.UNSUPPORTED })
    expect(lying).toEqual({ ok: false, error: DOCUMENT_ERRORS.UNSUPPORTED })
    expect(m.create).not.toHaveBeenCalled()
  })

  it("rejects content that does not match its type (a renamed file)", async () => {
    const fakePdf = await createKnowledgeDocument({ ...input, bytes: new TextEncoder().encode("hola") })
    const fakeDocx = await createKnowledgeDocument({
      ...input,
      fileName: "a.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    })
    const binaryText = await createKnowledgeDocument({
      ...input,
      fileName: "a.txt",
      mimeType: "text/plain",
      bytes: new Uint8Array([0xff, 0xfe, 0x00, 0x81]),
    })

    for (const r of [fakePdf, fakeDocx]) expect(r).toEqual({ ok: false, error: DOCUMENT_ERRORS.CONTENT_MISMATCH })
    expect(binaryText).toEqual({ ok: false, error: DOCUMENT_ERRORS.TEXT_NOT_UTF8 })
    expect(m.create).not.toHaveBeenCalled()
  })

  it("tells the user a TXT/MD must be UTF-8 (Windows-1252 or UTF-16 files)", async () => {
    const latin1 = await createKnowledgeDocument({ ...input, fileName: "a.txt", mimeType: "text/plain", bytes: new Uint8Array([0x50, 0x6f, 0x6c, 0xed]) })

    expect(latin1).toEqual({ ok: false, error: DOCUMENT_ERRORS.TEXT_NOT_UTF8 })
    expect(DOCUMENT_ERRORS.TEXT_NOT_UTF8).toBe("El archivo de texto debe estar guardado en UTF-8.")
  })

  it("rejects a title over the limit even when called without the route", async () => {
    expect(await createKnowledgeDocument({ ...input, title: "x".repeat(201) })).toEqual({
      ok: false,
      error: DOCUMENT_ERRORS.TITLE_TOO_LONG,
    })
    expect(m.create).not.toHaveBeenCalled()
  })

  it("rejects an empty file", async () => {
    expect(await createKnowledgeDocument({ ...input, bytes: new Uint8Array(0) })).toEqual({
      ok: false,
      error: DOCUMENT_ERRORS.EMPTY,
    })
  })

  it("removes the row when storing the file fails", async () => {
    m.putObject.mockRejectedValue(new Error("R2 down"))
    m.deleteDoc.mockResolvedValue({})

    const r = await createKnowledgeDocument(input)

    expect(r).toEqual({ ok: false, error: DOCUMENT_ERRORS.STORAGE })
    expect(m.deleteDoc).toHaveBeenCalledWith({ where: { id: "doc-1" } })
    expect(m.send).not.toHaveBeenCalled()
  })

  it("keeps the document as FAILED and retriable when it cannot be queued", async () => {
    m.getBoss.mockRejectedValue(new Error("queue off"))

    const r = await createKnowledgeDocument(input)

    expect(r).toEqual({ ok: true, documentId: "doc-1", queued: false })
    expect(m.update).toHaveBeenLastCalledWith({
      where: { id: "doc-1" },
      data: { status: "FAILED", error: DOCUMENT_ERRORS.NOT_QUEUED, retriable: true },
    })
  })
})

describe("deleteKnowledgeDocument (KB-7, S-KB-5)", () => {
  it("deletes the chunks and the document in one transaction, then the stored file", async () => {
    m.findUnique.mockResolvedValue({ id: "doc-1", s3Key: "knowledge/doc-1/guia.pdf" })
    m.chunkDeleteMany.mockResolvedValue({ count: 4 })
    m.deleteDoc.mockResolvedValue({})

    const r = await deleteKnowledgeDocument("doc-1")

    expect(m.transaction).toHaveBeenCalledTimes(1)
    expect(m.chunkDeleteMany).toHaveBeenCalledWith({ where: { documentId: "doc-1" } })
    expect(m.deleteDoc).toHaveBeenCalledWith({ where: { id: "doc-1" } })
    expect(m.deleteObjects).toHaveBeenCalledWith(["knowledge/doc-1/guia.pdf"])
    expect(r).toEqual({ ok: true })
  })

  it("still succeeds when only the file cleanup fails (the assistant can no longer use it)", async () => {
    m.findUnique.mockResolvedValue({ id: "doc-1", s3Key: "knowledge/doc-1/guia.pdf" })
    m.deleteObjects.mockRejectedValue(new Error("R2 down"))

    expect(await deleteKnowledgeDocument("doc-1")).toEqual({ ok: true })
  })

  it("reports a missing document", async () => {
    m.findUnique.mockResolvedValue(null)

    expect(await deleteKnowledgeDocument("doc-1")).toEqual({ ok: false, error: DOCUMENT_ERRORS.NOT_FOUND })
    expect(m.transaction).not.toHaveBeenCalled()
  })

  it("reports NOT_FOUND when another user deleted it a moment earlier", async () => {
    m.findUnique.mockResolvedValue({ id: "doc-1", s3Key: "knowledge/doc-1/guia.pdf" })
    m.transaction.mockRejectedValue(Object.assign(new Error("Record to delete does not exist."), { code: "P2025" }))

    expect(await deleteKnowledgeDocument("doc-1")).toEqual({ ok: false, error: DOCUMENT_ERRORS.NOT_FOUND })
    expect(m.deleteObjects).not.toHaveBeenCalled()
  })
})

describe("reindexKnowledgeDocument (one run per document)", () => {
  it("claims a READY/FAILED document, or one stuck for 15 minutes, and enqueues it", async () => {
    m.updateMany.mockResolvedValue({ count: 1 })

    const r = await reindexKnowledgeDocument("doc-1", NOW)

    expect(m.updateMany).toHaveBeenCalledWith({
      where: {
        id: "doc-1",
        isActive: true,
        OR: [
          { status: { in: ["READY", "FAILED"] } },
          { status: { in: ["PENDING", "PROCESSING"] }, updatedAt: { lt: new Date(NOW.getTime() - REINDEX_STALE_MS) } },
        ],
      },
      data: { status: "PENDING", error: null, retriable: false },
    })
    expect(REINDEX_STALE_MS).toBe(15 * 60 * 1000)
    expect(m.send).toHaveBeenCalledWith("kb.ingest", { documentId: "doc-1" })
    expect(r).toEqual({ ok: true })
  })

  it("does not enqueue a second run while one is pending or in progress", async () => {
    m.updateMany.mockResolvedValue({ count: 0 })
    m.findUnique.mockResolvedValue({ id: "doc-1", isActive: true })

    expect(await reindexKnowledgeDocument("doc-1", NOW)).toEqual({ ok: false, error: DOCUMENT_ERRORS.ALREADY_INDEXING })
    expect(m.send).not.toHaveBeenCalled()
  })

  it("reports a missing document", async () => {
    m.updateMany.mockResolvedValue({ count: 0 })
    m.findUnique.mockResolvedValue(null)

    expect(await reindexKnowledgeDocument("doc-1", NOW)).toEqual({ ok: false, error: DOCUMENT_ERRORS.NOT_FOUND })
  })
})

describe("getKnowledgeHealth (S-KB-8)", () => {
  it("is REINDEX_REQUIRED when only chunks of another model exist", async () => {
    m.chunkCount.mockResolvedValueOnce(0).mockResolvedValueOnce(12)
    m.documentCount.mockResolvedValue(2)

    const r = await getKnowledgeHealth()

    expect(r).toEqual({ status: "REINDEX_REQUIRED", currentChunks: 0, staleChunks: 12, staleDocuments: 2 })
    // Only active documents count: the page lists only those, so the banner can always clear.
    expect(m.chunkCount).toHaveBeenNthCalledWith(1, {
      where: { embeddingModel: "openai/text-embedding-3-small", embeddingDimensions: 1536, document: { isActive: true } },
    })
    expect(m.chunkCount).toHaveBeenNthCalledWith(2, {
      where: {
        NOT: { embeddingModel: "openai/text-embedding-3-small", embeddingDimensions: 1536 },
        document: { isActive: true },
      },
    })
    expect(m.documentCount).toHaveBeenCalledWith({
      where: {
        isActive: true,
        chunks: { some: { NOT: { embeddingModel: "openai/text-embedding-3-small", embeddingDimensions: 1536 } } },
      },
    })
  })

  it("is PARTIAL when both current and stale chunks exist, OK with only current ones, EMPTY with none", async () => {
    m.documentCount.mockResolvedValue(0)

    m.chunkCount.mockResolvedValueOnce(5).mockResolvedValueOnce(3)
    expect((await getKnowledgeHealth()).status).toBe("PARTIAL")

    m.chunkCount.mockResolvedValueOnce(5).mockResolvedValueOnce(0)
    expect((await getKnowledgeHealth()).status).toBe("OK")

    m.chunkCount.mockResolvedValueOnce(0).mockResolvedValueOnce(0)
    expect((await getKnowledgeHealth()).status).toBe("EMPTY")
  })
})
