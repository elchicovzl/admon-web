'use server'

import { sendEmail, generateContactEmailHtml } from '@/lib/email'
import { contactSchema, type ContactInput } from '@/lib/validations/contact.schema'
import type { ActionResponse } from '@/lib/types/auth.types'

const CONTACT_EMAIL = process.env.CONTACT_EMAIL || process.env.GMAIL_USER

export async function submitContactForm(
  data: ContactInput
): Promise<ActionResponse> {
  try {
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
