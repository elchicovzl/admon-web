# Plan: Implementación de Autenticación OTP (Email Only)

## Context

El sistema actual utiliza autenticación tradicional con email + contraseña. El objetivo es reemplazar completamente este sistema por un flujo moderno de autenticación basado en OTP (One-Time Password) enviado por email.

**Motivación:**
- Eliminar la gestión de contraseñas (almacenamiento, hashing, cambios, recuperación)
- Mejorar la seguridad mediante códigos de un solo uso con expiración
- Simplificar el flujo de login para los usuarios
- Modernizar la experiencia de autenticación

**Infraestructura existente a aprovechar:**
- ✅ Servicio de email Nodemailer + Gmail ya configurado ([lib/email.ts](lib/email.ts))
- ✅ Modelo `VerificationToken` en base de datos ([prisma/schema.prisma](prisma/schema.prisma))
- ✅ Componente UI `input-otp` ya instalado ([components/ui/input-otp.tsx](components/ui/input-otp.tsx))
- ✅ NextAuth v5 con sesiones JWT ([lib/auth/auth.config.ts](lib/auth/auth.config.ts))
- ✅ Validación Zod y Server Actions pattern

## Implementation Approach

### Fase 1: Database & Infraestructura

#### 1.1 Actualizar Schema de Prisma ([prisma/schema.prisma](prisma/schema.prisma))

**Cambios al User model:**
```prisma
model User {
  // ... campos existentes
  password      String?  // Hacer nullable (migración en 2 fases)
  // ... resto de campos
}
```

**Nuevo modelo para rate limiting:**
```prisma
model OtpRateLimit {
  id           String   @id @default(cuid())
  email        String
  attempts     Int      @default(1)
  lastAttempt  DateTime @default(now())
  blockedUntil DateTime?

  @@map("otp_rate_limits")
  @@index([email])
}
```

**Reutilizar modelo existente:**
- `VerificationToken` (líneas 96-103) - Para almacenar OTPs hasheados con expiración

**Estrategia de migración:**
1. Primera migración: Password nullable + nuevo modelo OtpRateLimit
2. Desplegar sistema OTP
3. Segunda migración (futura): Eliminar columna password completamente

#### 1.2 Ejecutar Migración
```bash
pnpm db:migrate
```

---

### Fase 2: Server Actions & Lógica de Negocio

#### 2.1 Actualizar Schemas de Validación ([lib/validations/auth.schema.ts](lib/validations/auth.schema.ts))

**Schemas nuevos:**
```typescript
export const requestOtpSchema = z.object({
  email: z.string().email('Email inválido'),
})

export const verifyOtpSchema = z.object({
  email: z.string().email('Email inválido'),
  code: z.string()
    .length(6, 'El código debe tener 6 dígitos')
    .regex(/^\d{6}$/, 'El código debe ser numérico'),
})

export const resendOtpSchema = z.object({
  email: z.string().email('Email inválido'),
})

// Types
export type RequestOtpInput = z.infer<typeof requestOtpSchema>
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>
export type ResendOtpInput = z.infer<typeof resendOtpSchema>
```

**Schemas a remover:**
- `loginSchema` (líneas 5-14) - Ya no se usa password
- `changePasswordSchema` (líneas 43-59) - Funcionalidad obsoleta

**Schemas a actualizar:**
- `registerSchema` - Remover campo `password` (solo SUPER_ADMIN crea usuarios con email)

#### 2.2 Crear Utilidades de Seguridad (nuevo archivo [lib/utils/otp.ts](lib/utils/otp.ts))

**Funciones necesarias:**

