'use server'

import prisma from '@/lib/db/prisma'
import type { ActionResponse } from '@/lib/types/auth.types'
import type { NotificationFeed } from '@/lib/types/notification.types'
import { requireWhatsAppAuth } from '@/lib/whatsapp/access'
import { notificationLink, notificationText } from '@/lib/notifications/present'
import {
  listNotificationsSchema,
  markConversationReadSchema,
  markNotificationReadSchema,
  type ListNotificationsInput,
} from '@/lib/validations/notification.schema'

/**
 * In-app WhatsApp notifications for the signed-in user (NT-4, NT-7, NT-8).
 *
 * Every query is scoped to `session.user.id` as returned by `requireWhatsAppAuth()`; no action
 * accepts a user id, so nobody can read or clear somebody else's notifications. Reading a
 * notification also clears its `dedupKey`, which lets the next event for that conversation
 * notify again (at most one UNREAD activity notification per conversation and user).
 */

const GENERIC_ERROR = 'No se pudo completar la operación'

function validationError(issues: { message: string }[]): { success: false; error: string } {
  return { success: false, error: issues[0]?.message ?? 'Datos inválidos' }
}

/** Unread count for the badge. */
export async function getUnreadNotificationCount(): Promise<ActionResponse<{ count: number }>> {
  try {
    const authCheck = await requireWhatsAppAuth()
    if (!authCheck.authorized) return { success: false, error: authCheck.error }

    const count = await prisma.notification.count({ where: { userId: authCheck.userId, readAt: null } })
    return { success: true, data: { count } }
  } catch {
    console.error('[notifications] count failed')
    return { success: false, error: GENERIC_ERROR }
  }
}

/** Newest notifications plus the unread total; one round trip per poll. */
export async function listNotifications(input: ListNotificationsInput = {}): Promise<ActionResponse<NotificationFeed>> {
  try {
    const authCheck = await requireWhatsAppAuth()
    if (!authCheck.authorized) return { success: false, error: authCheck.error }

    const parsed = listNotificationsSchema.safeParse(input)
    if (!parsed.success) return validationError(parsed.error.issues)

    const [unreadCount, rows] = await Promise.all([
      prisma.notification.count({ where: { userId: authCheck.userId, readAt: null } }),
      prisma.notification.findMany({
        where: { userId: authCheck.userId },
        orderBy: { createdAt: 'desc' },
        take: parsed.data.limit,
        select: {
          id: true,
          type: true,
          conversationId: true,
          entityId: true,
          readAt: true,
          createdAt: true,
          conversation: { select: { contact: { select: { profileName: true } } } },
        },
      }),
    ])

    return {
      success: true,
      data: {
        unreadCount,
        items: rows.map((row) => ({
          id: row.id,
          type: row.type,
          ...notificationText(row.type, row.conversation?.contact.profileName),
          link: notificationLink(row.type, row.conversationId),
          conversationId: row.conversationId,
          entityId: row.entityId,
          read: row.readAt !== null,
          createdAt: row.createdAt.toISOString(),
        })),
      },
    }
  } catch {
    console.error('[notifications] list failed')
    return { success: false, error: GENERIC_ERROR }
  }
}

export async function markNotificationRead(input: { id: string }): Promise<ActionResponse<{ updated: number }>> {
  try {
    const authCheck = await requireWhatsAppAuth()
    if (!authCheck.authorized) return { success: false, error: authCheck.error }

    const parsed = markNotificationReadSchema.safeParse(input)
    if (!parsed.success) return validationError(parsed.error.issues)

    const { count } = await prisma.notification.updateMany({
      where: { id: parsed.data.id, userId: authCheck.userId, readAt: null },
      data: { readAt: new Date(), dedupKey: null },
    })
    return { success: true, data: { updated: count } }
  } catch {
    console.error('[notifications] markRead failed')
    return { success: false, error: GENERIC_ERROR }
  }
}

export async function markAllNotificationsRead(): Promise<ActionResponse<{ updated: number }>> {
  try {
    const authCheck = await requireWhatsAppAuth()
    if (!authCheck.authorized) return { success: false, error: authCheck.error }

    const { count } = await prisma.notification.updateMany({
      where: { userId: authCheck.userId, readAt: null },
      data: { readAt: new Date(), dedupKey: null },
    })
    return { success: true, data: { updated: count } }
  } catch {
    console.error('[notifications] markAllRead failed')
    return { success: false, error: GENERIC_ERROR }
  }
}

/** Opening a conversation clears every notification about it for the caller (NT-4). */
export async function markConversationNotificationsRead(input: {
  conversationId: string
}): Promise<ActionResponse<{ updated: number }>> {
  try {
    const authCheck = await requireWhatsAppAuth()
    if (!authCheck.authorized) return { success: false, error: authCheck.error }

    const parsed = markConversationReadSchema.safeParse(input)
    if (!parsed.success) return validationError(parsed.error.issues)

    const { count } = await prisma.notification.updateMany({
      where: { userId: authCheck.userId, conversationId: parsed.data.conversationId, readAt: null },
      data: { readAt: new Date(), dedupKey: null },
    })
    return { success: true, data: { updated: count } }
  } catch {
    console.error('[notifications] markConversationRead failed')
    return { success: false, error: GENERIC_ERROR }
  }
}
