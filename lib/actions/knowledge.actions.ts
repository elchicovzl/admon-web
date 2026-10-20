'use server'

import prisma from '@/lib/db/prisma'
import type { ActionResponse } from '@/lib/types/auth.types'
import type { KnowledgeDocumentItem, KnowledgeHealth } from '@/lib/types/knowledge.types'
import {
  deleteKnowledgeDocument as deleteDocument,
  getKnowledgeHealth as readHealth,
  reindexKnowledgeDocument as reindexDocument,
} from '@/lib/knowledge/documents'
import { requireWhatsAppAuth } from '@/lib/whatsapp/access'
import { knowledgeDocumentActionSchema, type KnowledgeDocumentActionInput } from '@/lib/validations/knowledge.schema'

/**
 * Knowledge-base Server Actions (KB-1). The knowledge base feeds the WhatsApp assistant, so
 * access is the WhatsApp module's (`requireWhatsAppAuth`). Uploads go through
 * POST /api/whatsapp/knowledge because Server Actions cap request bodies at 1 MB.
 */

const GENERIC_ERROR = 'No se pudo completar la operación'

/** Same contract as the WhatsApp actions: never throws, logs only the action name. */
async function guarded<T>(name: string, body: () => Promise<ActionResponse<T>>): Promise<ActionResponse<T>> {
  try {
    return await body()
  } catch {
    console.error(`[kb] ${name} failed`)
    return { success: false, error: GENERIC_ERROR }
  }
}

function validationError(issues: { message: string }[]): { success: false; error: string } {
  return { success: false, error: issues[0]?.message ?? 'Datos inválidos' }
}

export async function listKnowledgeDocuments(): Promise<ActionResponse<KnowledgeDocumentItem[]>> {
  return guarded('listKnowledgeDocuments', async () => {
    const authCheck = await requireWhatsAppAuth()
    if (!authCheck.authorized) return { success: false, error: authCheck.error }

    const rows = await prisma.knowledgeDocument.findMany({
      where: { isActive: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        title: true,
        fileName: true,
        mimeType: true,
        sizeBytes: true,
        status: true,
        error: true,
        retriable: true,
        chunkCount: true,
        embeddingModel: true,
        lastIndexedAt: true,
        createdAt: true,
        updatedAt: true,
        uploadedBy: { select: { name: true } },
      },
    })
    return {
      success: true,
      data: rows.map(({ uploadedBy, lastIndexedAt, createdAt, updatedAt, ...row }) => ({
        ...row,
        lastIndexedAt: lastIndexedAt?.toISOString() ?? null,
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
        uploadedByName: uploadedBy?.name ?? null,
      })),
    }
  })
}

/** Removes the document and its chunks at once: the assistant stops using it immediately (KB-7). */
export async function deleteKnowledgeDocument(
  input: KnowledgeDocumentActionInput
): Promise<ActionResponse<{ id: string }>> {
  return guarded('deleteKnowledgeDocument', async () => {
    const authCheck = await requireWhatsAppAuth()
    if (!authCheck.authorized) return { success: false, error: authCheck.error }
    const parsed = knowledgeDocumentActionSchema.safeParse(input)
    if (!parsed.success) return validationError(parsed.error.issues)

    const outcome = await deleteDocument(parsed.data.documentId)
    return outcome.ok ? { success: true, data: { id: parsed.data.documentId } } : { success: false, error: outcome.error }
  })
}

/** Queues a fresh index of the document (after a failure or an embedding-model change). */
export async function reindexKnowledgeDocument(
  input: KnowledgeDocumentActionInput
): Promise<ActionResponse<{ id: string }>> {
  return guarded('reindexKnowledgeDocument', async () => {
    const authCheck = await requireWhatsAppAuth()
    if (!authCheck.authorized) return { success: false, error: authCheck.error }
    const parsed = knowledgeDocumentActionSchema.safeParse(input)
    if (!parsed.success) return validationError(parsed.error.issues)

    const outcome = await reindexDocument(parsed.data.documentId)
    return outcome.ok ? { success: true, data: { id: parsed.data.documentId } } : { success: false, error: outcome.error }
  })
}

/** Whether the index matches the configured embedding model (S-KB-8, "re-indexación requerida"). */
export async function getKnowledgeHealth(): Promise<ActionResponse<KnowledgeHealth>> {
  return guarded('getKnowledgeHealth', async () => {
    const authCheck = await requireWhatsAppAuth()
    if (!authCheck.authorized) return { success: false, error: authCheck.error }

    return { success: true, data: await readHealth() }
  })
}