```typescript
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/db/prisma'

// Generar código OTP de 6 dígitos
export function generateOtpCode(): string {
  return crypto.randomInt(100000, 999999).toString()
}

// Hashear OTP antes de guardarlo en DB
export async function hashOtp(code: string): Promise<string> {
  return bcrypt.hash(code, 10)
}

// Verificar OTP (timing-safe)
export async function verifyOtp(code: string, hashedCode: string): Promise<boolean> {
  return bcrypt.compare(code, hashedCode)
}

// Rate limiting: 3 intentos máximo cada 15 minutos
export async function checkRateLimit(email: string): Promise<{
  allowed: boolean
  remainingAttempts?: number
  blockedUntil?: Date
  minutesRemaining?: number
}> {
  const now = new Date()
  const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000)

  let rateLimit = await prisma.otpRateLimit.findFirst({
    where: { email }
  })

  // Primer intento
  if (!rateLimit) {
    await prisma.otpRateLimit.create({
      data: { email, attempts: 1, lastAttempt: now }
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
      minutesRemaining
    }
  }

  // Resetear si pasaron 15 minutos
  if (rateLimit.lastAttempt < fifteenMinutesAgo) {
    await prisma.otpRateLimit.update({
      where: { id: rateLimit.id },
      data: { attempts: 1, lastAttempt: now, blockedUntil: null }
    })
    return { allowed: true, remainingAttempts: 2 }
  }

  // Verificar límite de intentos (3 max)
  if (rateLimit.attempts >= 3) {
    const blockedUntil = new Date(now.getTime() + 15 * 60 * 1000)
    await prisma.otpRateLimit.update({
      where: { id: rateLimit.id },
      data: { blockedUntil }
    })
    return { allowed: false, blockedUntil, minutesRemaining: 15 }
  }

  // Incrementar intentos
  await prisma.otpRateLimit.update({
    where: { id: rateLimit.id },
    data: {
      attempts: { increment: 1 },
      lastAttempt: now
    }
  })

  return {
    allowed: true,
    remainingAttempts: 3 - rateLimit.attempts - 1
  }
}

// Limpiar tokens expirados
export async function cleanupExpiredTokens() {
  await prisma.verificationToken.deleteMany({
    where: {
      expires: { lt: new Date() }
    }
  })
}
```

#### 2.3 Actualizar Server Actions ([lib/actions/auth.actions.ts](lib/actions/auth.actions.ts))

**Nuevas acciones a crear:**

```typescript
'use server'

import { signIn, signOut, auth } from '@/lib/auth/auth'
import prisma from '@/lib/db/prisma'
import { sendEmail } from '@/lib/email'
import { generateOtpEmailHtml } from '@/lib/email'
import {
  generateOtpCode,
  hashOtp,
  verifyOtp,
  checkRateLimit,
  cleanupExpiredTokens,
} from '@/lib/utils/otp'
import {
  requestOtpSchema,
  verifyOtpSchema,
  resendOtpSchema,
  type RequestOtpInput,
  type VerifyOtpInput,
  type ResendOtpInput,
} from '@/lib/validations/auth.schema'
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
      select: { id: true, email: true, isActive: true }
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
      }
    })

    // Enviar email con OTP
    try {
      await sendEmail({
        to: email,
        subject: 'Tu código de acceso - Administración Segura',
        html: generateOtpEmailHtml({ code: otpCode, expirationMinutes: 5 }),
      })
    } catch (emailError) {
      console.error('[OTP] Email send failed:', emailError)
      // IMPORTANTE: No revelar error de email al usuario (seguridad)
    }

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
      select: { id: true, email: true, isActive: true }
    })

    if (!user || !user.isActive) {
      return { success: false, error: 'Código inválido' }
    }

    // Buscar último token válido para este email
    const token = await prisma.verificationToken.findFirst({
      where: {
        identifier: email,
        expires: { gt: new Date() }
      },
      orderBy: {
        expires: 'desc'
      }
    })

    if (!token) {
      return {
        success: false,
        error: 'Código expirado o inválido. Solicita uno nuevo'
      }
    }

    // Verificar código OTP
    const isValid = await verifyOtp(code, token.token)

    if (!isValid) {
      return { success: false, error: 'Código inválido' }
    }

    // Eliminar token usado (prevenir reuso)
    await prisma.verificationToken.delete({
      where: {
        identifier_token: {
          identifier: email,
          token: token.token
        }
      }
    })

    // Crear sesión NextAuth
    await signIn('credentials', {
      email,
      redirect: false,
    })

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
        expires: 'desc'
      }
    })

    if (recentToken) {
      // Calcular cuándo se creó (expires - 5 min)
      const createdAt = new Date(recentToken.expires.getTime() - 5 * 60 * 1000)
      const cooldownEnds = new Date(createdAt.getTime() + 60 * 1000)
      const now = new Date()

      if (cooldownEnds > now) {
        const remainingSeconds = Math.ceil((cooldownEnds.getTime() - now.getTime()) / 1000)
        return {
          success: false,
          error: `Espera ${remainingSeconds} segundos antes de solicitar un nuevo código`,
          cooldownSeconds: remainingSeconds
        }
      }
    }

    // Eliminar tokens anteriores no usados
    await prisma.verificationToken.deleteMany({
      where: { identifier: email }
    })

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

// MANTENER sin cambios:
// - logout()
// - getSession()

// REMOVER completamente:
// - login() (líneas 21-68) - Reemplazado por verifyOtp
// - changePassword() (líneas 179-246) - Ya no aplica

// ACTUALIZAR:
// - register() - Remover hashing de password, solo guardar email/name
```

