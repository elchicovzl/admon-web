import type { NotificationType } from "@prisma/client"
import prisma from "@/lib/db/prisma"
import type { NotifyEvent, NotifyPort } from "./port"

/**
 * In-app fan-out behind `NotifyPort` (design D17 as amended: in-app only, no email).
 *
 * Recipients are active users who can open the WhatsApp module: `canAccessWhatsApp` plus every
 * SUPER_ADMIN. The role is not enough on its own, a MANAGER without access never hears about
 * conversations they cannot open. There is no `isSystem` flag on User yet (it arrives with the
 * AI-draft work), and inactive users are excluded, which already covers a system account.
 *
 * Dedup is the `@@unique([userId, dedupKey])` constraint plus `skipDuplicates`: re-emitting the
 * same event, or a new activity event while the previous one is still unread, inserts nothing.
 * Reading a notification clears its key, so the next event notifies again.
 */

export interface NotificationDraft {
  type: NotificationType
  conversationId: string | null
  entityId: string | null
  dedupKey: string
}

/** Pure mapping from a producer event to the row it produces (one per recipient). */
export function toNotificationDraft(event: NotifyEvent): NotificationDraft {
  switch (event.type) {
    case "ESCALATION":
      return {
        type: "ESCALATION",
        conversationId: event.conversationId,
        entityId: null,
        dedupKey: `escalation:${event.conversationId}:${event.escalatedAt.getTime()}`,
      }
    case "NEW_ACTIVITY_ON_ESCALATED":
      return {
        type: "NEW_ACTIVITY_ON_ESCALATED",
        conversationId: event.conversationId,
        entityId: null,
        dedupKey: `activity:${event.conversationId}`,
      }
    case "AI_FAILURE":
      return {
        type: "AI_FAILURE",
        conversationId: event.conversationId,
        entityId: null,
        dedupKey: `ai-failure:${event.conversationId}`,
      }
    case "NEW_LEAD":
      return {
        type: "NEW_LEAD",
        conversationId: event.conversationId ?? null,
        entityId: event.leadId,
        dedupKey: `lead:${event.leadId}`,
      }
    case "DRAFT_PENDING_REVIEW":
      return {
        type: "DRAFT_PENDING_REVIEW",
        conversationId: event.conversationId ?? null,
        entityId: event.draftId,
        dedupKey: `draft:${event.draftId}`,
      }
  }
}

/** Ids of the users who should be told about WhatsApp activity. */
export async function findNotificationRecipients(): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { isActive: true, OR: [{ role: "SUPER_ADMIN" }, { canAccessWhatsApp: true }] },
    select: { id: true },
  })
  return users.map((user) => user.id)
}

/** Creates the notification for every recipient. Returns how many rows were actually inserted. */
export async function fanOutNotification(event: NotifyEvent): Promise<number> {
  const recipients = await findNotificationRecipients()
  if (recipients.length === 0) return 0

  const draft = toNotificationDraft(event)
  const { count } = await prisma.notification.createMany({
    data: recipients.map((userId) => ({ userId, ...draft })),
    skipDuplicates: true,
  })
  return count
}

export const dbNotifyPort: NotifyPort = {
  async notify(event) {
    await fanOutNotification(event)
  },
}
