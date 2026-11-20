import { z } from 'zod'

export const ATTENTION_TEXT_MAX = 1000
export const ATTENTION_FEED_SIZE = 20

const attentionText = (requiredMessage: string) =>
  z
    .string({ required_error: requiredMessage })
    .trim()
    .min(1, requiredMessage)
    .max(ATTENTION_TEXT_MAX, `El texto no puede superar ${ATTENTION_TEXT_MAX} caracteres`)

const subProcessId = z.string({ required_error: 'El sub-proceso es requerido' }).cuid('Sub-proceso inválido')

export const sendAttentionRequestSchema = z.object({
  subProcessId,
  message: attentionText('El mensaje es requerido'),
})

export const replyAttentionRequestSchema = z.object({
  id: z.string({ required_error: 'La solicitud es requerida' }).cuid('Solicitud inválida'),
  reply: attentionText('La respuesta es requerida'),
})

export const markAttentionReadSchema = z.object({
  id: z.string({ required_error: 'La solicitud es requerida' }).cuid('Solicitud inválida'),
})

export const listSubProcessAttentionSchema = z.object({ subProcessId })

export type SendAttentionRequestInput = z.input<typeof sendAttentionRequestSchema>
export type ReplyAttentionRequestInput = z.input<typeof replyAttentionRequestSchema>
