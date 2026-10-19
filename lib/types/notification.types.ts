import type { NotificationType } from '@prisma/client'

/** One notification as the dashboard shows it. Text and link are derived server side. */
export interface NotificationView {
  id: string
  type: NotificationType
  title: string
  body: string
  /** In-app path to open. */
  link: string
  conversationId: string | null
  entityId: string | null
  read: boolean
  /** ISO timestamp. */
  createdAt: string
}

export interface NotificationFeed {
  /** Unread rows for the caller, whatever the page size. */
  unreadCount: number
  /** Newest first. */
  items: NotificationView[]
}
