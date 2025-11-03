import { z } from 'zod'
import { AdministratorType } from '@prisma/client'

// Create credential schema
export const createCredentialSchema = z.object({
  clientId: z.string().cuid('ID de cliente inválido'),
  administratorName: z
    .string()
    .min(1, 'El nombre de la administradora es requerido')
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede exceder 100 caracteres'),
  administratorType: z.nativeEnum(AdministratorType, {
    required_error: 'El tipo de administradora es requerido',
  }),
  username: z
    .string()
    .min(1, 'El usuario es requerido')
    .max(100, 'El usuario no puede exceder 100 caracteres'),
  password: z
    .string()
    .min(1, 'La contraseña es requerida')
    .max(200, 'La contraseña no puede exceder 200 caracteres'),
  portalUrl: z
    .string()
    .url('URL inválida')
    .optional()
    .or(z.literal('')),
  notes: z
    .string()
    .max(1000, 'Las notas no pueden exceder 1000 caracteres')
    .optional(),
})

export type CreateCredentialInput = z.infer<typeof createCredentialSchema>

// Update credential schema
export const updateCredentialSchema = z.object({
  administratorName: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede exceder 100 caracteres')
    .optional(),
  administratorType: z
    .nativeEnum(AdministratorType)
    .optional(),
  username: z
    .string()
    .min(1, 'El usuario es requerido')
    .max(100, 'El usuario no puede exceder 100 caracteres')
    .optional(),
  password: z
    .string()
    .min(1, 'La contraseña es requerida')
    .max(200, 'La contraseña no puede exceder 200 caracteres')
    .optional(),
  portalUrl: z
    .string()
    .url('URL inválida')
    .optional()
    .or(z.literal('')),
  notes: z
    .string()
    .max(1000, 'Las notas no pueden exceder 1000 caracteres')
    .optional(),
})

export type UpdateCredentialInput = z.infer<typeof updateCredentialSchema>

// Delete credential schema
export const deleteCredentialSchema = z.object({
  credentialId: z.string().cuid('ID de credencial inválido'),
})

export type DeleteCredentialInput = z.infer<typeof deleteCredentialSchema>

// Reveal password schema
export const revealPasswordSchema = z.object({
  credentialId: z.string().cuid('ID de credencial inválido'),
})

export type RevealPasswordInput = z.infer<typeof revealPasswordSchema>
