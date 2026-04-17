/**
 * Zod validation schema for sending affiliation email
 */

import { z } from 'zod'

export const sendAffiliationEmailSchema = z.object({
  affiliationId: z.string().cuid('ID de afiliación inválido'),
  to: z.string().min(1, 'El destinatario es requerido').email('Email destinatario inválido'),
  cc: z.array(z.string().email('Email CC inválido')).optional().default([]),
  subject: z
    .string()
    .min(1, 'El asunto es requerido')
    .max(200, 'El asunto no puede exceder 200 caracteres'),
  emailBody: z.string().min(1, 'El cuerpo del correo es requerido').max(8000, 'El cuerpo no puede exceder 8000 caracteres'),
  emailNotes: z.string().max(2000, 'Las novedades no pueden exceder 2000 caracteres').optional().nullable(),
  selectedDocumentIds: z.array(z.string().cuid('ID de documento inválido')).optional().default([]),
})

export type SendAffiliationEmailInput = z.infer<typeof sendAffiliationEmailSchema>
