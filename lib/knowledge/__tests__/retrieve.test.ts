import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => {
  const tx = { $executeRaw: vi.fn(), $queryRaw: vi.fn() }
  return { tx, transaction: vi.fn(), embed: vi.fn(), getAiConfig: vi.fn(), health: vi.fn() }
})
vi.mock("@/lib/db/prisma", () => ({ default: { $transaction: m.transaction } }))
vi.mock("ai", () => ({ embed: m.embed }))
vi.mock("@/lib/config/runtime-config", () => ({ getAiConfig: m.getAiConfig }))
vi.mock("@/lib/ai/providers", () => ({
  embeddingModel: () => "embedding-model",
  embeddingProviderOptions: () => ({ openai: { dimensions: 3 } }),
  embeddingModelKey: () => "openai/text-embedding-3-small",
}))
vi.mock("../documents", () => ({ getKnowledgeHealth: m.health }))

import { RETRIEVAL_LIMITS, keywordSearchSql, retrieveKnowledge, vectorSearchSql } from "../retrieve"

const QUERY = [0.1, 0.2, 0.3]
const FILTER = { embeddingModel: "openai/text-embedding-3-small", embeddingDimensions: 3 }

function row(id: string, similarity: number, extra: Record<string, unknown> = {}) {
  return {
    id,
    documentId: `doc-${id}`,
    documentTitle: `Guía ${id}`,
    heading: null,
    content: `texto ${id}`,
    ordinal: 0,
    similarity,
    ...extra,
  }
}

function results(vector: unknown[], keyword: unknown[]) {
  m.tx.$queryRaw.mockResolvedValueOnce(vector).mockResolvedValueOnce(keyword)
}

beforeEach(() => {
  vi.clearAllMocks()
  m.getAiConfig.mockReturnValue({ minSimilarity: 0.35, embeddingDimensions: 3 })
  m.embed.mockResolvedValue({ embedding: QUERY })
  m.transaction.mockImplementation(async (fn: (tx: typeof m.tx) => Promise<unknown>) => fn(m.tx))
  m.tx.$executeRaw.mockResolvedValue(0)
  m.health.mockResolvedValue({ status: "OK", currentChunks: 10, staleChunks: 0, staleDocuments: 0 })
})

describe("SQL (KB-6, S-KB-5)", () => {
  it("vector search: active documents, the configured model and dimensions only, top 20 by cosine distance", () => {
    const sql = vectorSearchSql(QUERY, FILTER)

    expect(sql.sql).toContain('d."isActive" = true')
    expect(sql.sql).toContain('c."embeddingModel" =')
    expect(sql.sql).toContain('c."embeddingDimensions" =')
    expect(sql.sql).toContain("<=>")
    expect(sql.sql).toContain("::vector")
    expect(sql.values).toEqual(expect.arrayContaining(["[0.1,0.2,0.3]", FILTER.embeddingModel, 3, RETRIEVAL_LIMITS.vector]))
    expect(RETRIEVAL_LIMITS).toEqual({ vector: 20, keyword: 20, top: 6 })
  })

  it("keyword search: Spanish websearch query over the indexed expression, same filters, top 20", () => {
    const sql = keywordSearchSql(QUERY, "afiliación EPS", FILTER)

    expect(sql.sql).toContain("websearch_to_tsquery('spanish'::regconfig")
    expect(sql.sql).toContain("to_tsvector('spanish'::regconfig, c.content)")
    expect(sql.sql).toContain('d."isActive" = true')
    expect(sql.sql).toContain('c."embeddingModel" =')
    expect(sql.values).toEqual(expect.arrayContaining(["afiliación EPS", FILTER.embeddingModel, 3, RETRIEVAL_LIMITS.keyword]))
  })

  it("never puts the user's text into the SQL string", () => {
    const hostile = "'); DROP TABLE knowledge_chunks; --"

    expect(keywordSearchSql(QUERY, hostile, FILTER).sql).not.toContain("DROP TABLE")
    expect(vectorSearchSql(QUERY, FILTER).sql).not.toContain("DROP TABLE")
  })
})

