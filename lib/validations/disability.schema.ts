import { z } from 'zod'
import { DisabilityStatus, HealthAdministrator } from '@prisma/client'

// Create disability schema
export const createDisabilitySchema = z.object({
  receptionDate: z.date({
    required_error: 'La fecha de recepción es requerida',
  }),
  status: z.nativeEnum(DisabilityStatus, {
    required_error: 'El status es requerido',
  }),
  clientId: z.string().cuid('ID de cliente inválido'),
  employeeId: z.string().cuid('ID de empleado inválido'),
  administrator: z.nativeEnum(HealthAdministrator, {
    required_error: 'La administradora es requerida',
  }),
  startDate: z.date({
    required_error: 'La fecha de inicio es requerida',
  }),
  endDate: z.date({
    required_error: 'La fecha de finalización es requerida',
  }),
  bankRegistry: z.boolean().default(false),
  transcription: z
    .string()
    .min(1, 'La transcripción es requerida')
    .max(10000, 'La transcripción no puede exceder 10000 caracteres'),
  filing: z
    .string()
    .min(1, 'La radicación es requerida')
    .max(10000, 'La radicación no puede exceder 10000 caracteres'),
  proofFileUrl: z.string().url('URL inválida').optional().nullable(),
})

export type CreateDisabilityInput = z.infer<typeof createDisabilitySchema>

// Update disability schema
export const updateDisabilitySchema = z.object({
  receptionDate: z.date().optional(),
  status: z.nativeEnum(DisabilityStatus).optional(),
  clientId: z.string().cuid('ID de cliente inválido').optional(),
  employeeId: z.string().cuid('ID de empleado inválido').optional(),
  administrator: z.nativeEnum(HealthAdministrator).optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  bankRegistry: z.boolean().optional(),
  transcription: z
    .string()
    .min(1, 'La transcripción es requerida')
    .max(10000, 'La transcripción no puede exceder 10000 caracteres')
    .optional(),
  filing: z
    .string()
    .min(1, 'La radicación es requerida')
    .max(10000, 'La radicación no puede exceder 10000 caracteres')
    .optional(),
  proofFileUrl: z.string().url('URL inválida').optional().nullable(),
})

export type UpdateDisabilityInput = z.infer<typeof updateDisabilitySchema>

// Toggle disability status schema
export const toggleDisabilityStatusSchema = z.object({
  disabilityId: z.string().cuid('ID de incapacidad inválido'),
  isActive: z.boolean(),
})

export type ToggleDisabilityStatusInput = z.infer<typeof toggleDisabilityStatusSchema>

// Add disability observation schema
export const addDisabilityObservationSchema = z.object({
  disabilityId: z.string().cuid('ID de incapacidad inválido'),
  content: z
    .string()
    .min(1, 'El contenido de la observación es requerido')
    .min(3, 'La observación debe tener al menos 3 caracteres')
    .max(5000, 'La observación no puede exceder 5000 caracteres'),
})

export type AddDisabilityObservationInput = z.infer<typeof addDisabilityObservationSchema>

// Delete disability observation schema
export const deleteDisabilityObservationSchema = z.object({
  observationId: z.string().cuid('ID de observación inválido'),
})

export type DeleteDisabilityObservationInput = z.infer<typeof deleteDisabilityObservationSchema>

// Get disability schema
export const getDisabilitySchema = z.object({
  id: z.string().cuid('ID de incapacidad inválido'),
})

export type GetDisabilityInput = z.infer<typeof getDisabilitySchema>
