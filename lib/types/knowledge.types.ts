import type { KnowledgeDocumentStatus } from '@prisma/client'

export type { KnowledgeHealth } from '@/lib/knowledge/documents'

/** A knowledge-base document as the knowledge page shows it. Dates are ISO strings. */
export interface KnowledgeDocumentItem {
  id: string
  title: string
  fileName: string
  mimeType: string
  sizeBytes: number
  status: KnowledgeDocumentStatus
  error: string | null
  retriable: boolean
  chunkCount: number
  embeddingModel: string | null
  lastIndexedAt: string | null
  createdAt: string
  updatedAt: string
  uploadedByName: string | null
}
