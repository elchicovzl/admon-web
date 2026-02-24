import { z } from 'zod'
import { ClientType, IdentificationType, DocumentCategory } from '@prisma/client'

// Legal Representative schema (for companies)
export const legalRepresentativeSchema = z.object({
  fullName: z
    .string()
    .min(1, 'El nombre del representante legal es requerido')
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(100, 'El nombre no puede exceder 100 caracteres'),
  identificationType: z.nativeEnum(IdentificationType, {
    required_error: 'El tipo de identificación del representante es requerido',
  }),
  identificationNumber: z
    .string()
    .min(1, 'El número de identificación del representante es requerido')
    .min(5, 'El número de identificación debe tener al menos 5 caracteres')
    .max(20, 'El número de identificación no puede exceder 20 caracteres'),
  email: z
    .string()
    .email('Email inválido')
    .optional()
    .or(z.literal('')),
  phone: z
    .string()
    .min(7, 'El teléfono debe tener al menos 7 caracteres')
    .max(20, 'El teléfono no puede exceder 20 caracteres')
    .optional()
    .or(z.literal('')),
})

export type LegalRepresentativeInput = z.infer<typeof legalRepresentativeSchema>

// Create client schema
export const createClientSchema = z
  .object({
    fullName: z
      .string()
      .min(1, 'El nombre completo es requerido')
      .min(3, 'El nombre debe tener al menos 3 caracteres')
      .max(100, 'El nombre no puede exceder 100 caracteres'),
    clientType: z.nativeEnum(ClientType, {
      required_error: 'El tipo de cliente es requerido',
    }),
    identificationType: z.nativeEnum(IdentificationType, {
      required_error: 'El tipo de identificación es requerido',
    }),
    identificationNumber: z
      .string()
      .min(1, 'El número de identificación es requerido')
      .min(4, 'El número de identificación debe tener al menos 4 caracteres')
      .max(20, 'El número de identificación no puede exceder 20 caracteres'),
    email: z
      .string()
      .min(1, 'El email es requerido')
      .email('Email inválido'),
    phone: z
      .string()
      .min(1, 'El teléfono es requerido')
      .min(7, 'El teléfono debe tener al menos 7 caracteres')
      .max(20, 'El teléfono no puede exceder 20 caracteres'),
    // Legal representative (conditional - required for companies)
    legalRepresentative: legalRepresentativeSchema.optional(),
  })
  .refine(
    (data) => {
      // If clientType is EMPRESA, legalRepresentative is required
      if (data.clientType === ClientType.EMPRESA) {
        return !!data.legalRepresentative
      }
      return true
    },
    {
      message: 'El representante legal es requerido para empresas',
      path: ['legalRepresentative'],
    }
  )

export type CreateClientInput = z.infer<typeof createClientSchema>

// Update client schema
export const updateClientSchema = z.object({
  fullName: z
    .string()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(100, 'El nombre no puede exceder 100 caracteres')
    .optional(),
  clientType: z
    .nativeEnum(ClientType)
    .optional(),
  identificationType: z
    .nativeEnum(IdentificationType)
    .optional(),
  identificationNumber: z
    .string()
    .min(4, 'El número de identificación debe tener al menos 4 caracteres')
    .max(20, 'El número de identificación no puede exceder 20 caracteres')
    .optional(),
  email: z
    .string()
    .email('Email inválido')
    .optional(),
  phone: z
    .string()
    .min(7, 'El teléfono debe tener al menos 7 caracteres')
    .max(20, 'El teléfono no puede exceder 20 caracteres')
    .optional(),
})

export type UpdateClientInput = z.infer<typeof updateClientSchema>

// Toggle client status schema
export const toggleClientStatusSchema = z.object({
  clientId: z.string().cuid('ID de cliente inválido'),
  isActive: z.boolean(),
})

export type ToggleClientStatusInput = z.infer<typeof toggleClientStatusSchema>

// Add client note schema
export const addClientNoteSchema = z.object({
  clientId: z.string().cuid('ID de cliente inválido'),
  content: z
    .string()
    .min(1, 'El contenido de la nota es requerido')
    .min(3, 'La nota debe tener al menos 3 caracteres')
    .max(5000, 'La nota no puede exceder 5000 caracteres'),
})

export type AddClientNoteInput = z.infer<typeof addClientNoteSchema>

// Delete client note schema
export const deleteClientNoteSchema = z.object({
  noteId: z.string().cuid('ID de nota inválido'),
})

export type DeleteClientNoteInput = z.infer<typeof deleteClientNoteSchema>

// Upload document schema (metadata validation)
export const uploadDocumentSchema = z.object({
  clientId: z.string().cuid('ID de cliente inválido'),
  fileName: z
    .string()
    .min(1, 'El nombre del archivo es requerido'),
  fileType: z
    .string()
    .min(1, 'El tipo de archivo es requerido'),
  fileSize: z
    .number()
    .min(1, 'El tamaño del archivo debe ser mayor a 0')
    .max(10485760, 'El archivo no puede exceder 10MB'), // 10MB limit
  category: z
    .nativeEnum(DocumentCategory)
    .default(DocumentCategory.GENERAL)
    .optional(),
})

export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>

// Delete document schema
export const deleteDocumentSchema = z.object({
  documentId: z.string().cuid('ID de documento inválido'),
})

export type DeleteDocumentInput = z.infer<typeof deleteDocumentSchema>

// Get client schema
export const getClientSchema = z.object({
  id: z.string().cuid('ID de cliente inválido'),
})

export type GetClientInput = z.infer<typeof getClientSchema>

// Assign employee to company schema
export const assignEmployeeToCompanySchema = z.object({
  employeeId: z.string().cuid('ID de empleado inválido'),
  companyId: z.string().cuid('ID de empresa inválido'),
})

export type AssignEmployeeToCompanyInput = z.infer<typeof assignEmployeeToCompanySchema>

// Remove employee from company schema
export const removeEmployeeFromCompanySchema = z.object({
  employeeId: z.string().cuid('ID de empleado inválido'),
})

export type RemoveEmployeeFromCompanyInput = z.infer<typeof removeEmployeeFromCompanySchema>

// Get company employees schema
export const getCompanyEmployeesSchema = z.object({
  companyId: z.string().cuid('ID de empresa inválido'),
})

export type GetCompanyEmployeesInput = z.infer<typeof getCompanyEmployeesSchema>
