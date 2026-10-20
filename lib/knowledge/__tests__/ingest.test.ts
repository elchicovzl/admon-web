import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => {
  const tx = {
    knowledgeChunk: { deleteMany: vi.fn(), createManyAndReturn: vi.fn() },
    knowledgeDocument: { update: vi.fn() },
    $executeRaw: vi.fn(),
  }
  return {
    tx,
    documentFindUnique: vi.fn(),
    documentUpdate: vi.fn(),
    transaction: vi.fn(),
    getObjectBytes: vi.fn(),
    extractDocumentText: vi.fn(),
    chunkDocument: vi.fn(),
    embedMany: vi.fn(),
    getAiConfig: vi.fn(),
  }
})
vi.mock("@/lib/db/prisma", () => ({
  default: {
    knowledgeDocument: { findUnique: m.documentFindUnique, update: m.documentUpdate },
    $transaction: m.transaction,
  },
}))
vi.mock("@/lib/storage/r2", () => ({ getObjectBytes: m.getObjectBytes }))
vi.mock("../extract", () => ({ extractDocumentText: m.extractDocumentText }))
vi.mock("../chunk", () => ({ chunkDocument: m.chunkDocument }))
vi.mock("ai", () => ({ embedMany: m.embedMany }))
vi.mock("@/lib/config/runtime-config", () => ({ getAiConfig: m.getAiConfig }))
vi.mock("@/lib/ai/providers", () => ({
  embeddingModel: () => "embedding-model",
  embeddingProviderOptions: () => ({ openai: { dimensions: 1536 } }),
  embeddingModelKey: () => "openai/text-embedding-3-small",
}))

import { INGEST_ERRORS, ingestKnowledgeDocument } from "../ingest"

const DOC = {
  id: "doc-1",
  title: "Guía",
  fileName: "guia.pdf",
  mimeType: "application/pdf",
  s3Key: "knowledge/doc-1/guia.pdf",
  isActive: true,
  status: "PENDING",
}
const vector = (seed: number) => Array.from({ length: 1536 }, (_, i) => (i === 0 ? seed : 0))
const chunks = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ ordinal: i, heading: i === 0 ? "Requisitos" : null, content: `texto ${i}`, tokenCount: 2 }))

function statuses(): unknown[] {
  return [
    ...m.documentUpdate.mock.calls.map((call) => call[0].data.status),
    ...m.tx.knowledgeDocument.update.mock.calls.map((call) => call[0].data.status),
  ]
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
  m.getAiConfig.mockReturnValue({ kbUploadMaxBytes: 15728640, embeddingDimensions: 1536 })
  m.documentFindUnique.mockResolvedValue(DOC)
  m.documentUpdate.mockResolvedValue({})
  m.getObjectBytes.mockResolvedValue(new Uint8Array([1, 2, 3]))
  m.extractDocumentText.mockResolvedValue({ ok: true, text: "# Requisitos\n\ntexto" })
  m.chunkDocument.mockReturnValue(chunks(3))
  m.embedMany.mockImplementation(async ({ values }: { values: string[] }) => ({
    embeddings: values.map((_, i) => vector(i + 1)),
  }))
  m.transaction.mockImplementation(async (fn: (tx: typeof m.tx) => Promise<unknown>) => fn(m.tx))
  m.tx.knowledgeChunk.deleteMany.mockResolvedValue({ count: 0 })
  m.tx.knowledgeChunk.createManyAndReturn.mockImplementation(async ({ data }: { data: { ordinal: number }[] }) =>
    data.map((row) => ({ id: `chunk-${row.ordinal}`, ordinal: row.ordinal }))
  )
  m.tx.$executeRaw.mockResolvedValue(1)
  m.tx.knowledgeDocument.update.mockResolvedValue({})
})

