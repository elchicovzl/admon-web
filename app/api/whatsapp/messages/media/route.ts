import { NextRequest, NextResponse } from 'next/server'
import { readCappedBody } from '@/lib/utils/read-capped-body'
import { MAX_DOCUMENT_BYTES } from '@/lib/whatsapp/attachments'
import { requireWhatsAppAuth, WHATSAPP_ERROR_NOT_AUTHENTICATED } from '@/lib/whatsapp/access'
import { sendMediaReply } from '@/lib/whatsapp/outbound'
import { sendMediaFieldsSchema } from '@/lib/validations/whatsapp.schema'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Dashboard attachment (image or PDF) with an optional caption (WC-10).
 *
 * This is a route handler, not a Server Action, because Server Actions cap the request body at
 * 1 MB by default and raising that for the whole app is a wider change than this feature needs;
 * the affiliation uploads use a route for the same reason. Access is checked here, because
 * middleware does not cover /api: SUPER_ADMIN or a MANAGER with WhatsApp access, read from the
 * database. Everything else (window, CLOSED, handoff, limits, signatures) lives in the shared
 * service, so this behaves exactly like sendReply.
 */

/** Largest allowed file plus multipart overhead and the caption. */
const MAX_BODY_BYTES = MAX_DOCUMENT_BYTES + 512 * 1024

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

    // Capped read: a declared size above the limit is refused up front, and a chunked body
    // without Content-Length stops being read as soon as it passes the limit.
    const body = await readCappedBody(request, MAX_BODY_BYTES)
    if (body === null) {
      return json({ success: false, error: 'El archivo es demasiado grande' }, 413)
    }

    let form: FormData
    try {
      form = await new Response(body, {
        headers: { 'content-type': request.headers.get('content-type') ?? '' },
      }).formData()
    } catch {
      return json({ success: false, error: 'Solicitud inválida' }, 400)
    }

    const file = form.get('file')
    if (!(file instanceof File)) {
      return json({ success: false, error: 'No se proporcionó un archivo' }, 400)
    }

    const fields = sendMediaFieldsSchema.safeParse({
      conversationId: form.get('conversationId') ?? undefined,
      caption: form.get('caption') ?? undefined,
    })
    if (!fields.success) {
      return json({ success: false, error: fields.error.issues[0]?.message ?? 'Datos inválidos' }, 400)
    }

    const result = await sendMediaReply({
      conversationId: fields.data.conversationId,
      userId: authCheck.userId,
      caption: fields.data.caption,
      file: {
        name: file.name,
        type: file.type,
        size: file.size,
        bytes: async () => new Uint8Array(await file.arrayBuffer()),
      },
    })
    return json(result, result.success ? 200 : 400)
  } catch {
    console.error('[whatsapp] attachment upload failed')
    return json({ success: false, error: 'No se pudo enviar el archivo' }, 500)
  }
}
