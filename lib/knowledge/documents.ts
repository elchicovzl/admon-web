import prisma from "@/lib/db/prisma"
import { embeddingModelKey } from "@/lib/ai/providers"
import { getAiConfig } from "@/lib/config/runtime-config"
import { deleteObjects, putObject } from "@/lib/storage/r2"
import { resolveDocumentKind, type DocumentKind } from "./extract"
import { enqueueKnowledgeIngest } from "./queue"

/**
 * Knowledge-base document service (KB-1, KB-2, KB-7, KB-11), shared by the upload route and the
 * Server Actions. Callers check access first (`requireWhatsAppAuth`).
 *
 * Indexing runs at most once per document at a time: an upload enqueues once, and a re-index
 * first claims the document (READY/FAILED, or stuck for 15 minutes) with a conditional update.
 */

export const DOCUMENT_ERRORS = {
  UNSUPPORTED: "Tipo de archivo no soportado. Use PDF, DOCX, TXT o MD.",
  TOO_LARGE: "El archivo supera el tamaño máximo permitido.",
  EMPTY: "El archivo está vacío.",
  CONTENT_MISMATCH: "El contenido del archivo no corresponde a su tipo.",
  STORAGE: "No se pudo guardar el archivo. Intente de nuevo.",
  NOT_QUEUED: "El documento se guardó, pero no se pudo programar la indexación. Use «Reindexar».",
  NOT_FOUND: "Documento no encontrado",
  ALREADY_INDEXING: "El documento ya se está indexando.",
} as const

/** A run that has not finished after this long is treated as lost and can be re-indexed. */
export const REINDEX_STALE_MS = 15 * 60 * 1000

const CANONICAL_MIME: Record<DocumentKind, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  md: "text/markdown",
}

const MAX_FILE_NAME_LENGTH = 120

/** Base name only, with characters outside letters, digits, space, dot, dash and underscore replaced. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? ""
  const cleaned = base.replace(/[^\p{L}\p{N} ._-]/gu, "_").trim().replace(/^\.+/, "")
  if (!cleaned) return "documento"
  if (cleaned.length <= MAX_FILE_NAME_LENGTH) return cleaned
  const dot = cleaned.lastIndexOf(".")
  const extension = dot > 0 ? cleaned.slice(dot) : ""
  return cleaned.slice(0, MAX_FILE_NAME_LENGTH - extension.length) + extension
}

/** The first bytes must match the declared type, so a renamed file is caught before indexing. */
function contentMatches(kind: DocumentKind, bytes: Uint8Array): boolean {
  if (kind === "pdf") return new TextDecoder("latin1").decode(bytes.subarray(0, 1024)).includes("%PDF-")
  if (kind === "docx") return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04
  if (bytes.includes(0)) return false
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    return true
  } catch {
    return false
  }
}

export type CreateDocumentResult =
  | { ok: true; documentId: string; queued: boolean }
  | { ok: false; error: string }

export async function createKnowledgeDocument(input: {
  bytes: Uint8Array
  fileName: string
  mimeType: string
  title?: string | null
  userId: string
}): Promise<CreateDocumentResult> {
  const fileName = safeFileName(input.fileName)
  const kind = resolveDocumentKind(fileName, input.mimeType)
  if (!kind) return { ok: false, error: DOCUMENT_ERRORS.UNSUPPORTED }
  if (input.bytes.byteLength === 0) return { ok: false, error: DOCUMENT_ERRORS.EMPTY }
  if (input.bytes.byteLength > getAiConfig().kbUploadMaxBytes) return { ok: false, error: DOCUMENT_ERRORS.TOO_LARGE }
  if (!contentMatches(kind, input.bytes)) return { ok: false, error: DOCUMENT_ERRORS.CONTENT_MISMATCH }

  const mimeType = CANONICAL_MIME[kind]
  const document = await prisma.knowledgeDocument.create({
    data: {
      title: input.title?.trim() || fileName.replace(/\.[^.]+$/, ""),
      fileName,
      mimeType,
      sizeBytes: input.bytes.byteLength,
      // Set right after the upload: the key contains the generated id.
      s3Key: "",
      uploadedById: input.userId,
      status: "PENDING",
    },
  })

  const s3Key = `knowledge/${document.id}/${fileName}`
  try {
    await putObject(s3Key, input.bytes, mimeType)
    await prisma.knowledgeDocument.update({ where: { id: document.id }, data: { s3Key } })
  } catch {
    console.error("[kb] storing an uploaded document failed")
    await prisma.knowledgeDocument.delete({ where: { id: document.id } }).catch(() => undefined)
    return { ok: false, error: DOCUMENT_ERRORS.STORAGE }
  }

  try {
    await enqueueKnowledgeIngest(document.id)
    return { ok: true, documentId: document.id, queued: true }
  } catch {
    console.error("[kb] could not queue the ingest of an uploaded document")
    await prisma.knowledgeDocument.update({
      where: { id: document.id },
      data: { status: "FAILED", error: DOCUMENT_ERRORS.NOT_QUEUED, retriable: true },
    })
    return { ok: true, documentId: document.id, queued: false }
  }
}