describe("ingestKnowledgeDocument: success (S-KB-2)", () => {
  it("moves PENDING -> PROCESSING -> READY and stores chunks with the embedding provider, model and dimensions", async () => {
    const r = await ingestKnowledgeDocument("doc-1", { isLastAttempt: false })

    expect(r).toEqual({ status: "READY", chunkCount: 3 })
    expect(statuses()).toEqual(["PROCESSING", "READY"])
    expect(m.getObjectBytes).toHaveBeenCalledWith("knowledge/doc-1/guia.pdf", 15728640)
    expect(m.tx.knowledgeChunk.createManyAndReturn).toHaveBeenCalledWith({
      data: chunks(3).map((chunk) => ({
        documentId: "doc-1",
        ordinal: chunk.ordinal,
        heading: chunk.heading,
        content: chunk.content,
        tokenCount: chunk.tokenCount,
        embeddingModel: "openai/text-embedding-3-small",
        embeddingDimensions: 1536,
      })),
      select: { id: true, ordinal: true },
    })
    const done = m.tx.knowledgeDocument.update.mock.calls[0][0]
    expect(done).toEqual({
      where: { id: "doc-1" },
      data: {
        status: "READY",
        chunkCount: 3,
        embeddingModel: "openai/text-embedding-3-small",
        lastIndexedAt: expect.any(Date),
        error: null,
        retriable: false,
      },
    })
  })

  it("writes the vectors with a raw ::vector update for the new chunk ids", async () => {
    await ingestKnowledgeDocument("doc-1", { isLastAttempt: false })

    expect(m.tx.$executeRaw).toHaveBeenCalledTimes(1)
    const sql = m.tx.$executeRaw.mock.calls[0][0]
    expect(sql.sql).toContain("::vector")
    expect(sql.values).toEqual(expect.arrayContaining(["chunk-0", "chunk-1", "chunk-2"]))
  })

  it("embeds the heading together with the chunk text", async () => {
    await ingestKnowledgeDocument("doc-1", { isLastAttempt: false })

    expect(m.embedMany.mock.calls[0][0].values).toEqual(["Requisitos\n\ntexto 0", "texto 1", "texto 2"])
    expect(m.embedMany.mock.calls[0][0]).toMatchObject({
      model: "embedding-model",
      providerOptions: { openai: { dimensions: 1536 } },
    })
  })

  it("embeds in batches of 64", async () => {
    m.chunkDocument.mockReturnValue(chunks(130))

    await ingestKnowledgeDocument("doc-1", { isLastAttempt: false })

    expect(m.embedMany.mock.calls.map((call) => call[0].values.length)).toEqual([64, 64, 2])
    expect(m.tx.$executeRaw).toHaveBeenCalledTimes(3)
  })

  it("replaces the old chunks inside one transaction (KB-8, S-KB-6)", async () => {
    await ingestKnowledgeDocument("doc-1", { isLastAttempt: false })

    expect(m.transaction).toHaveBeenCalledTimes(1)
    expect(m.tx.knowledgeChunk.deleteMany).toHaveBeenCalledWith({ where: { documentId: "doc-1" } })
    const deleteOrder = m.tx.knowledgeChunk.deleteMany.mock.invocationCallOrder[0]
    const insertOrder = m.tx.knowledgeChunk.createManyAndReturn.mock.invocationCallOrder[0]
    expect(deleteOrder).toBeLessThan(insertOrder)
  })
})

describe("ingestKnowledgeDocument: failures", () => {
  it("fails an extraction error with its message, not retriable, and never indexes (S-KB-3)", async () => {
    m.extractDocumentText.mockResolvedValue({ ok: false, error: "El PDF no contiene texto extraíble (posiblemente escaneado). OCR no está soportado." })

    const r = await ingestKnowledgeDocument("doc-1", { isLastAttempt: false })

    expect(r).toEqual({ status: "FAILED", retriable: false })
    expect(m.documentUpdate).toHaveBeenLastCalledWith({
      where: { id: "doc-1" },
      data: {
        status: "FAILED",
        error: "El PDF no contiene texto extraíble (posiblemente escaneado). OCR no está soportado.",
        retriable: false,
      },
    })
    expect(m.embedMany).not.toHaveBeenCalled()
    expect(m.transaction).not.toHaveBeenCalled()
  })

  it("fails a document that produces no chunks with zero chunks indexed", async () => {
    m.chunkDocument.mockReturnValue([])

    const r = await ingestKnowledgeDocument("doc-1", { isLastAttempt: false })

    expect(r).toEqual({ status: "FAILED", retriable: false })
    expect(m.documentUpdate).toHaveBeenLastCalledWith({
      where: { id: "doc-1" },
      data: { status: "FAILED", error: INGEST_ERRORS.NO_CHUNKS, retriable: false },
    })
    expect(m.transaction).not.toHaveBeenCalled()
  })

  it("rethrows an embedding outage so the job retries, keeping the previous chunks (S-KB-9)", async () => {
    m.embedMany.mockRejectedValue(new Error("503"))

    await expect(ingestKnowledgeDocument("doc-1", { isLastAttempt: false })).rejects.toThrow("503")

    expect(m.transaction).not.toHaveBeenCalled()
    expect(statuses()).toEqual(["PROCESSING"])
  })

  it("on the last attempt marks it FAILED and retriable, and still keeps the previous chunks (S-KB-9)", async () => {
    m.embedMany.mockRejectedValue(new Error("503"))

    const r = await ingestKnowledgeDocument("doc-1", { isLastAttempt: true })

    expect(r).toEqual({ status: "FAILED", retriable: true })
    expect(m.documentUpdate).toHaveBeenLastCalledWith({
      where: { id: "doc-1" },
      data: { status: "FAILED", error: INGEST_ERRORS.TRANSIENT, retriable: true },
    })
    expect(m.transaction).not.toHaveBeenCalled()
  })

  it("treats a storage read failure like an outage", async () => {
    m.getObjectBytes.mockRejectedValue(new Error("R2 down"))

    expect(await ingestKnowledgeDocument("doc-1", { isLastAttempt: true })).toEqual({ status: "FAILED", retriable: true })
  })

  it("refuses vectors of the wrong size from the provider", async () => {
    m.embedMany.mockResolvedValue({ embeddings: [vector(1).slice(0, 10), vector(2), vector(3)] })

    expect(await ingestKnowledgeDocument("doc-1", { isLastAttempt: true })).toEqual({ status: "FAILED", retriable: true })
    expect(m.transaction).not.toHaveBeenCalled()
  })

  it("skips a missing or deactivated document without touching it", async () => {
    m.documentFindUnique.mockResolvedValue(null)
    expect(await ingestKnowledgeDocument("doc-1", { isLastAttempt: false })).toEqual({ status: "SKIPPED" })

    m.documentFindUnique.mockResolvedValue({ ...DOC, isActive: false })
    expect(await ingestKnowledgeDocument("doc-1", { isLastAttempt: false })).toEqual({ status: "SKIPPED" })

    expect(m.documentUpdate).not.toHaveBeenCalled()
  })
})