**Actualizar exports en [lib/actions/index.ts](lib/actions/index.ts):**
```typescript
// Nuevos exports
export { requestOtp, verifyOtp, resendOtp } from './auth.actions'

// Remover exports
// export { login } from './auth.actions' // REMOVER
// export { changePassword } from './auth.actions' // REMOVER
```

---

### Fase 3: Email Template

#### 3.1 Agregar Template de OTP ([lib/email.ts](lib/email.ts))

**Nueva función (agregar después de línea 94):**

```typescript
export function generateOtpEmailHtml({
  code,
  expirationMinutes,
}: {
  code: string
  expirationMinutes: number
}) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {
          font-family: 'Segoe UI', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          background-color: #f5f5f5;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 40px auto;
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .header {
          background: linear-gradient(135deg, #00A86B 0%, #008556 100%);
          color: white;
          padding: 40px 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 600;
        }
        .header p {
          margin: 10px 0 0;
          opacity: 0.95;
          font-size: 14px;
        }
        .content {
          padding: 40px 30px;
        }
        .greeting {
          font-size: 16px;
          color: #333;
          margin-bottom: 20px;
        }
        .otp-code {
          font-size: 48px;
          font-weight: 700;
          letter-spacing: 12px;
          color: #00A86B;
          text-align: center;
          padding: 30px 20px;
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          border-radius: 12px;
          border: 3px dashed #00A86B;
          margin: 30px 0;
          font-family: 'Courier New', monospace;
        }
        .expiry {
          text-align: center;
          color: #666;
          font-size: 14px;
          margin-top: -15px;
          margin-bottom: 30px;
        }
        .expiry strong {
          color: #d9534f;
          font-weight: 600;
        }
        .warning {
          background: #fff3cd;
          border-left: 5px solid #ffc107;
          padding: 20px;
          margin: 25px 0;
          border-radius: 8px;
        }
        .warning strong {
          color: #856404;
          font-size: 15px;
        }
        .warning ul {
          margin: 12px 0 0;
          padding-left: 25px;
          color: #856404;
        }
        .warning li {
          margin: 8px 0;
        }
        .support {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e9ecef;
          color: #666;
          font-size: 14px;
          text-align: center;
        }
        .footer {
          background: #f8f9fa;
          text-align: center;
          padding: 20px;
          color: #6c757d;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 Código de Acceso</h1>
          <p>Administración Segura</p>
        </div>

        <div class="content">
          <p class="greeting">Hola,</p>
          <p>Has solicitado acceso al panel administrativo. Usa el siguiente código para iniciar sesión:</p>

          <div class="otp-code">${code}</div>

          <p class="expiry">
            Este código expirará en <strong>${expirationMinutes} minutos</strong>
          </p>

          <div class="warning">
            <strong>⚠️ Importante - Seguridad</strong>
            <ul>
              <li><strong>No compartas</strong> este código con nadie</li>
              <li>Nuestro equipo <strong>nunca te pedirá</strong> este código</li>
              <li>Si no solicitaste este código, <strong>ignora este correo</strong></li>
              <li>Cada código solo puede usarse <strong>una vez</strong></li>
            </ul>
          </div>

          <p class="support">
            Si tienes problemas para iniciar sesión o necesitas ayuda, <br>
            contacta a nuestro equipo de soporte.
          </p>
        </div>

        <div class="footer">
          © ${new Date().getFullYear()} Administración Segura. Todos los derechos reservados.<br>
          Este es un correo automático, por favor no respondas a este mensaje.
        </div>
      </div>
    </body>
    </html>
  `
}
```

---

### Fase 4: UI Components

#### 4.1 Crear Componente Email Step (nuevo: [components/auth/email-step-form.tsx](components/auth/email-step-form.tsx))

```typescript
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { requestOtp } from '@/lib/actions'
import { requestOtpSchema, type RequestOtpInput } from '@/lib/validations/auth.schema'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Loader2, Mail } from 'lucide-react'

