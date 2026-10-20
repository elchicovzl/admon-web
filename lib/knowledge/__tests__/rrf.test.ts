import { describe, expect, it } from "vitest"
import { RRF_K, fuseRrf } from "../rrf"

const ids = (...values: string[]) => values.map((id) => ({ id }))

describe("fuseRrf (KB-5)", () => {
  it("uses k = 60 by default", () => {
    expect(RRF_K).toBe(60)
  })

  it("scores each id by the sum of 1 / (k + rank) over both lists", () => {
    const fused = fuseRrf(ids("a", "b"), ids("b", "c"))

    expect(fused).toEqual([
      { id: "b", rrfScore: 1 / 62 + 1 / 61, vectorRank: 2, keywordRank: 1 },
      { id: "a", rrfScore: 1 / 61, vectorRank: 1, keywordRank: null },
      { id: "c", rrfScore: 1 / 62, vectorRank: null, keywordRank: 2 },
    ])
  })

  it("ranks an id found by both lists above ids found by only one", () => {
    const fused = fuseRrf(ids("a", "b", "c"), ids("c"))

    expect(fused[0].id).toBe("c")
  })

  it("breaks ties deterministically: the better single rank first, then the better vector rank", () => {
    // a: vector rank 1; x: keyword rank 1. Same score.
    expect(fuseRrf(ids("a"), ids("x")).map((f) => f.id)).toEqual(["a", "x"])
    // b and a both score 1/61 + 1/62 and both have a best rank of 1: b has the better vector rank.
    expect(fuseRrf(ids("b", "a"), ids("a", "b")).map((f) => f.id)).toEqual(["b", "a"])
  })

  it("handles one-sided and empty lists", () => {
    expect(fuseRrf(ids("a", "b"), []).map((f) => [f.id, f.keywordRank])).toEqual([
      ["a", null],
      ["b", null],
    ])
    expect(fuseRrf([], ids("z")).map((f) => [f.id, f.vectorRank, f.keywordRank])).toEqual([["z", null, 1]])
    expect(fuseRrf([], [])).toEqual([])
  })

  it("ignores repeated ids inside one list after their first (best) rank", () => {
    expect(fuseRrf(ids("a", "a", "b"), [])).toEqual([
      { id: "a", rrfScore: 1 / 61, vectorRank: 1, keywordRank: null },
      { id: "b", rrfScore: 1 / 63, vectorRank: 3, keywordRank: null },
    ])
  })

  it("accepts a custom k", () => {
    expect(fuseRrf(ids("a"), [], 0)[0].rrfScore).toBe(1)
  })
})
