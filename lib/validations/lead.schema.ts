import { IdentificationType } from '@prisma/client'
import { z } from 'zod'
import { LEAD_NOTES_MAX_LENGTH } from '@/lib/whatsapp/leads'

export const LEADS_PAGE_SIZE_DEFAULT = 50
export const LEADS_PAGE_SIZE_MAX = 100

const leadId = z.string({ required_error: 'El lead es requerido' }).cuid('Lead inválido')

/** Optional text field: trimmed, and a blank value clears the column. */
const optionalText = (max: number, label: string) =>
  z
    .string({ invalid_type_error: `${label} inválido` })
    .trim()
    .max(max, `${label} no puede superar ${max} caracteres`)
    .transform((value) => value || null)
    .optional()

export const listLeadsSchema = z.object({
  status: z.enum(['NEW', 'CONTACTED', 'CONVERTED', 'DISCARDED'], { invalid_type_error: 'Estado inválido' }).optional(),
  q: z.string({ invalid_type_error: 'Búsqueda inválida' }).trim().max(80, 'Búsqueda demasiado larga').optional(),
  limit: z
    .number({ invalid_type_error: 'Límite inválido' })
    .int('Límite inválido')
    .min(1, 'Límite inválido')
    .max(LEADS_PAGE_SIZE_MAX, 'Límite inválido')
    .default(LEADS_PAGE_SIZE_DEFAULT),
  cursor: z.string().cuid('Cursor inválido').optional(),
})

export const updateLeadSchema = z.object({
  leadId,
  fullName: optionalText(200, 'El nombre'),
  identificationType: z.nativeEnum(IdentificationType, { invalid_type_error: 'Tipo de documento inválido' }).nullable().optional(),
  identificationNumber: optionalText(30, 'El documento'),
  email: z
    .string({ invalid_type_error: 'Correo inválido' })
    .trim()
    .max(200, 'Correo inválido')
    .refine((value) => value === '' || z.string().email().safeParse(value).success, 'Correo inválido')
    .transform((value) => value || null)
    .optional(),
  notes: optionalText(LEAD_NOTES_MAX_LENGTH, 'La nota'),
})

/** CONVERTED is not here on purpose: only `convertLead` sets it, together with the client link. */
export const setLeadStatusSchema = z.object({
  leadId,
  status: z.enum(['NEW', 'CONTACTED', 'DISCARDED'], {
    required_error: 'El estado es requerido',
    invalid_type_error: 'Estado inválido',
  }),
})

export const convertLeadSchema = z.object({
  leadId,
  clientId: z.string({ required_error: 'El cliente es requerido' }).cuid('Cliente inválido'),
})

export const leadActionSchema = z.object({ leadId })

export type ListLeadsInput = z.input<typeof listLeadsSchema>
export type UpdateLeadInput = z.input<typeof updateLeadSchema>
export type SetLeadStatusInput = z.input<typeof setLeadStatusSchema>
export type ConvertLeadInput = z.input<typeof convertLeadSchema>
export type LeadActionInput = z.input<typeof leadActionSchema>
