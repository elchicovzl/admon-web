import { z } from 'zod'

export const contactSchema = z.object({
  fullName: z
    .string()
    .min(1, 'El nombre es requerido')
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede exceder 100 caracteres'),
  email: z
    .string()
    .min(1, 'El email es requerido')
    .email('Email inválido'),
  phone: z
    .string()
    .min(1, 'El teléfono es requerido')
    .min(7, 'El teléfono debe tener al menos 7 dígitos')
    .max(20, 'El teléfono no puede exceder 20 caracteres'),
  subject: z
    .string()
    .min(1, 'El asunto es requerido')
    .max(200, 'El asunto no puede exceder 200 caracteres'),
  message: z
    .string()
    .min(1, 'El mensaje es requerido')
    .min(10, 'El mensaje debe tener al menos 10 caracteres')
    .max(2000, 'El mensaje no puede exceder 2000 caracteres'),
  acceptTerms: z
    .boolean()
    .refine((val) => val === true, {
      message: 'Debes aceptar los términos y condiciones',
    }),
  // Honeypot field - should always be empty (bots fill this)
  website: z.string().max(0, 'Invalid submission').optional(),
})

export type ContactInput = z.infer<typeof contactSchema>
