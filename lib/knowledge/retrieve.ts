import { Prisma } from "@prisma/client"
import { embed } from "ai"
import prisma from "@/lib/db/prisma"
import { embeddingModel, embeddingModelKey, embeddingProviderOptions } from "@/lib/ai/providers"
import { getAiConfig } from "@/lib/config/runtime-config"
import { getKnowledgeHealth } from "./documents"
import { fuseRrf } from "./rrf"
import { toVectorLiteral } from "./vector"

/**
 * Hybrid retrieval for the AI assistant (KB-5, KB-6, KB-10): cosine search over embeddings plus
 * Spanish full-text search, fused with RRF.
 *
 * - Only active documents and chunks embedded with the configured model and dimensions are
 *   searched, so vectors of different models never mix (KB-6). Deleted documents have no rows.
 * - The model filter runs on the HNSW index with pgvector's iterative scan; without it a filtered
 *   search can return far fewer than LIMIT rows (measured: 1 of 20 with 2% matching rows).
 * - Vector matches below AI_MIN_SIMILARITY are dropped; keyword hits always count. With neither,
 *   the result says so instead of handing the model weak context (S-KB-7). If nothing matches
 *   because only another model's chunks exist, it asks for a re-index (S-KB-8).
 *
 * An embedding outage propagates: the responder decides how to escalate.
 */

export const RETRIEVAL_LIMITS = { vector: 20, keyword: 20, top: 6 } as const

export interface RetrievedChunk {
  id: string
  documentId: string
  documentTitle: string
  heading: string | null
  content: string
  ordinal: number
  /** Cosine similarity with the question (1 = identical). */
  similarity: number
  rrfScore: number
}

export type RetrievalResult =
  | { status: "OK"; chunks: RetrievedChunk[]; topSimilarity: number }
  | { status: "NO_SUFFICIENT_MATCH"; topSimilarity: number | null }
  | { status: "REINDEX_REQUIRED" }

export interface EmbeddingFilter {
  embeddingModel: string
  embeddingDimensions: number
}

type ChunkRow = Omit<RetrievedChunk, "rrfScore">

function filters(filter: EmbeddingFilter): Prisma.Sql {
  return Prisma.sql`d."isActive" = true
      AND c."embeddingModel" = ${filter.embeddingModel}
      AND c."embeddingDimensions" = ${filter.embeddingDimensions}
      AND c.embedding IS NOT NULL`
}

const chunkColumns = Prisma.sql`c.id, c."documentId", d.title AS "documentTitle", c.heading, c.content, c.ordinal`

/** Nearest chunks by cosine distance, re-sorted outside the index scan (relaxed_order). */
export function vectorSearchSql(query: number[], filter: EmbeddingFilter): Prisma.Sql {
  const vector = toVectorLiteral(query, filter.embeddingDimensions)
  return Prisma.sql`
    SELECT * FROM (
      SELECT ${chunkColumns}, 1 - (c.embedding <=> ${vector}::vector) AS similarity
      FROM knowledge_chunks c
      JOIN knowledge_documents d ON d.id = c."documentId"
      WHERE ${filters(filter)}
      ORDER BY c.embedding <=> ${vector}::vector
      LIMIT ${RETRIEVAL_LIMITS.vector}
    ) nearest
    ORDER BY similarity DESC, id
  `
}

/** Best Spanish full-text matches; the expression matches the GIN index on content. */
export function keywordSearchSql(query: number[], text: string, filter: EmbeddingFilter): Prisma.Sql {
  const vector = toVectorLiteral(query, filter.embeddingDimensions)
  return Prisma.sql`
    SELECT ${chunkColumns},
      1 - (c.embedding <=> ${vector}::vector) AS similarity,
      ts_rank_cd(to_tsvector('spanish'::regconfig, c.content), q.query) AS rank
    FROM knowledge_chunks c
    JOIN knowledge_documents d ON d.id = c."documentId"
    CROSS JOIN websearch_to_tsquery('spanish'::regconfig, ${text}) AS q(query)
    WHERE to_tsvector('spanish'::regconfig, c.content) @@ q.query
      AND ${filters(filter)}
    ORDER BY rank DESC, c.id
    LIMIT ${RETRIEVAL_LIMITS.keyword}
  `
}

export async function retrieveKnowledge(question: string): Promise<RetrievalResult> {
  const text = question.trim()
  if (!text) return { status: "NO_SUFFICIENT_MATCH", topSimilarity: null }

  const config = getAiConfig()
  const { embedding } = await embed({
    model: embeddingModel(config),
    value: text,
    providerOptions: embeddingProviderOptions(config),
    maxRetries: 2,
  })
  const filter = { embeddingModel: embeddingModelKey(config), embeddingDimensions: config.embeddingDimensions }

  const [vectorRows, keywordRows] = await prisma.$transaction(async (tx) => {
    // SET LOCAL lasts until the end of this transaction only (SET takes no bind parameters).
    // ef_search 100 > the vector limit, so the iterative scan can fill it.
    await tx.$executeRaw`SET LOCAL hnsw.iterative_scan = relaxed_order`
    await tx.$executeRaw`SET LOCAL hnsw.ef_search = 100`
    const vector = await tx.$queryRaw<ChunkRow[]>(vectorSearchSql(embedding, filter))
    const keyword = await tx.$queryRaw<ChunkRow[]>(keywordSearchSql(embedding, text, filter))
    return [vector, keyword] as const
  })

  if (vectorRows.length === 0 && keywordRows.length === 0) {
    const health = await getKnowledgeHealth()
    return health.status === "REINDEX_REQUIRED"
      ? { status: "REINDEX_REQUIRED" }
      : { status: "NO_SUFFICIENT_MATCH", topSimilarity: null }
  }

  const similarities = [...vectorRows, ...keywordRows].map((row) => Number(row.similarity))
  const topSimilarity = Math.max(...similarities)
  const vectorMatches = [...vectorRows]
    .filter((row) => Number(row.similarity) >= config.minSimilarity)
    .sort((a, b) => Number(b.similarity) - Number(a.similarity))
  if (vectorMatches.length === 0 && keywordRows.length === 0) {
    return { status: "NO_SUFFICIENT_MATCH", topSimilarity }
  }

  const rows = new Map<string, ChunkRow>()
  for (const row of [...vectorMatches, ...keywordRows]) if (!rows.has(row.id)) rows.set(row.id, row)
  const chunks = fuseRrf(vectorMatches, keywordRows)
    .slice(0, RETRIEVAL_LIMITS.top)
    .map(({ id, rrfScore }) => {
      const row = rows.get(id)!
      return {
        id: row.id,
        documentId: row.documentId,
        documentTitle: row.documentTitle,
        heading: row.heading,
        content: row.content,
        ordinal: Number(row.ordinal),
        similarity: Number(row.similarity),
        rrfScore,
      }
    })
  return { status: "OK", chunks, topSimilarity }
}
