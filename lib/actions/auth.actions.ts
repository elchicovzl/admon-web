'use server'

import { signIn, signOut, auth } from '@/lib/auth/auth'
import { emitirPermisoDeLogin } from '@/lib/auth/login-grant'
import prisma from '@/lib/db/prisma'
import bcrypt from 'bcryptjs'
import { AuthError } from 'next-auth'
import {
  requestOtpSchema,
  verifyOtpSchema,
  resendOtpSchema,
  registerSchema,
  type RequestOtpInput,
  type VerifyOtpInput,
  type ResendOtpInput,
  type RegisterInput,
} from '@/lib/validations/auth.schema'
import {
  generateOtpCode,
  hashOtp,
  verifyOtp as verifyOtpHash,
  checkRateLimit,
  cleanupExpiredTokens,
} from '@/lib/utils/otp'
import { sendOtpEmail, sendLoginSuccessEmail } from '@/lib/email'
import { UserRole } from '@prisma/client'
import type { ActionResponse } from '@/lib/types/auth.types'

/**
 * Solicitar OTP - Genera y envía código al email
 */
export async function requestOtp(
  input: RequestOtpInput
): Promise<ActionResponse> {
  try {
    const validated = requestOtpSchema.safeParse(input)
    if (!validated.success) {
      return { success: false, error: 'Email inválido' }
    }

    const { email } = validated.data

    // Verificar rate limiting
    const rateLimitCheck = await checkRateLimit(email)
    if (!rateLimitCheck.allowed) {
      return {
        success: false,
        error: `Demasiados intentos. Intenta de nuevo en ${rateLimitCheck.minutesRemaining} minutos`,
      }
    }

    // Buscar usuario
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, isActive: true },
    })

    // Verificar que usuario existe y está activo
    if (!user || !user.isActive) {
      // IMPORTANTE: Retornar mensaje genérico (seguridad - no revelar si email existe)
      return {
        success: true,
        message: 'Si tu email está registrado, recibirás un código',
      }
    }

    // Generar código OTP
    const otpCode = generateOtpCode()
    const hashedOtp = await hashOtp(otpCode)

    // Expiración: 5 minutos
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

    // Guardar en VerificationToken
    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token: hashedOtp,
        expires: expiresAt,
      },
    })

    // Enviar email con OTP
    try {
      await sendOtpEmail({
        to: email,
        code: otpCode,
        expirationMinutes: 5,
      })
    } catch (emailError) {
      console.error('[OTP] Email send failed:', emailError)
      // IMPORTANTE: No revelar error de email al usuario (seguridad)
    }

    console.log('[OTP] Request:', { email, timestamp: new Date() })

    return {
      success: true,
      message: 'Si tu email está registrado, recibirás un código',
    }
  } catch (error) {
    console.error('[OTP] Request error:', error)
    return {
      success: false,
      error: 'Error al solicitar código. Intenta más tarde',
    }
  }
}

/**
 * Verificar OTP - Valida código y crea sesión
 */
export async function verifyOtp(
  input: VerifyOtpInput
): Promise<ActionResponse> {
  try {
    const validated = verifyOtpSchema.safeParse(input)
    if (!validated.success) {
      return { success: false, error: 'Datos inválidos' }
    }

    const { email, code } = validated.data

    // Limpiar tokens expirados
    await cleanupExpiredTokens()

    // Buscar usuario
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, isActive: true },
    })

    if (!user || !user.isActive) {
      console.log('[OTP] Verification failed: User not found or inactive', {
        email,
      })
      return { success: false, error: 'Código inválido' }
    }

    // Buscar último token válido para este email
    const token = await prisma.verificationToken.findFirst({
      where: {
        identifier: email,
        expires: { gt: new Date() },
      },
      orderBy: {
        expires: 'desc',
      },
    })

    if (!token) {
      console.log('[OTP] Verification failed: Token not found or expired', {
        email,
      })
      return {
        success: false,
        error: 'Código expirado o inválido. Solicita uno nuevo',
      }
    }

    // Verificar código OTP
    const isValid = await verifyOtpHash(code, token.token)

    if (!isValid) {
      console.log('[OTP] Verification failed: Invalid code', { email })
      return { success: false, error: 'Código inválido' }
    }

    // Eliminar token usado (prevenir reuso)
    await prisma.verificationToken.delete({
      where: {
        identifier_token: {
          identifier: email,
          token: token.token,
        },
      },
    })

    // Obtener datos del usuario para el email de notificación
    const fullUser = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
      },
    })

    if (!fullUser) {
      console.error('[OTP] User not found after verification')
      return { success: false, error: 'Error en la verificación' }
    }

    // Enviar email de notificación de login exitoso (no bloqueante)
    try {
      await sendLoginSuccessEmail({
        to: email,
        userName: fullUser.name || 'Usuario',
        userEmail: email,
        loginTimestamp: new Date(),
        // Opcional: Agregar IP y user agent desde headers si es necesario
      })
    } catch (emailError) {
      // Log error pero NO fallar el login
      console.error('[OTP] Login success email failed:', emailError)
    }

    // Crear sesión NextAuth.
    //
    // El permiso se emite ACÁ, recién después de haber validado el código, y
    // authorize() lo consume. Es lo único que hace que el OTP importe: sin
    // esto, un POST directo a /api/auth/callback/credentials con solo el email
    // devolvía una sesión válida sin ver jamás un código.
    const permisoDeLogin = await emitirPermisoDeLogin(email)

    await signIn('credentials', {
      email,
      loginToken: permisoDeLogin,
      redirect: false,
    })

    console.log('[OTP] Verification successful:', { email })

    return {
      success: true,
      message: 'Inicio de sesión exitoso',
    }
  } catch (error) {
    console.error('[OTP] Verify error:', error)
    return {
      success: false,
      error: 'Error al verificar código',
    }
  }
}

