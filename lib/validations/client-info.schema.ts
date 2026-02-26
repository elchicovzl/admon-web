import { z } from 'zod'
import { IdentificationType } from '@prisma/client'

// Client Address Schema
export const clientAddressSchema = z.object({
  departamento: z.string().min(1, 'El departamento es requerido'),
  municipio: z.string().min(1, 'El municipio es requerido'),
  ciudad: z.string().optional(),
  direccion: z
    .string()
    .min(1, 'La dirección es requerida')
    .min(5, 'La dirección debe tener al menos 5 caracteres')
    .max(500, 'La dirección no puede exceder 500 caracteres'),
})

export type ClientAddressInput = z.infer<typeof clientAddressSchema>

// Client Additional Info Schema
export const clientAdditionalInfoSchema = z.object({
  actividadComercial: z
    .string()
    .max(200, 'La actividad comercial no puede exceder 200 caracteres')
    .optional(),
  salario: z
    .number()
    .positive('El salario debe ser un número positivo')
    .optional()
    .nullable(),
  fechaIngreso: z.string().optional().nullable(),
  fechaRetiro: z.string().optional().nullable(),
})

export type ClientAdditionalInfoInput = z.infer<typeof clientAdditionalInfoSchema>

// Client Beneficiary Schema
export const clientBeneficiarySchema = z.object({
  tipoRelacion: z.enum(['hijo', 'padre', 'conyuge', 'otro'], {
    required_error: 'El tipo de relación es requerido',
  }),
  nombreCompleto: z
    .string()
    .min(1, 'El nombre completo es requerido')
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(100, 'El nombre no puede exceder 100 caracteres'),
  identificationType: z.nativeEnum(IdentificationType, {
    required_error: 'El tipo de identificación es requerido',
  }),
  identificationNumber: z
    .string()
    .min(1, 'El número de identificación es requerido')
    .min(5, 'El número de identificación debe tener al menos 5 caracteres')
    .max(20, 'El número de identificación no puede exceder 20 caracteres'),
})

export type ClientBeneficiaryInput = z.infer<typeof clientBeneficiarySchema>

// Delete beneficiary schema
export const deleteBeneficiarySchema = z.object({
  beneficiaryId: z.string().cuid('ID de beneficiario inválido'),
})

export type DeleteBeneficiaryInput = z.infer<typeof deleteBeneficiarySchema>
