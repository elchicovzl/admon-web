/**
 * Zod validation schemas for Affiliation Module
 * Afiliaciones a Seguridad Social
 */

import { z } from 'zod'
import { AffiliationSubProcessType, AffiliationSubProcessStatus, AffiliationDocumentCategory } from '@prisma/client'

// ========================================
// AFFILIATION SCHEMAS
// ========================================

export const createAffiliationSchema = z.object({
  clientId: z.string().cuid('ID de cliente inválido'),
  subProcesses: z
    .array(
      z.object({
        type: z.nativeEnum(AffiliationSubProcessType, {
          required_error: 'El tipo de sub-proceso es requerido',
        }),
        assignedToId: z.string().cuid('ID de manager inválido').optional().nullable(),
        employeeId: z.string().cuid('ID de empleado inválido').optional().nullable(),
      })
    )
    .min(1, 'Debe seleccionar al menos un sub-proceso'),
})

export const updateAffiliationSchema = z.object({
  isActive: z.boolean().optional(),
})

export const getAffiliationSchema = z.object({
  id: z.string().cuid('ID de afiliación inválido'),
})

export const toggleAffiliationStatusSchema = z.object({
  affiliationId: z.string().cuid('ID de afiliación inválido'),
  isActive: z.boolean(),
})

// ========================================
// SUB-PROCESS SCHEMAS
// ========================================

export const updateSubProcessStatusSchema = z.object({
  subProcessId: z.string().cuid('ID de sub-proceso inválido'),
  status: z.nativeEnum(AffiliationSubProcessStatus, {
    required_error: 'El status es requerido',
  }),
  reason: z
    .string()
    .min(3, 'La razón debe tener al menos 3 caracteres')
    .max(1000, 'La razón no puede exceder 1000 caracteres')
    .optional()
    .nullable(),
})

export const assignSubProcessSchema = z.object({
  subProcessId: z.string().cuid('ID de sub-proceso inválido'),
  managerId: z.string().cuid('ID de manager inválido').nullable(),
})

export const addSubProcessesSchema = z.object({
  affiliationId: z.string().cuid('ID de afiliación inválido'),
  subProcesses: z
    .array(
      z.object({
        type: z.nativeEnum(AffiliationSubProcessType, {
          required_error: 'El tipo de sub-proceso es requerido',
        }),
        assignedToId: z.string().cuid('ID de manager inválido').optional().nullable(),
        employeeId: z.string().cuid('ID de empleado inválido').optional().nullable(),
      })
    )
    .min(1, 'Debe agregar al menos un sub-proceso'),
})

export type AddSubProcessesInput = z.infer<typeof addSubProcessesSchema>

export const getSubProcessSchema = z.object({
  id: z.string().cuid('ID de sub-proceso inválido'),
})

// ========================================
// DOCUMENT SCHEMAS
// ========================================

export const uploadDocumentSchema = z.object({
  subProcessId: z.string().cuid('ID de sub-proceso inválido'),
  fileName: z
    .string()
    .min(1, 'El nombre del archivo es requerido')
    .max(255, 'El nombre del archivo es demasiado largo'),
  fileType: z.string().min(1, 'El tipo de archivo es requerido'),
  fileSize: z.number().int().positive('El tamaño del archivo debe ser positivo'),
  category: z.nativeEnum(AffiliationDocumentCategory).optional(),
})

export const deleteDocumentSchema = z.object({
  documentId: z.string().cuid('ID de documento inválido'),
})

export const generateUploadUrlSchema = z.object({
  subProcessId: z.string().cuid('ID de sub-proceso inválido'),
  fileName: z
    .string()
    .min(1, 'El nombre del archivo es requerido')
    .max(255, 'El nombre del archivo es demasiado largo'),
  fileType: z.string().min(1, 'El tipo de archivo es requerido'),
  fileSize: z.number().int().positive('El tamaño del archivo debe ser positivo'),
  category: z.nativeEnum(AffiliationDocumentCategory).default(AffiliationDocumentCategory.GENERAL),
})

export const confirmUploadSchema = z.object({
  subProcessId: z.string().cuid('ID de sub-proceso inválido'),
  fileName: z.string().min(1, 'El nombre del archivo es requerido'),
  fileType: z.string().min(1, 'El tipo de archivo es requerido'),
  fileSize: z.number().int().positive('El tamaño del archivo debe ser positivo'),
  s3Key: z.string().min(1, 'El S3 key es requerido'),
  category: z.nativeEnum(AffiliationDocumentCategory).default(AffiliationDocumentCategory.GENERAL),
})

// ========================================
// OBSERVATION SCHEMAS
// ========================================

export const addObservationSchema = z.object({
  subProcessId: z.string().cuid('ID de sub-proceso inválido'),
  content: z
    .string()
    .min(3, 'La observación debe tener al menos 3 caracteres')
    .max(5000, 'La observación no puede exceder 5000 caracteres'),
})

export const deleteObservationSchema = z.object({
  observationId: z.string().cuid('ID de observación inválido'),
})

// ========================================
// QUERY SCHEMAS
// ========================================

export const getMyAssignmentsSchema = z.object({
  status: z.nativeEnum(AffiliationSubProcessStatus).optional(),
})

export const getSubProcessStatusLogsSchema = z.object({
  subProcessId: z.string().cuid('ID de sub-proceso inválido'),
})

// ========================================
// TYPE EXPORTS (inferred from schemas)
// ========================================

export type CreateAffiliationInput = z.infer<typeof createAffiliationSchema>
export type UpdateAffiliationInput = z.infer<typeof updateAffiliationSchema>
export type GetAffiliationInput = z.infer<typeof getAffiliationSchema>
export type ToggleAffiliationStatusInput = z.infer<typeof toggleAffiliationStatusSchema>

export type UpdateSubProcessStatusInput = z.infer<typeof updateSubProcessStatusSchema>
export type AssignSubProcessInput = z.infer<typeof assignSubProcessSchema>
export type GetSubProcessInput = z.infer<typeof getSubProcessSchema>

export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>
export type DeleteDocumentInput = z.infer<typeof deleteDocumentSchema>
export type GenerateUploadUrlInput = z.infer<typeof generateUploadUrlSchema>
export type ConfirmUploadInput = z.infer<typeof confirmUploadSchema>

export type AddObservationInput = z.infer<typeof addObservationSchema>
export type DeleteObservationInput = z.infer<typeof deleteObservationSchema>

export type GetMyAssignmentsInput = z.infer<typeof getMyAssignmentsSchema>
export type GetSubProcessStatusLogsInput = z.infer<typeof getSubProcessStatusLogsSchema>
