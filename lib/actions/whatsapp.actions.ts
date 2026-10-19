'use server'

import prisma from '@/lib/db/prisma'
import type { ActionResponse } from '@/lib/types/auth.types'
import { requireWhatsAppAuth } from '@/lib/whatsapp/access'
import { presignGet } from '@/lib/storage/r2'
import { getMediaUrlSchema } from '@/lib/validations/whatsapp.schema'

export interface MediaUrl {
  url: string
  mimeType: string
  fileName: string | null
  expiresInSeconds: number
}

const MEDIA_URL_TTL_SECONDS = 600
/** Types the browser can render inline; everything else is offered as a download. */
const INLINE_MIME = /^(image|audio|video)\/|^application\/pdf$/

/**
 * Presigned URL (10 min) for a stored WhatsApp attachment (MH-2). Module access (SUPER_ADMIN, or a MANAGER with canAccessWhatsApp) is checked first and
 * the R2 key never leaves the server; the Meta URL was never stored (MH-1).
 */
export async function getMediaUrl(input: { messageId: string }): Promise<ActionResponse<MediaUrl>> {
  try {
    const authCheck = await requireWhatsAppAuth()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const parsed = getMediaUrlSchema.safeParse(input)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
    }

    const media = await prisma.whatsAppMedia.findUnique({
      where: { messageId: parsed.data.messageId },
      select: { status: true, s3Key: true, mimeType: true, fileName: true, r2DeletedAt: true },
    })
    if (!media) {
      return { success: false, error: 'Archivo no encontrado' }
    }
    if (media.status === 'PENDING') {
      return { success: false, error: 'El archivo aún se está descargando' }
    }
    if (media.status !== 'STORED' || !media.s3Key || media.r2DeletedAt) {
      return { success: false, error: 'El archivo no está disponible' }
    }

    const url = await presignGet(media.s3Key, {
      expiresInSeconds: MEDIA_URL_TTL_SECONDS,
      contentType: media.mimeType,
      fileName: media.fileName ?? undefined,
      disposition: INLINE_MIME.test(media.mimeType) ? 'inline' : 'attachment',
    })

    return {
      success: true,
      data: { url, mimeType: media.mimeType, fileName: media.fileName, expiresInSeconds: MEDIA_URL_TTL_SECONDS },
    }
  } catch {
    // Never log the error object: it could carry a signed URL or storage details.
    console.error('[whatsapp] getMediaUrl failed')
    return { success: false, error: 'No se pudo obtener el archivo' }
  }
}
