import { z } from 'zod'
import { UserRole } from '@prisma/client'

// Request OTP schema
export const requestOtpSchema = z.object({
  email: z.string().email('Email inválido'),
})

export type RequestOtpInput = z.infer<typeof requestOtpSchema>

// Verify OTP schema
export const verifyOtpSchema = z.object({
  email: z.string().email('Email inválido'),
  code: z
    .string()
    .length(6, 'El código debe tener 6 dígitos')
    .regex(/^\d{6}$/, 'El código debe ser numérico'),
})

export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>

// Resend OTP schema
export const resendOtpSchema = z.object({
  email: z.string().email('Email inválido'),
})

export type ResendOtpInput = z.infer<typeof resendOtpSchema>

// Register schema (without password)
export const registerSchema = z.object({
  name: z
    .string()
    .min(1, 'El nombre es requerido')
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(50, 'El nombre no puede exceder 50 caracteres'),
  email: z
    .string()
    .min(1, 'El email es requerido')
    .email('Email inválido'),
  role: z.nativeEnum(UserRole).default(UserRole.MANAGER).optional(),
})

export type RegisterInput = z.infer<typeof registerSchema>