/**
 * Reenviar OTP - Con cooldown de 60 segundos
 */
export async function resendOtp(
  input: ResendOtpInput
): Promise<ActionResponse & { cooldownSeconds?: number }> {
  try {
    const validated = resendOtpSchema.safeParse(input)
    if (!validated.success) {
      return { success: false, error: 'Email inválido' }
    }

    const { email } = validated.data

    // Verificar cooldown: último token enviado hace menos de 60 seg
    const recentToken = await prisma.verificationToken.findFirst({
      where: {
        identifier: email,
      },
      orderBy: {
        expires: 'desc',
      },
    })

    if (recentToken) {
      // Calcular cuándo se creó (expires - 5 min)
      const createdAt = new Date(
        recentToken.expires.getTime() - 5 * 60 * 1000
      )
      const cooldownEnds = new Date(createdAt.getTime() + 60 * 1000)
      const now = new Date()

      if (cooldownEnds > now) {
        const remainingSeconds = Math.ceil(
          (cooldownEnds.getTime() - now.getTime()) / 1000
        )
        return {
          success: false,
          error: `Espera ${remainingSeconds} segundos antes de solicitar un nuevo código`,
          cooldownSeconds: remainingSeconds,
        }
      }
    }

    // Eliminar tokens anteriores no usados
    await prisma.verificationToken.deleteMany({
      where: { identifier: email },
    })

    console.log('[OTP] Resend:', { email, timestamp: new Date() })

    // Llamar a requestOtp
    return requestOtp(input)
  } catch (error) {
    console.error('[OTP] Resend error:', error)
    return {
      success: false,
      error: 'Error al reenviar código',
    }
  }
}

/**
 * Logout action
 */
export async function logout(): Promise<ActionResponse> {
  try {
    await signOut({ redirect: false })
    return {
      success: true,
      message: 'Sesión cerrada exitosamente',
    }
  } catch (error) {
    console.error('Logout error:', error)
    return {
      success: false,
      error: 'Error al cerrar sesión',
    }
  }
}

/**
 * Register a new user (only SUPER_ADMIN can create managers)
 * No password required - users login with OTP
 */
export async function register(
  data: RegisterInput,
  createdByUserId?: string
): Promise<ActionResponse> {
  try {
    // Validate input
    const validatedFields = registerSchema.safeParse(data)

    if (!validatedFields.success) {
      return {
        success: false,
        error: 'Datos inválidos',
      }
    }

    const { name, email, role } = validatedFields.data

    // Check if creating a manager (requires SUPER_ADMIN)
    if (role === UserRole.MANAGER && createdByUserId) {
      const creatorUser = await prisma.user.findUnique({
        where: { id: createdByUserId },
      })

      if (!creatorUser || creatorUser.role !== UserRole.SUPER_ADMIN) {
        return {
          success: false,
          error: 'No tienes permisos para crear usuarios',
        }
      }
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return {
        success: false,
        error: 'El email ya está registrado',
      }
    }

    // Create user (without password)
    const user = await prisma.user.create({
      data: {
        name,
        email,
        role: role || UserRole.MANAGER,
        createdById: createdByUserId || null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    })

    return {
      success: true,
      message: 'Usuario registrado exitosamente',
      data: user,
    }
  } catch (error) {
    console.error('Register error:', error)
    return {
      success: false,
      error: 'Error al registrar usuario',
    }
  }
}

/**
 * Get current session
 */
export async function getSession() {
  return await auth()
}