/** Removes the document and its chunks in one transaction (the assistant stops using it at once), then its file. */
export async function deleteKnowledgeDocument(documentId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const document = await prisma.knowledgeDocument.findUnique({ where: { id: documentId }, select: { id: true, s3Key: true } })
  if (!document) return { ok: false, error: DOCUMENT_ERRORS.NOT_FOUND }

  await prisma.$transaction([
    prisma.knowledgeChunk.deleteMany({ where: { documentId } }),
    prisma.knowledgeDocument.delete({ where: { id: documentId } }),
  ])
  if (document.s3Key) {
    try {
      await deleteObjects([document.s3Key])
    } catch {
      // The row is gone, so nothing references the file; it only costs storage.
      console.error("[kb] could not delete a removed document's file")
    }
  }
  return { ok: true }
}

export async function reindexKnowledgeDocument(
  documentId: string,
  now: Date = new Date()
): Promise<{ ok: true } | { ok: false; error: string }> {
  const claimed = await prisma.knowledgeDocument.updateMany({
    where: {
      id: documentId,
      isActive: true,
      OR: [
        { status: { in: ["READY", "FAILED"] } },
        { status: { in: ["PENDING", "PROCESSING"] }, updatedAt: { lt: new Date(now.getTime() - REINDEX_STALE_MS) } },
      ],
    },
    data: { status: "PENDING", error: null, retriable: false },
  })
  if (claimed.count === 0) {
    const document = await prisma.knowledgeDocument.findUnique({ where: { id: documentId }, select: { id: true, isActive: true } })
    return { ok: false, error: document?.isActive ? DOCUMENT_ERRORS.ALREADY_INDEXING : DOCUMENT_ERRORS.NOT_FOUND }
  }

  try {
    await enqueueKnowledgeIngest(documentId)
    return { ok: true }
  } catch {
    console.error("[kb] could not queue a re-index")
    await prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: { status: "FAILED", error: DOCUMENT_ERRORS.NOT_QUEUED, retriable: true },
    })
    return { ok: false, error: DOCUMENT_ERRORS.NOT_QUEUED }
  }
}

export interface KnowledgeHealth {
  /** EMPTY: nothing indexed. REINDEX_REQUIRED: only chunks of another embedding model (S-KB-8). PARTIAL: both. */
  status: "OK" | "EMPTY" | "REINDEX_REQUIRED" | "PARTIAL"
  currentChunks: number
  staleChunks: number
  staleDocuments: number
}

/**
 * Whether the index matches the configured embedding model and dimensions. Retrieval never mixes
 * models (KB-6), so chunks of an older model are invisible to the assistant until re-indexed.
 */
export async function getKnowledgeHealth(): Promise<KnowledgeHealth> {
  const config = getAiConfig()
  const current = { embeddingModel: embeddingModelKey(config), embeddingDimensions: config.embeddingDimensions }
  const currentChunks = await prisma.knowledgeChunk.count({ where: current })
  const staleChunks = await prisma.knowledgeChunk.count({ where: { NOT: current } })
  const staleDocuments =
    staleChunks > 0 ? await prisma.knowledgeDocument.count({ where: { chunks: { some: { NOT: current } } } }) : 0

  const status =
    staleChunks > 0 ? (currentChunks > 0 ? "PARTIAL" : "REINDEX_REQUIRED") : currentChunks > 0 ? "OK" : "EMPTY"
  return { status, currentChunks, staleChunks, staleDocuments }
}
