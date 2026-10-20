import { NextRequest, NextResponse } from 'next/server'
import { getAiConfig } from '@/lib/config/runtime-config'
import { createKnowledgeDocument } from '@/lib/knowledge/documents'
import { readCappedBody } from '@/lib/utils/read-capped-body'
import { requireWhatsAppAuth, WHATSAPP_ERROR_NOT_AUTHENTICATED } from '@/lib/whatsapp/access'
import { knowledgeUploadFieldsSchema } from '@/lib/validations/knowledge.schema'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Knowledge-base upload (KB-2, KB-11). A route handler, not a Server Action, because Server
 * Actions cap bodies at 1 MB and documents go up to KB_UPLOAD_MAX_BYTES (same reason as the media
 * route). Middleware does not cover /api, so access is checked here first. Type, size and content
 * checks live in the shared service (lib/knowledge/documents.ts).
 */

/** Multipart overhead and the title on top of the largest allowed file. */
const MULTIPART_OVERHEAD_BYTES = 64 * 1024

function json(body: { success: boolean; data?: unknown; error?: string }, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest) {
  try {
    const authCheck = await requireWhatsAppAuth()
    if (!authCheck.authorized) {
      return json(
        { success: false, error: authCheck.error },
        authCheck.error === WHATSAPP_ERROR_NOT_AUTHENTICATED ? 401 : 403
      )
    }

    const body = await readCappedBody(request, getAiConfig().kbUploadMaxBytes + MULTIPART_OVERHEAD_BYTES)
    if (body === null) return json({ success: false, error: 'El archivo supera el tamaño máximo permitido.' }, 413)

    let form: FormData
    try {
      form = await new Response(body, {
        headers: { 'content-type': request.headers.get('content-type') ?? '' },
      }).formData()
    } catch {
      return json({ success: false, error: 'Solicitud inválida' }, 400)
    }

    const file = form.get('file')
    if (!(file instanceof File)) return json({ success: false, error: 'No se proporcionó un archivo' }, 400)

    const fields = knowledgeUploadFieldsSchema.safeParse({ title: form.get('title') ?? undefined })
    if (!fields.success) {
      return json({ success: false, error: fields.error.issues[0]?.message ?? 'Datos inválidos' }, 400)
    }

    const result = await createKnowledgeDocument({
      bytes: new Uint8Array(await file.arrayBuffer()),
      fileName: file.name,
      mimeType: file.type,
      title: fields.data.title,
      userId: authCheck.userId,
    })
    if (!result.ok) return json({ success: false, error: result.error }, 400)
    return json({ success: true, data: { documentId: result.documentId, queued: result.queued } }, 201)
  } catch {
    console.error('[kb] upload failed')
    return json({ success: false, error: 'No se pudo subir el documento' }, 500)
  }
}
