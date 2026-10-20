import { Prisma } from "@prisma/client"
import { embedMany } from "ai"
import prisma from "@/lib/db/prisma"
import { embeddingModel, embeddingModelKey, embeddingProviderOptions } from "@/lib/ai/providers"
import { getAiConfig } from "@/lib/config/runtime-config"
import { getObjectBytes } from "@/lib/storage/r2"
import { chunkDocument, type Chunk } from "./chunk"
import { extractDocumentText } from "./extract"
import { setEmbeddingsSql } from "./vector"

/**
 * `kb.ingest` (KB-2..KB-4, KB-8, KB-9): read the stored file, extract, chunk, embed, and replace
 * the document's chunks.
 *
 * - The old chunks are deleted and the new ones written in ONE transaction, after every
 *   embedding is ready. A re-index that fails at any point leaves the previous chunks in place,
 *   so the assistant keeps answering from them (S-KB-6, S-KB-9).
 * - Content problems (unsupported, scanned, empty) fail at once and are not retriable: running
 *   again would give the same result.
 * - Outages (storage, embedding API, bad vectors, a failed replacement transaction) rethrow so
 *   pg-boss retries; on the last attempt the document is marked FAILED and retriable, so a
 *   manager can re-index later. A document never stays PROCESSING after its last attempt.
 */

export const EMBED_BATCH_SIZE = 64

export const INGEST_ERRORS = {
  NO_CHUNKS: "El documento no contiene texto para indexar.",
  TRANSIENT: "No se pudo indexar el documento por un error temporal. Puede reintentar la indexación.",
} as const

export type IngestResult =
  | { status: "READY"; chunkCount: number }
  | { status: "FAILED"; retriable: boolean }
  | { status: "SKIPPED" }

function embeddingInput(chunk: Chunk): string {
  return chunk.heading ? `${chunk.heading}\n\n${chunk.content}` : chunk.content
}

async function embed(chunks: Chunk[]): Promise<number[][]> {
  const model = embeddingModel()
  const providerOptions = embeddingProviderOptions()
  const vectors: number[][] = []
  for (let start = 0; start < chunks.length; start += EMBED_BATCH_SIZE) {
    const batch = chunks.slice(start, start + EMBED_BATCH_SIZE)
    const { embeddings } = await embedMany({ model, values: batch.map(embeddingInput), providerOptions, maxRetries: 2 })
    vectors.push(...embeddings)
  }
  return vectors
}

async function fail(documentId: string, error: string, retriable: boolean): Promise<IngestResult> {
  await prisma.knowledgeDocument.update({ where: { id: documentId }, data: { status: "FAILED", error, retriable } })
  return { status: "FAILED", retriable }
}

export async function ingestKnowledgeDocument(
  documentId: string,
  options: { isLastAttempt: boolean }
): Promise<IngestResult> {
  const document = await prisma.knowledgeDocument.findUnique({ where: { id: documentId } })
  if (!document || !document.isActive) return { status: "SKIPPED" }

  await prisma.knowledgeDocument.update({ where: { id: documentId }, data: { status: "PROCESSING" } })
  const config = getAiConfig()

  let chunks: Chunk[]
  let vectors: number[][]
  try {
    const bytes = await getObjectBytes(document.s3Key, config.kbUploadMaxBytes)
    const extracted = await extractDocumentText(bytes, { fileName: document.fileName, mimeType: document.mimeType })
    if (!extracted.ok) return await fail(documentId, extracted.error, false)

    chunks = chunkDocument(extracted.text)
    if (chunks.length === 0) return await fail(documentId, INGEST_ERRORS.NO_CHUNKS, false)

    vectors = await embed(chunks)
    // Checked before the transaction so a bad response never replaces good chunks.
    const valid =
      vectors.length === chunks.length &&
      vectors.every((v) => v.length === config.embeddingDimensions && v.every(Number.isFinite))
    if (!valid) throw new Error("Embedding response does not match the chunks")

    await replaceChunks(documentId, chunks, vectors, embeddingModelKey(config), config.embeddingDimensions)
  } catch (error) {
    // Never log the error object: provider errors can echo request details.
    console.error(`[kb] ingest failed for document ${documentId}${options.isLastAttempt ? " (last attempt)" : ""}`)
    if (options.isLastAttempt) return fail(documentId, INGEST_ERRORS.TRANSIENT, true)
    throw error
  }
  return { status: "READY", chunkCount: chunks.length }
}

/**
 * Deletes the document's chunks and writes the new ones in one transaction. The document row is
 * locked first, so two ingests of the same document run one after the other instead of both
 * deleting and then both inserting (which would leave duplicate chunks).
 */
async function replaceChunks(
  documentId: string,
  chunks: Chunk[],
  vectors: number[][],
  modelKey: string,
  dimensions: number
): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM knowledge_documents WHERE id = ${documentId} FOR UPDATE`)
      await tx.knowledgeChunk.deleteMany({ where: { documentId } })
      const created = await tx.knowledgeChunk.createManyAndReturn({
        data: chunks.map((chunk) => ({
          documentId,
          ordinal: chunk.ordinal,
          heading: chunk.heading,
          content: chunk.content,
          tokenCount: chunk.tokenCount,
          embeddingModel: modelKey,
          embeddingDimensions: dimensions,
        })),
        select: { id: true, ordinal: true },
      })
      const idByOrdinal = new Map(created.map((row) => [row.ordinal, row.id]))
      for (let start = 0; start < chunks.length; start += EMBED_BATCH_SIZE) {
        const rows = chunks.slice(start, start + EMBED_BATCH_SIZE).map((chunk, i) => ({
          id: idByOrdinal.get(chunk.ordinal)!,
          embedding: vectors[start + i],
        }))
        await tx.$executeRaw(setEmbeddingsSql(rows, dimensions))
      }
      await tx.knowledgeDocument.update({
        where: { id: documentId },
        data: {
          status: "READY",
          chunkCount: chunks.length,
          embeddingModel: modelKey,
          lastIndexedAt: new Date(),
          error: null,
          retriable: false,
        },
      })
    },
    // Large documents write many rows; the default 5 s interactive timeout is too tight.
    { timeout: 60_000 }
  )
}