interface EmailStepFormProps {
  onOtpSent: (email: string) => void
}

export function EmailStepForm({ onOtpSent }: EmailStepFormProps) {
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<RequestOtpInput>({
    resolver: zodResolver(requestOtpSchema),
    defaultValues: {
      email: '',
    },
  })

  async function onSubmit(data: RequestOtpInput) {
    setIsLoading(true)

    try {
      const result = await requestOtp(data)

      if (result.success) {
        toast.success('Código enviado', {
          description: 'Revisa tu correo electrónico',
        })
        onOtpSent(data.email)
      } else {
        toast.error(result.error || 'Error al enviar código')
      }
    } catch (error) {
      console.error('Request OTP error:', error)
      toast.error('Error de conexión. Verifica tu internet')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-white/90">
                Email
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="tu@email.com"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  disabled={isLoading}
                  className="bg-white/5 border-white/20 text-white placeholder:text-white/50 focus:border-[#F1AD32] focus:ring-[#F1AD32] transition-all duration-300 hover:bg-white/10"
                  {...field}
                />
              </FormControl>
              <FormMessage className="text-red-300" />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="w-full bg-[#F1AD32] hover:bg-[#f59e0b] text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Enviando código...
            </>
          ) : (
            <>
              <Mail className="mr-2 h-4 w-4" />
              Enviar código
            </>
          )}
        </Button>

        <p className="text-center text-xs text-white/60 mt-4">
          Te enviaremos un código de 6 dígitos a tu email
        </p>
      </form>
    </Form>
  )
}
```

#### 4.2 Crear Componente OTP Verification (nuevo: [components/auth/otp-verification-form.tsx](components/auth/otp-verification-form.tsx))

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { verifyOtp, resendOtp } from '@/lib/actions'
import { Button } from '@/components/ui/button'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from '@/components/ui/input-otp'
import { toast } from 'sonner'
import { Loader2, ArrowLeft, RotateCw } from 'lucide-react'

interface OtpVerificationFormProps {
  email: string
  onBack: () => void
}

export function OtpVerificationForm({ email, onBack }: OtpVerificationFormProps) {
  const router = useRouter()
  const [otpCode, setOtpCode] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  // Countdown timer para resend
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown((prev) => prev - 1)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  async function handleVerify(code: string) {
    if (code.length !== 6) return

    setIsVerifying(true)

    try {
      const result = await verifyOtp({ email, code })

      if (result.success) {
        toast.success('¡Bienvenido!', {
          description: 'Acceso concedido',
        })
        router.push('/dashboard')
        router.refresh()
      } else {
        toast.error(result.error || 'Código inválido')
        setOtpCode('') // Limpiar campo
      }
    } catch (error) {
      console.error('Verify OTP error:', error)
      toast.error('Error de conexión')
      setOtpCode('')
    } finally {
      setIsVerifying(false)
    }
  }

  async function handleResend() {
    if (resendCooldown > 0) return

    try {
      const result = await resendOtp({ email })

      if (result.success) {
        toast.success('Código reenviado', {
          description: 'Revisa tu email nuevamente',
        })
        setResendCooldown(60) // 60 segundos de cooldown
      } else {
        if (result.cooldownSeconds) {
          setResendCooldown(result.cooldownSeconds)
        }
        toast.error(result.error || 'Error al reenviar código')
      }
    } catch (error) {
      console.error('Resend OTP error:', error)
      toast.error('Error al reenviar código')
    }
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="text-white/70 hover:text-white hover:bg-white/10"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Cambiar email
      </Button>

      {/* Email display */}
      <div className="text-center">
        <p className="text-white/70 text-sm mb-1">Código enviado a:</p>
        <p className="text-white font-semibold">{email}</p>
      </div>

      {/* OTP Input */}
      <div className="flex flex-col items-center space-y-4">
        <InputOTP
          maxLength={6}
          value={otpCode}
          onChange={(value) => {
            setOtpCode(value)
            if (value.length === 6) {
              handleVerify(value)
            }
          }}
          disabled={isVerifying}
        >
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
          </InputOTPGroup>
          <InputOTPSeparator />
          <InputOTPGroup>
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>

        {isVerifying && (
          <div className="flex items-center text-white/70 text-sm">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Verificando...
          </div>
        )}
      </div>

      {/* Resend button */}
      <div className="text-center">
        {resendCooldown > 0 ? (
          <p className="text-white/50 text-sm">
            Reenviar código en {resendCooldown}s
          </p>
        ) : (
          <Button
            variant="link"
            onClick={handleResend}
            className="text-[#F1AD32] hover:text-[#f59e0b]"
          >
            <RotateCw className="mr-2 h-4 w-4" />
            Reenviar código
          </Button>
        )}
      </div>

      <p className="text-center text-xs text-white/60">
        El código expira en 5 minutos
      </p>
    </div>
  )
}
```

