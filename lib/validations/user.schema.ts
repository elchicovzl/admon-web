import { z } from 'zod'
import { UserRole } from '@prisma/client'

// Create user schema (for SUPER_ADMIN creating managers) - No password, users login with OTP
export const createUserSchema = z.object({
  name: z
    .string()
    .min(1, 'El nombre es requerido')
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(50, 'El nombre no puede exceder 50 caracteres'),
  email: z
    .string()
    .min(1, 'El email es requerido')
    .email('Email inválido'),
  role: z
    .nativeEnum(UserRole)
    .default(UserRole.MANAGER),
  // Acceso al módulo Control (caja interna). Se otorga explícitamente:
  // nadie lo hereda por ser MANAGER.
  canAccessControl: z
    .boolean()
    .default(false),
})

export type CreateUserInput = z.infer<typeof createUserSchema>

// Update user schema
export const updateUserSchema = z.object({
  name: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(50, 'El nombre no puede exceder 50 caracteres')
    .optional(),
  email: z
    .string()
    .email('Email inválido')
    .optional(),
  role: z
    .nativeEnum(UserRole)
    .optional(),
  canAccessControl: z
    .boolean()
    .optional(),
})

export type UpdateUserInput = z.infer<typeof updateUserSchema>

// Delete user schema
export const deleteUserSchema = z.object({
  id: z.string().cuid('ID de usuario inválido'),
})

export type DeleteUserInput = z.infer<typeof deleteUserSchema>

// Get user schema
export const getUserSchema = z.object({
  id: z.string().cuid('ID de usuario inválido'),
})

export type GetUserInput = z.infer<typeof getUserSchema>

// Update own profile schema (for any authenticated user)
export const updateProfileSchema = z.object({
  name: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(50, 'El nombre no puede exceder 50 caracteres'),
})

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>

// Toggle user status schema
export const toggleUserStatusSchema = z.object({
  userId: z.string().cuid('ID de usuario inválido'),
  isActive: z.boolean(),
})

export type ToggleUserStatusInput = z.infer<typeof toggleUserStatusSchema>
