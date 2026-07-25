import { z } from 'zod'
import { ClientType, IdentificationType, DocumentCategory, EmployeeType, WorkDaysRange } from '@prisma/client'

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
export type UpdateLegalRepresentativeInput = LegalRepresentativeInput

// Create client schema
// NOTE (Phase 2): employeeType / workDaysRange are accepted here for legacy/dual-write
// compatibility, but are no longer *required* — they now belong to the Employment join table.
// The UI forms that manage employment (assign-employee-dialog, create-employee-dialog)
// enforce them client-side and route them to createEmployment().
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
    // Phase 2: still accepted (shadow write), but no longer required — Employment owns these
    employeeType: z.nativeEnum(EmployeeType).optional(),
    workDaysRange: z.nativeEnum(WorkDaysRange).optional(),
    // Legal representative (conditional - required for companies)
    legalRepresentative: legalRepresentativeSchema.optional(),
  })
  .refine(
    (data) => {
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

// Create employee schema (email and phone are optional)
export const createEmployeeSchema = z
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
      .email('Email inválido')
      .or(z.literal('')),
    phone: z
      .string()
      .min(7, 'El teléfono debe tener al menos 7 caracteres')
      .max(20, 'El teléfono no puede exceder 20 caracteres')
      .or(z.literal('')),
    employeeType: z.nativeEnum(EmployeeType).optional(),
    workDaysRange: z.nativeEnum(WorkDaysRange).optional(),
  })
  .refine(
    (data) => !!data.employeeType,
    {
      message: 'El tipo de empleado es requerido',
      path: ['employeeType'],
    }
  )
  .refine(
    (data) => {
      if (data.employeeType === EmployeeType.TIEMPO_PARCIAL) {
        return !!data.workDaysRange
      }
      return true
    },
    {
      message: 'Los días laborados son requeridos para tiempo parcial',
      path: ['workDaysRange'],
    }
  )

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>

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
  employeeType: z
    .nativeEnum(EmployeeType)
    .optional()
    .nullable(),
  workDaysRange: z
    .nativeEnum(WorkDaysRange)
    .optional()
    .nullable(),
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

// Update client schema with optional contact info (address + additional info)
// Used in the unified "Editar Cliente" dialog where contact-related fields are grouped together.
export const updateClientWithContactSchema = updateClientSchema
  .extend({
    address: z
      .object({
        departamento: z.string().optional().or(z.literal('')),
        municipio: z.string().optional().or(z.literal('')),
        ciudad: z.string().optional().or(z.literal('')),
        direccion: z
          .string()
          .max(500, 'La dirección no puede exceder 500 caracteres')
          .optional()
          .or(z.literal('')),
      })
      .optional(),
    additionalInfo: z
      .object({
        actividadComercial: z
          .string()
          .max(200, 'La actividad comercial no puede exceder 200 caracteres')
          .optional()
          .or(z.literal('')),
        salario: z
          .union([z.number().positive('El salario debe ser positivo'), z.null()])
          .optional(),
        fechaIngreso: z.string().optional().or(z.literal('')),
        fechaRetiro: z.string().optional().or(z.literal('')),
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    const a = data.address
    if (a) {
      const anyFilled = !!(a.departamento || a.municipio || a.ciudad || a.direccion)
      if (anyFilled) {
        if (!a.departamento) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['address', 'departamento'],
            message: 'El departamento es requerido',
          })
        }
        if (!a.municipio) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['address', 'municipio'],
            message: 'El municipio es requerido',
          })
        }
        if (!a.direccion) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['address', 'direccion'],
            message: 'La dirección es requerida',
          })
        } else if (a.direccion.length < 5) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['address', 'direccion'],
            message: 'La dirección debe tener al menos 5 caracteres',
          })
        }
      }
    }
  })

export type UpdateClientWithContactInput = z.infer<typeof updateClientWithContactSchema>

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

// Get company employees schema
export const getCompanyEmployeesSchema = z.object({
  companyId: z.string().cuid('ID de empresa inválido'),
})

export type GetCompanyEmployeesInput = z.infer<typeof getCompanyEmployeesSchema>