#### 4.3 Actualizar Login Form Principal ([components/auth/login-form.tsx](components/auth/login-form.tsx))

**Reemplazar completamente** (líneas 1-145):

```typescript
'use client'

import { useState } from 'react'
import Image from 'next/image'
import { EmailStepForm } from './email-step-form'
import { OtpVerificationForm } from './otp-verification-form'

export function LoginForm() {
  const [step, setStep] = useState<'email' | 'otp'>('email')
  const [email, setEmail] = useState('')

  function handleOtpSent(userEmail: string) {
    setEmail(userEmail)
    setStep('otp')
  }

  function handleBack() {
    setStep('email')
    setEmail('')
  }

  return (
    <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-8 sm:p-12 animate-fade-in-up">
      {/* Logo/Brand header */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mb-4 shadow-lg p-3">
          <Image
            src="/images/logoadmon2.webp"
            alt="Administración Segura Logo"
            width={80}
            height={80}
            className="w-full h-full object-contain"
            priority
          />
        </div>
        <h1 className="text-4xl font-bold text-white text-center font-figtree">
          Bienvenido
        </h1>
        <p className="text-white/70 text-center mt-2 font-inter">
          {step === 'email'
            ? 'Ingresa tu email para recibir un código de acceso'
            : 'Ingresa el código enviado a tu email'}
        </p>
      </div>

      {/* Multi-step form */}
      {step === 'email' ? (
        <EmailStepForm onOtpSent={handleOtpSent} />
      ) : (
        <OtpVerificationForm email={email} onBack={handleBack} />
      )}
    </div>
  )
}
```

---

### Fase 5: NextAuth Configuration

#### 5.1 Actualizar Auth Provider ([lib/auth/auth.config.ts](lib/auth/auth.config.ts))

**Modificar el authorize function del Credentials provider** (líneas 15-60):

```typescript
async authorize(credentials) {
  try {
    // Solo validar que el email existe y está activo
    // La verificación OTP ya se hizo en verifyOtp() action

    const { email } = credentials as { email: string }

    if (!email) {
      return null
    }

    // Buscar usuario
    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      return null
    }

    // Verificar que está activo
    if (!user.isActive) {
      console.log(`Login blocked: User ${email} is inactive`)
      return null
    }

    // Retornar usuario (sin verificar password)
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: user.role,
    }
  } catch (error) {
    console.error('Auth error:', error)
    return null
  }
}
```

**Remover import de loginSchema** (línea 5) - Ya no se usa

**Mantener sin cambios:**
- JWT y Session callbacks (líneas 67-88)
- Session config (líneas 89-92)
- Pages config (líneas 63-66)

---

### Fase 6: Limpieza de Funcionalidad de Passwords

#### 6.1 Actualizar User Actions ([lib/actions/user.actions.ts](lib/actions/user.actions.ts))

**Modificar createManager():**
- Remover generación de password random
- Solo guardar email, name, role

