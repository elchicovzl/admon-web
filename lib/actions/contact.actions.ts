'use server'

import { headers } from 'next/headers'
import { sendEmail, generateContactEmailHtml } from '@/lib/email'
import { contactSchema, type ContactInput } from '@/lib/validations/contact.schema'
import type { ActionResponse } from '@/lib/types/auth.types'

const CONTACT_EMAIL = process.env.CONTACT_EMAIL || process.env.GMAIL_USER

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 10 * 60 * 1000 // 10 minutes in milliseconds
const MAX_REQUESTS = 3 // Maximum requests per window

// In-memory store for rate limiting (resets on server restart)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

// Clean expired entries periodically
function cleanExpiredEntries() {
  const now = Date.now()
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}

// Check rate limit for an IP
function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetIn: number } {
  cleanExpiredEntries()

  const now = Date.now()
  const record = rateLimitStore.get(ip)

  if (!record || now > record.resetTime) {
    // New window
    rateLimitStore.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return { allowed: true, remaining: MAX_REQUESTS - 1, resetIn: RATE_LIMIT_WINDOW }
  }

  if (record.count >= MAX_REQUESTS) {
    // Rate limited
    return { allowed: false, remaining: 0, resetIn: record.resetTime - now }
  }

  // Increment count
  record.count++
  return { allowed: true, remaining: MAX_REQUESTS - record.count, resetIn: record.resetTime - now }
}

export async function submitContactForm(
  data: ContactInput
): Promise<ActionResponse> {
  try {
    // Get client IP for rate limiting
    const headersList = await headers()
    const forwardedFor = headersList.get('x-forwarded-for')
    const ip = forwardedFor?.split(',')[0]?.trim() || 'unknown'

    // Check rate limit
    const rateLimit = checkRateLimit(ip)
    if (!rateLimit.allowed) {
      const minutesLeft = Math.ceil(rateLimit.resetIn / 60000)
      return {
        success: false,
        error: `Demasiados intentos. Por favor, espera ${minutesLeft} minuto${minutesLeft > 1 ? 's' : ''} antes de intentar de nuevo.`,
      }
    }

    // Check honeypot (spam protection)
    if (data.website && data.website.length > 0) {
      // Silently reject - don't give feedback to bots
      console.log('Honeypot triggered - spam detected')
      return {
        success: true,
        message: '¡Mensaje enviado exitosamente!', // Fake success to confuse bots
      }
    }

    // Validate input
    const validatedFields = contactSchema.safeParse(data)

    if (!validatedFields.success) {
      const errors = validatedFields.error.flatten().fieldErrors
      const firstError = Object.values(errors)[0]?.[0] || 'Datos inválidos'
      return {
        success: false,
        error: firstError,
      }
    }

    const { fullName, email, phone, subject, message } = validatedFields.data

    // Check environment variables
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      console.error('Email configuration missing')
      return {
        success: false,
        error: 'Error de configuración del servidor. Por favor, intenta más tarde.',
      }
    }

    if (!CONTACT_EMAIL) {
      console.error('CONTACT_EMAIL not configured')
      return {
        success: false,
        error: 'Error de configuración del servidor. Por favor, intenta más tarde.',
      }
    }

    // Generate email HTML
    const html = generateContactEmailHtml({
      fullName,
      email,
      phone,
      subject,
      message,
    })

    // Send email
    await sendEmail({
      to: CONTACT_EMAIL,
      subject: `[Contacto Web] ${subject}`,
      html,
      replyTo: email,
    })

    return {
      success: true,
      message: '¡Mensaje enviado exitosamente! Nos pondremos en contacto contigo pronto.',
    }
  } catch (error) {
    console.error('Error sending contact email:', error)
    return {
      success: false,
      error: 'Error al enviar el mensaje. Por favor, intenta de nuevo.',
    }
  }
}
