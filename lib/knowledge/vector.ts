import { Prisma } from "@prisma/client"

/**
 * pgvector helpers. Prisma cannot read or write `Unsupported("vector")` columns, so embeddings go
 * through raw SQL. Every value travels as a bound parameter; only the `::vector` cast is SQL text.
 */

/** `[0.1,0.2,...]`, the text form pgvector parses. Rejects a wrong size or non-finite numbers. */
export function toVectorLiteral(values: number[], dimensions: number): string {
  if (values.length !== dimensions) {
    throw new Error(`Embedding has ${values.length} dimensions, expected ${dimensions}`)
  }
  if (!values.every(Number.isFinite)) throw new Error("Embedding contains a non-finite number")
  return `[${values.join(",")}]`
}

/** One statement that sets the embedding of each chunk id. */
export function setEmbeddingsSql(rows: { id: string; embedding: number[] }[], dimensions: number): Prisma.Sql {
  const values = rows.map((row) => Prisma.sql`(${row.id}, ${toVectorLiteral(row.embedding, dimensions)})`)
  return Prisma.sql`
    UPDATE knowledge_chunks AS k
    SET embedding = v.embedding::vector
    FROM (VALUES ${Prisma.join(values)}) AS v(id, embedding)
    WHERE k.id = v.id
  `
}