**Remover completamente:**
- `changeUserPassword()` function - Ya no aplica

#### 6.2 Actualizar UI de Gestión de Usuarios

**Archivos a modificar:**
- Formulario de creación de usuarios - Remover campo password
- Tabla de usuarios - Remover columnas/indicadores de password
- Dialogs/modals - Remover opción "Cambiar contraseña"

---

## Critical Files to Modify

### Database & Schema
1. [prisma/schema.prisma](prisma/schema.prisma) - User model (password nullable), OtpRateLimit model

### Backend Logic
2. [lib/utils/otp.ts](lib/utils/otp.ts) - **NUEVO** - Utilidades de OTP (generar, verificar, rate limiting)
3. [lib/validations/auth.schema.ts](lib/validations/auth.schema.ts) - Schemas OTP, remover password schemas
4. [lib/actions/auth.actions.ts](lib/actions/auth.actions.ts) - requestOtp, verifyOtp, resendOtp (remover login, changePassword)
5. [lib/actions/index.ts](lib/actions/index.ts) - Actualizar exports
6. [lib/auth/auth.config.ts](lib/auth/auth.config.ts) - Simplificar authorize (sin password)

### Email
7. [lib/email.ts](lib/email.ts) - generateOtpEmailHtml() template

### UI Components
8. [components/auth/email-step-form.tsx](components/auth/email-step-form.tsx) - **NUEVO** - Input de email
9. [components/auth/otp-verification-form.tsx](components/auth/otp-verification-form.tsx) - **NUEVO** - Input de OTP
10. [components/auth/login-form.tsx](components/auth/login-form.tsx) - **REEMPLAZAR** - Orquestador de flujo

### User Management
11. Formularios de usuarios (remover password fields)
12. User table components (remover password columns)

---

## Reuse Existing Functions

**De [lib/email.ts](lib/email.ts):**
- ✅ `sendEmail()` (línea 18) - Reutilizar para enviar OTPs
- ✅ Patrón de `generateContactEmailHtml()` - Seguir mismo estilo para OTP template

**De [lib/auth/auth.ts](lib/auth/auth.ts):**
- ✅ `signIn()` - Crear sesión después de verificar OTP
- ✅ `signOut()` - Sin cambios
- ✅ `auth()` - Obtener sesión actual

**De [lib/db/prisma.ts](lib/db/prisma.ts):**
- ✅ Instancia de Prisma Client - Para todas las queries

**De [components/ui/input-otp.tsx](components/ui/input-otp.tsx):**
- ✅ Componente completo ya instalado y estilizado

**De bcryptjs:**
- ✅ `hash()` - Para hashear OTP antes de guardar
- ✅ `compare()` - Para verificar OTP de manera timing-safe

**De crypto (Node.js):**
- ✅ `randomInt()` - Generar OTP de 6 dígitos seguros

---

## Authentication Flow

### Flujo Completo del Usuario

```
1. Usuario visita /login
   ↓
2. Ve EmailStepForm
   ↓
3. Ingresa email → Click "Enviar código"
   ↓
4. Frontend llama requestOtp(email)
   ↓
5. Backend:
   - Valida email
   - Verifica usuario existe y isActive
   - Verifica rate limiting (3 max/15 min)
   - Genera código 6 dígitos
   - Hashea código con bcrypt
   - Guarda en VerificationToken (expira en 5 min)
   - Envía email con código
   - Retorna éxito (mensaje genérico)
   ↓
6. Frontend muestra OtpVerificationForm
   ↓
7. Usuario recibe email, ingresa código
   ↓
8. Frontend llama verifyOtp(email, code) (auto-submit al completar 6 dígitos)
   ↓
9. Backend:
   - Limpia tokens expirados
   - Busca usuario (verifica isActive)
   - Busca token válido (no expirado)
   - Compara código con bcrypt
   - Elimina token usado
   - Llama NextAuth signIn()
   - Crea sesión JWT
   ↓
10. Sesión creada, redirect a /dashboard
    ↓
11. Middleware valida sesión
    ↓
12. Usuario accede al dashboard
```

### Casos de Error

**Email no registrado:**
- Server: Retorna éxito genérico (no revelar)
- User: Ve mensaje "Si tu email está registrado..."

