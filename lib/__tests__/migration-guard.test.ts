import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync, existsSync } from "node:fs"
import { join } from "node:path"

/**
 * Migration guard for the knowledge base (XC-3, D13). Retrieval depends on two raw indexes
 * that Prisma cannot express in the schema, so `migrate dev` may propose dropping them as
 * drift. This guard keeps them alive:
 * - the KB migration creates both indexes, after the `vector` extension migration;
 * - no later migration drops either index (a deliberate change must update this test).
 */
const MIGRATIONS_DIR = join(process.cwd(), "prisma", "migrations")
const EXTENSION_MIGRATION_SUFFIX = "_enable_pgvector"
const KB_MIGRATION_SUFFIX = "_knowledge_base"
const PROTECTED_INDEXES = ["knowledge_chunks_embedding_hnsw", "knowledge_chunks_content_fts"]

function migrations(): { name: string; sql: string }[] {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((name) => {
      const file = join(MIGRATIONS_DIR, name, "migration.sql")
      return { name, sql: existsSync(file) ? readFileSync(file, "utf8").replace(/--[^\n]*/g, "") : "" }
    })
}

describe("knowledge base migration guard", () => {
  const all = migrations()
  const extensionIndex = all.findIndex((m) => m.name.endsWith(EXTENSION_MIGRATION_SUFFIX))
  const kbIndex = all.findIndex((m) => m.name.endsWith(KB_MIGRATION_SUFFIX))

  it("runs the vector extension migration before the knowledge base migration", () => {
    expect(extensionIndex).toBeGreaterThanOrEqual(0)
    expect(kbIndex).toBeGreaterThan(extensionIndex)
  })

  it("creates the HNSW cosine index and the Spanish full-text index in the knowledge base migration", () => {
    const sql = all[kbIndex]?.sql ?? ""
    expect(sql).toMatch(
      /CREATE INDEX\s+"?knowledge_chunks_embedding_hnsw"?\s+ON\s+"?knowledge_chunks"?\s+USING\s+hnsw\s*\(\s*"?embedding"?\s+vector_cosine_ops\s*\)/i
    )
    expect(sql).toMatch(
      /CREATE INDEX\s+"?knowledge_chunks_content_fts"?\s+ON\s+"?knowledge_chunks"?\s+USING\s+gin\s*\(\s*to_tsvector\(\s*'spanish'::regconfig\s*,\s*"?content"?\s*\)\s*\)/i
    )
  })

  it("never drops the protected indexes in a later migration", () => {
    const later = all.slice(kbIndex + 1)
    for (const { name, sql } of later) {
      for (const index of PROTECTED_INDEXES) {
        expect(sql, `${name} drops ${index}`).not.toMatch(new RegExp(`DROP\\s+INDEX[^;]*"?${index}"?`, "i"))
      }
    }
  })
})
