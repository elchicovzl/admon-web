import { z } from 'zod'

export const NOTIFICATION_PAGE_SIZE_DEFAULT = 20
export const NOTIFICATION_PAGE_SIZE_MAX = 50

export const listNotificationsSchema = z.object({
  limit: z
    .number({ invalid_type_error: 'Límite inválido' })
    .int('Límite inválido')
    .min(1, 'Límite inválido')
    .max(NOTIFICATION_PAGE_SIZE_MAX, 'Límite inválido')
    .default(NOTIFICATION_PAGE_SIZE_DEFAULT),
})

export const markNotificationReadSchema = z.object({
  id: z.string({ required_error: 'La notificación es requerida' }).cuid('Notificación inválida'),
})

export const markConversationReadSchema = z.object({
  conversationId: z.string({ required_error: 'La conversación es requerida' }).cuid('Conversación inválida'),
})

export type ListNotificationsInput = z.input<typeof listNotificationsSchema>