**Usuario inactivo:**
- Server: Retorna éxito genérico (no revelar estado)
- User: No recibe email

**Rate limit excedido:**
- Server: Retorna error con minutos restantes
- User: "Demasiados intentos. Intenta en X minutos"

**Código expirado:**
- Server: Token no encontrado o expires < now
- User: "Código expirado. Solicita uno nuevo"

**Código inválido:**
- Server: bcrypt.compare() falla
- User: "Código inválido" + campo se limpia

**Resend antes de 60 seg:**
- Server: Calcula tiempo restante
- User: "Espera X segundos antes de solicitar nuevo código"

---

## Security Checklist

- ✅ OTP de 6 dígitos numéricos (fácil de usar, seguro para ventana de 5 min)
- ✅ Generación con `crypto.randomInt()` (criptográficamente seguro)
- ✅ Hasheado con bcrypt antes de guardar en DB
- ✅ Expiración de 5 minutos (ventana corta)
- ✅ Un solo uso (token se elimina después de verificación)
- ✅ Rate limiting: 3 intentos cada 15 minutos
- ✅ Cooldown de 60 segundos entre reenvíos
- ✅ Prevención de email enumeration (mensajes genéricos)
- ✅ Verificación timing-safe con bcrypt.compare()
- ✅ Verificación de usuario activo (isActive)
- ✅ Limpieza de tokens expirados
- ✅ Logs de eventos de autenticación
- ✅ Sesiones JWT con maxAge de 30 días (sin cambios)
- ✅ HTTPS en producción (requerido)
- ✅ CSRF protection (NextAuth default)

---

## Testing & Verification

### Tests Manuales (Pre-deployment)

**Flujo happy path:**
1. [ ] Ingresar email válido → Código enviado
2. [ ] Revisar email recibido en bandeja
3. [ ] Ingresar código correcto → Login exitoso
4. [ ] Redirect a /dashboard
5. [ ] Sesión persiste al refrescar página

**Rate limiting:**
6. [ ] Solicitar OTP 3 veces → Ok
7. [ ] Solicitar 4ta vez → Bloqueado
8. [ ] Esperar 15 minutos → Puede solicitar de nuevo

**Expiración:**
9. [ ] Solicitar código
10. [ ] Esperar 6 minutos
11. [ ] Ingresar código → Error "Código expirado"

**Cooldown resend:**
12. [ ] Solicitar código
13. [ ] Inmediatamente clic "Reenviar" → Cooldown 60s
14. [ ] Esperar 60s → Puede reenviar

**Códigos inválidos:**
15. [ ] Ingresar código incorrecto → Error
16. [ ] Campo se limpia automáticamente
17. [ ] Intentar código ya usado → Error

**Usuario inactivo:**
18. [ ] Marcar usuario como inactivo en DB
19. [ ] Solicitar código → Éxito genérico
20. [ ] No recibe email

**Edge cases:**
21. [ ] Email con mayúsculas/minúsculas
22. [ ] Múltiples tabs (mismo usuario)
23. [ ] Cerrar sesión funciona
24. [ ] Navegación con botón "Atrás"

### Tests de Integración

**Backend:**
- [ ] `generateOtpCode()` genera códigos únicos
- [ ] `checkRateLimit()` bloquea correctamente
- [ ] `verifyOtp()` valida timing-safe
- [ ] Tokens expirados se limpian

**Email:**
- [ ] Emails se envían correctamente
- [ ] Template se renderiza bien (HTML)
- [ ] Código visible y legible
- [ ] Headers de seguridad presentes

**UI:**
- [ ] Flujo de 2 pasos funciona
- [ ] Auto-submit al completar 6 dígitos
- [ ] Loading states mostrados
- [ ] Mensajes de error claros
- [ ] Countdown timer de resend funciona

### Comandos de Verificación

```bash
# 1. Verificar migración
pnpm db:studio
# → Verificar que User.password es nullable
# → Verificar que tabla OtpRateLimit existe
# → Verificar que VerificationToken existe

# 2. Test local completo
pnpm dev
# → Ir a http://localhost:3000/login
# → Probar flujo completo

# 3. Verificar logs
# → Ver consola del servidor durante login
# → Verificar logs de "[OTP]"

# 4. Test de email
# → Verificar que email llega a bandeja
# → Verificar que no va a spam
# → Verificar formato del template
```

