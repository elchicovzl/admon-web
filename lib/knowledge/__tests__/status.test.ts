import { describe, expect, it } from "vitest"
import { KNOWLEDGE_STATUS_LABEL, formatFileSize, healthBanner, isIndexing, shouldPollDocuments } from "../status"

describe("knowledge page helpers", () => {
  it("labels every status in Spanish", () => {
    expect(KNOWLEDGE_STATUS_LABEL).toEqual({
      PENDING: "En cola",
      PROCESSING: "Indexando",
      READY: "Listo",
      FAILED: "Falló",
    })
  })

  it("polls only while some document is queued or being indexed", () => {
    expect(isIndexing("PENDING")).toBe(true)
    expect(isIndexing("PROCESSING")).toBe(true)
    expect(isIndexing("READY")).toBe(false)
    expect(shouldPollDocuments([{ status: "READY" }, { status: "PROCESSING" }])).toBe(true)
    expect(shouldPollDocuments([{ status: "READY" }, { status: "FAILED" }])).toBe(false)
    expect(shouldPollDocuments([])).toBe(false)
  })

  it("formats file sizes", () => {
    expect(formatFileSize(512)).toBe("512 B")
    expect(formatFileSize(2048)).toBe("2,0 KB")
    expect(formatFileSize(15 * 1024 * 1024)).toBe("15,0 MB")
  })

  it("shows the re-index banner when the index does not match the configured model (S-KB-8)", () => {
    expect(healthBanner({ status: "REINDEX_REQUIRED", currentChunks: 0, staleChunks: 9, staleDocuments: 2 })).toEqual({
      title: "Re-indexación requerida",
      description:
        "Cambió el modelo de embeddings y el asistente no puede usar 2 documentos hasta reindexarlos. Use «Reindexar» en cada uno.",
    })
    expect(healthBanner({ status: "PARTIAL", currentChunks: 5, staleChunks: 3, staleDocuments: 1 })?.title).toBe(
      "Re-indexación requerida"
    )
    expect(healthBanner({ status: "OK", currentChunks: 5, staleChunks: 0, staleDocuments: 0 })).toBeNull()
    expect(healthBanner({ status: "EMPTY", currentChunks: 0, staleChunks: 0, staleDocuments: 0 })).toBeNull()
  })

  it("uses the singular for one document", () => {
    expect(healthBanner({ status: "PARTIAL", currentChunks: 5, staleChunks: 3, staleDocuments: 1 })?.description).toContain(
      "no puede usar 1 documento hasta reindexarlo"
    )
  })
})
