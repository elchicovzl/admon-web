import type { NotificationType } from '@prisma/client'

/**
 * Pure presentation of a notification: Spanish copy, the in-app link and the browser
 * notification payload. Rows store only the type and ids, so nothing here can go stale
 * and no message content or phone number ever reaches the notification table.
 */

export const WHATSAPP_INBOX_PATH = '/dashboard/whatsapp'
export const PENDING_REVIEW_PATH = '/dashboard/affiliations/pending-review'

const FALLBACK_NAME = 'Un cliente'

export function notificationLink(type: NotificationType, conversationId: string | null): string {
  if (type === 'DRAFT_PENDING_REVIEW') return PENDING_REVIEW_PATH
  if (conversationId) return `${WHATSAPP_INBOX_PATH}?c=${encodeURIComponent(conversationId)}`
  return WHATSAPP_INBOX_PATH
}

/** `contactName` is the WhatsApp profile name; the phone number is never shown here. */
export function notificationText(
  type: NotificationType,
  contactName?: string | null
): { title: string; body: string } {
  const name = contactName?.trim() || FALLBACK_NAME
  switch (type) {
    case 'ESCALATION':
      return { title: 'Conversación escalada', body: `${name} necesita atención de un asesor` }
    case 'NEW_LEAD':
      return { title: 'Nuevo lead', body: `${name} escribió por WhatsApp` }
    case 'NEW_ACTIVITY_ON_ESCALATED':
      return { title: 'Nuevo mensaje', body: `${name} escribió en una conversación escalada` }
    case 'AI_FAILURE':
      return { title: 'El asistente no pudo responder', body: `Revise la conversación con ${name}` }
    case 'DRAFT_PENDING_REVIEW':
      return { title: 'Borrador pendiente de revisión', body: 'Hay una afiliación por revisar' }
  }
}

export interface BrowserNotificationSpec {
  title: string
  body: string
  /** Same tag replaces the previous OS notification instead of stacking one per message. */
  tag: string
  link: string
}

export function browserNotificationSpec(item: {
  id: string
  title: string
  body: string
  link: string
  conversationId: string | null
  entityId: string | null
}): BrowserNotificationSpec {
  return {
    title: item.title,
    body: item.body,
    tag: item.conversationId ?? item.entityId ?? item.id,
    link: item.link,
  }
}