---

## Rollback Plan

**Si hay problemas críticos:**

### Opción 1: Revert Code (mantener DB)
```bash
git revert HEAD
pnpm build
# Deploy versión anterior
```

### Opción 2: Rollback DB
```bash
# Restaurar password field como required
# Revertir migraciones
npx prisma migrate resolve --rolled-back [migration_name]
```

**El campo password nullable permite tener ambos sistemas temporalmente**

---

## Post-Implementation

### Métricas a Monitorear

- Tasa de éxito de login (>90% esperado)
- Tiempo promedio de login (<2 min esperado)
- Tasa de emails enviados correctamente (>95%)
- Intentos bloqueados por rate limit
- Códigos expirados vs usados
- Errores de verificación

### Mejoras Futuras (Opcional)

- [ ] Agregar SMS como método alternativo de OTP
- [ ] Implementar "Recordar este dispositivo" (bypass OTP)
- [ ] Dashboard de auditoría de intentos de login
- [ ] Email notifications de login exitoso
- [ ] Soporte para 2FA con TOTP (Google Authenticator)

---

## Environment Variables

**No se requieren nuevas variables de entorno.**

Usar variables existentes:
- `GMAIL_USER` - Ya configurado
- `GMAIL_APP_PASSWORD` - Ya configurado
- `AUTH_SECRET` - Ya configurado
- `AUTH_URL` - Ya configurado
- `DATABASE_URL` - Ya configurado

---

## Migration Commands

```bash
# 1. Crear migración
npx prisma migrate dev --name add_otp_authentication

# 2. Aplicar migración en producción
npx prisma migrate deploy

# 3. Abrir Prisma Studio (verificar)
npx prisma studio

# 4. Generar Prisma Client
npx prisma generate
```

---

## Implementation Checklist

### Phase 1: Database
- [ ] Actualizar schema.prisma (User.password nullable, OtpRateLimit model)
- [ ] Ejecutar migración
- [ ] Verificar en Prisma Studio

### Phase 2: Backend
- [ ] Crear [lib/utils/otp.ts](lib/utils/otp.ts) con utilidades
- [ ] Actualizar [lib/validations/auth.schema.ts](lib/validations/auth.schema.ts)
- [ ] Actualizar [lib/actions/auth.actions.ts](lib/actions/auth.actions.ts)
- [ ] Actualizar [lib/actions/index.ts](lib/actions/index.ts)
- [ ] Actualizar [lib/auth/auth.config.ts](lib/auth/auth.config.ts)

### Phase 3: Email
- [ ] Agregar generateOtpEmailHtml() a [lib/email.ts](lib/email.ts)
- [ ] Probar envío de email localmente

### Phase 4: UI
- [ ] Crear [components/auth/email-step-form.tsx](components/auth/email-step-form.tsx)
- [ ] Crear [components/auth/otp-verification-form.tsx](components/auth/otp-verification-form.tsx)
- [ ] Actualizar [components/auth/login-form.tsx](components/auth/login-form.tsx)

### Phase 5: Cleanup
- [ ] Remover campos password de forms de usuarios
- [ ] Remover funcionalidad "Cambiar contraseña"
- [ ] Limpiar imports no usados

### Phase 6: Testing
- [ ] Probar flujo completo localmente
- [ ] Probar todos los casos de error
- [ ] Verificar rate limiting
- [ ] Verificar emails recibidos

### Phase 7: Deployment
- [ ] Deploy a staging
- [ ] QA completo
- [ ] Deploy a producción
- [ ] Monitorear logs y métricas

---

## Notes

- La implementación mantiene la arquitectura existente de NextAuth v5
- Se reutiliza toda la infraestructura de email existente
- El flujo de sesiones JWT no cambia
- El middleware de protección de rutas no requiere cambios
- Los roles (SUPER_ADMIN, MANAGER) siguen funcionando igual
- La funcionalidad de logout no cambia

**Tiempo estimado de implementación: 4-6 horas**

**Complejidad: Media** (la mayor parte es reutilización de código existente)