describe("retrieveKnowledge", () => {
  it("embeds the question with the configured model and searches with an iterative HNSW scan", async () => {
    results([row("a", 0.9)], [])

    await retrieveKnowledge("¿Qué necesito para afiliar?")

    expect(m.embed).toHaveBeenCalledWith({
      model: "embedding-model",
      value: "¿Qué necesito para afiliar?",
      providerOptions: { openai: { dimensions: 3 } },
      maxRetries: 2,
    })
    const settings = m.tx.$executeRaw.mock.calls.map((call) => (call[0] as string[]).join(""))
    expect(settings).toEqual(["SET LOCAL hnsw.iterative_scan = relaxed_order", "SET LOCAL hnsw.ef_search = 100"])
  })

  it("fuses both lists with RRF and returns the top 6 with similarity, rrfScore and the document", async () => {
    const vector = Array.from({ length: 8 }, (_, i) => row(`v${i}`, 0.9 - i * 0.05))
    results(vector, [row("v3", 0.75, { rank: 0.5 }), row("k1", 0.2, { rank: 0.4 })])

    const r = await retrieveKnowledge("pregunta")

    expect(r.status).toBe("OK")
    if (r.status !== "OK") return
    expect(r.chunks).toHaveLength(6)
    expect(r.chunks[0]).toMatchObject({ id: "v3", documentId: "doc-v3", documentTitle: "Guía v3", similarity: 0.75 })
    expect(r.chunks[0].rrfScore).toBeCloseTo(1 / 64 + 1 / 61)
    expect(r.chunks.map((c) => c.id)).toContain("k1")
    expect(r.topSimilarity).toBe(0.9)
  })

  it("re-sorts vector rows by similarity (relaxed_order can return them slightly out of order)", async () => {
    results([row("b", 0.6), row("a", 0.8)], [])

    const r = await retrieveKnowledge("pregunta")

    expect(r.status === "OK" && r.chunks.map((c) => c.id)).toEqual(["a", "b"])
  })

  it("leaves out vector matches below AI_MIN_SIMILARITY", async () => {
    results([row("good", 0.5), row("weak", 0.2)], [])

    const r = await retrieveKnowledge("pregunta")

    expect(r.status === "OK" && r.chunks.map((c) => c.id)).toEqual(["good"])
  })

  it("answers NO_SUFFICIENT_MATCH when every match is below the threshold and no keyword hits (S-KB-7, KB-10)", async () => {
    results([row("weak", 0.2), row("weaker", 0.1)], [])

    expect(await retrieveKnowledge("¿Cuánto cuesta un viaje a la luna?")).toEqual({
      status: "NO_SUFFICIENT_MATCH",
      topSimilarity: 0.2,
    })
  })

  it("trusts a keyword hit even when the vector similarity is low", async () => {
    results([row("weak", 0.2)], [row("kw", 0.3, { rank: 0.7 })])

    const r = await retrieveKnowledge("NIT")

    expect(r.status).toBe("OK")
    expect(r.status === "OK" && r.chunks.map((c) => c.id)).toEqual(["kw"])
  })

  it("answers REINDEX_REQUIRED when nothing matches because only older-model chunks exist (S-KB-8)", async () => {
    results([], [])
    m.health.mockResolvedValue({ status: "REINDEX_REQUIRED", currentChunks: 0, staleChunks: 9, staleDocuments: 2 })

    expect(await retrieveKnowledge("pregunta")).toEqual({ status: "REINDEX_REQUIRED" })
  })

  it("answers NO_SUFFICIENT_MATCH with no similarity for an empty knowledge base", async () => {
    results([], [])
    m.health.mockResolvedValue({ status: "EMPTY", currentChunks: 0, staleChunks: 0, staleDocuments: 0 })

    expect(await retrieveKnowledge("pregunta")).toEqual({ status: "NO_SUFFICIENT_MATCH", topSimilarity: null })
  })

  it("does not search for a blank question", async () => {
    expect(await retrieveKnowledge("   ")).toEqual({ status: "NO_SUFFICIENT_MATCH", topSimilarity: null })
    expect(m.embed).not.toHaveBeenCalled()
    expect(m.transaction).not.toHaveBeenCalled()
  })

  it("lets an embedding outage propagate so the caller can escalate", async () => {
    m.embed.mockRejectedValue(new Error("503"))

    await expect(retrieveKnowledge("pregunta")).rejects.toThrow("503")
  })
})
