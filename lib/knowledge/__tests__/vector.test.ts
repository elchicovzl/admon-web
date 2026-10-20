import { describe, expect, it } from "vitest"
import { setEmbeddingsSql, toVectorLiteral } from "../vector"

describe("toVectorLiteral", () => {
  it("renders a pgvector literal", () => {
    expect(toVectorLiteral([0.5, -1, 0], 3)).toBe("[0.5,-1,0]")
  })

  it("rejects a vector of the wrong size or with non-finite numbers", () => {
    expect(() => toVectorLiteral([1, 2], 3)).toThrow("dimensions")
    expect(() => toVectorLiteral([1, Number.NaN, 3], 3)).toThrow("finite")
    expect(() => toVectorLiteral([1, Number.POSITIVE_INFINITY, 3], 3)).toThrow("finite")
  })
})

describe("setEmbeddingsSql", () => {
  it("updates every chunk's embedding in one statement, casting bound literals to vector", () => {
    const sql = setEmbeddingsSql(
      [
        { id: "c1", embedding: [1, 0, 0] },
        { id: "c2", embedding: [0, 1, 0] },
      ],
      3
    )

    expect(sql.sql).toMatch(/UPDATE\s+knowledge_chunks/i)
    expect(sql.sql).toContain("::vector")
    expect(sql.values).toEqual(["c1", "[1,0,0]", "c2", "[0,1,0]"])
  })

  it("never interpolates ids into the SQL text", () => {
    const sql = setEmbeddingsSql([{ id: "x'); DROP TABLE users; --", embedding: [1, 0, 0] }], 3)

    expect(sql.sql).not.toContain("DROP TABLE")
  })
})
