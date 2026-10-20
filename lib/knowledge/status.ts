import type { KnowledgeDocumentStatus } from "@prisma/client"
import type { KnowledgeHealth } from "./documents"

/** Pure helpers for the knowledge page (client-safe: no server imports at runtime). */

export const KNOWLEDGE_STATUS_LABEL: Record<KnowledgeDocumentStatus, string> = {
  PENDING: "En cola",
  PROCESSING: "Indexando",
  READY: "Listo",
  FAILED: "Falló",
}

/** A run that has not finished after this long is treated as lost and can be re-indexed. */
export const REINDEX_STALE_MS = 15 * 60 * 1000

export function isIndexing(status: KnowledgeDocumentStatus): boolean {
  return status === "PENDING" || status === "PROCESSING"
}

/**
 * Whether "Reindexar" is offered: always for a finished document, and for one still marked as
 * indexing once it has not changed for REINDEX_STALE_MS (a lost job). Same rule as the server claim.
 */
export function canReindex(document: { status: KnowledgeDocumentStatus; updatedAt: string }, now: Date): boolean {
  return !isIndexing(document.status) || now.getTime() - new Date(document.updatedAt).getTime() > REINDEX_STALE_MS
}

/** The page polls only while a document is queued or being indexed. */
export function shouldPollDocuments(documents: { status: KnowledgeDocumentStatus }[]): boolean {
  return documents.some((document) => isIndexing(document.status))
}

const sizeFormat = new Intl.NumberFormat("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${sizeFormat.format(bytes / 1024)} KB`
  return `${sizeFormat.format(bytes / (1024 * 1024))} MB`
}

/** "Re-indexación requerida" banner, or null when the index matches the configured model. */
export function healthBanner(health: KnowledgeHealth): { title: string; description: string } | null {
  if (health.status !== "REINDEX_REQUIRED" && health.status !== "PARTIAL") return null
  const count = health.staleDocuments
  const documents = count === 1 ? "1 documento hasta reindexarlo" : `${count} documentos hasta reindexarlos`
  return {
    title: "Re-indexación requerida",
    description: `Cambió el modelo de embeddings y el asistente no puede usar ${documents}. Use «Reindexar» en cada uno.`,
  }
}
