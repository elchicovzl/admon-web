import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/db/prisma'

/**
 * Generar código OTP de 6 dígitos numérico
 */
export function generateOtpCode(): string {
  return crypto.randomInt(100000, 999999).toString()
}

/**
 * Hashear OTP antes de guardarlo en DB
 */
export async function hashOtp(code: string): Promise<string> {
  return bcrypt.hash(code, 10)
}

/**
 * Verificar OTP (timing-safe con bcrypt)
 */
export async function verifyOtp(
  code: string,
  hashedCode: string
): Promise<boolean> {
  return bcrypt.compare(code, hashedCode)
}

/**
 * Rate limiting: 3 intentos máximo cada 15 minutos
 */
export async function checkRateLimit(email: string): Promise<{
  allowed: boolean
  remainingAttempts?: number
  blockedUntil?: Date
  minutesRemaining?: number
}> {
  const now = new Date()
  const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000)

  let rateLimit = await prisma.otpRateLimit.findFirst({
    where: { email },
  })

  // Primer intento
  if (!rateLimit) {
    await prisma.otpRateLimit.create({
      data: { email, attempts: 1, lastAttempt: now },
    })
    return { allowed: true, remainingAttempts: 2 }
  }

  // Verificar si está bloqueado
  if (rateLimit.blockedUntil && rateLimit.blockedUntil > now) {
    const minutesRemaining = Math.ceil(
      (rateLimit.blockedUntil.getTime() - now.getTime()) / 60000
    )
    return {
      allowed: false,
      blockedUntil: rateLimit.blockedUntil,
      minutesRemaining,
    }
  }

  // Resetear si pasaron 15 minutos
  if (rateLimit.lastAttempt < fifteenMinutesAgo) {
    await prisma.otpRateLimit.update({
      where: { id: rateLimit.id },
      data: { attempts: 1, lastAttempt: now, blockedUntil: null },
    })
    return { allowed: true, remainingAttempts: 2 }
  }

  // Verificar límite de intentos (3 max)
  if (rateLimit.attempts >= 3) {
    const blockedUntil = new Date(now.getTime() + 15 * 60 * 1000)
    await prisma.otpRateLimit.update({
      where: { id: rateLimit.id },
      data: { blockedUntil },
    })
    return { allowed: false, blockedUntil, minutesRemaining: 15 }
  }

  // Incrementar intentos
  await prisma.otpRateLimit.update({
    where: { id: rateLimit.id },
    data: {
      attempts: { increment: 1 },
      lastAttempt: now,
    },
  })

  return {
    allowed: true,
    remainingAttempts: 3 - rateLimit.attempts - 1,
  }
}

/**
 * Limpiar tokens expirados de la base de datos
 */
export async function cleanupExpiredTokens() {
  await prisma.verificationToken.deleteMany({
    where: {
      expires: { lt: new Date() },
    },
  })
}
