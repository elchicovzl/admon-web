import { describe, expect, it } from "vitest"
import { CHUNK_DEFAULTS, chunkDocument, estimateTokens } from "../chunk"

/** A paragraph of roughly `tokens` tokens (4 chars each), made of distinct words. */
function paragraph(tokens: number, seed: string): string {
  const words: string[] = []
  let length = 0
  for (let i = 0; length < tokens * 4; i++) {
    const word = `${seed}${i}`
    words.push(word)
    length += word.length + 1
  }
  return words.join(" ")
}

describe("estimateTokens", () => {
  it("counts about one token per four characters", () => {
    expect(estimateTokens("abcd")).toBe(1)
    expect(estimateTokens("abcde")).toBe(2)
    expect(estimateTokens("")).toBe(0)
  })
})

describe("chunkDocument (KB-4)", () => {
  it("uses the design defaults: ~600 target, 800 max, ~80 overlap", () => {
    expect(CHUNK_DEFAULTS).toEqual({ targetTokens: 600, maxTokens: 800, overlapTokens: 80 })
  })

  it("returns nothing for blank text", () => {
    expect(chunkDocument("   \n\n  ")).toEqual([])
  })

  it("keeps a short document as one chunk with ordinal 0 and no heading", () => {
    const chunks = chunkDocument("Hola.\n\nSegundo párrafo.")

    expect(chunks).toEqual([{ ordinal: 0, heading: null, content: "Hola.\n\nSegundo párrafo.", tokenCount: 6 }])
  })

  it("starts a new chunk at each heading and records the heading on its chunks", () => {
    const text = "# Requisitos\n\nSe necesita la cédula.\n\n## Tiempos\n\nTres días hábiles."
    const chunks = chunkDocument(text)

    expect(chunks.map((c) => [c.ordinal, c.heading, c.content])).toEqual([
      [0, "Requisitos", "Se necesita la cédula."],
      [1, "Tiempos", "Tres días hábiles."],
    ])
  })

  it("splits long sections near the target, never above the max, with ordinals in order", () => {
    const text = ["# Guía", paragraph(300, "a"), paragraph(300, "b"), paragraph(300, "c"), paragraph(300, "d")].join("\n\n")
    const chunks = chunkDocument(text)

    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.map((c) => c.ordinal)).toEqual(chunks.map((_, i) => i))
    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBeLessThanOrEqual(CHUNK_DEFAULTS.maxTokens)
      expect(chunk.tokenCount).toBe(estimateTokens(chunk.content))
      expect(chunk.heading).toBe("Guía")
    }
  })

  it("repeats about 80 tokens of the previous chunk at the start of the next one in the same section", () => {
    const text = [paragraph(500, "a"), paragraph(500, "b")].join("\n\n")
    const [first, second] = chunkDocument(text)

    const overlap = second.content.slice(0, second.content.indexOf("b0"))
    expect(first.content.endsWith(overlap.trim())).toBe(true)
    expect(estimateTokens(overlap)).toBeGreaterThanOrEqual(60)
    expect(estimateTokens(overlap)).toBeLessThanOrEqual(100)
  })

  it("does not carry overlap across a heading", () => {
    const text = ["# Uno", paragraph(500, "a"), "# Dos", paragraph(100, "b")].join("\n\n")
    const chunks = chunkDocument(text)
    const dos = chunks.find((c) => c.heading === "Dos")!

    expect(dos.content.startsWith("b0")).toBe(true)
  })

  it("hard-splits a single paragraph larger than the max", () => {
    const chunks = chunkDocument(paragraph(2000, "x"))

    expect(chunks.length).toBeGreaterThanOrEqual(3)
    for (const chunk of chunks) expect(chunk.tokenCount).toBeLessThanOrEqual(CHUNK_DEFAULTS.maxTokens)
  })

  it("honours maxTokens when custom options leave little room for the overlap", () => {
    const options = { targetTokens: 500, maxTokens: 300, overlapTokens: 50 }
    const chunks = chunkDocument([paragraph(400, "a"), paragraph(400, "b"), paragraph(900, "c")].join("\n\n"), options)

    expect(chunks.length).toBeGreaterThan(3)
    for (const chunk of chunks) expect(chunk.tokenCount).toBeLessThanOrEqual(options.maxTokens)
  })

  it("is deterministic", () => {
    const text = ["# A", paragraph(900, "a"), "## B", paragraph(700, "b")].join("\n\n")

    expect(chunkDocument(text)).toEqual(chunkDocument(text))
  })
})
