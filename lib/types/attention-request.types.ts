/**
 * Process attention requests: a user asks the assignee of a sub-process for attention and the
 * assignee replies to the sender. Shown in the header attention bell and on the sub-process page.
 */

/** REQUEST: someone asked me for attention. REPLY: the assignee answered my request. */
export type AttentionFeedItemKind = 'REQUEST' | 'REPLY'

export interface AttentionFeedItem {
  /** Attention request id (the same request can appear as REQUEST for one user and REPLY for another). */
  id: string
  kind: AttentionFeedItemKind
  read: boolean
  /** When the request was sent (REQUEST) or answered (REPLY). */
  eventAt: Date
  /** The other person: the sender for REQUEST, the assignee for REPLY. */
  counterpartName: string
  /** Sub-process type and client, e.g. "ARL · Juan Pérez". */
  subProcessLabel: string
  link: string
  message: string
  reply: string | null
  /** True for a REQUEST that has not been answered yet. */
  canReply: boolean
}

export interface AttentionFeed {
  unreadCount: number
  items: AttentionFeedItem[]
}

export type AttentionRequestStatus = 'PENDING' | 'ANSWERED'

export interface AttentionRequestView {
  id: string
  senderName: string
  recipientName: string
  message: string
  reply: string | null
  status: AttentionRequestStatus
  createdAt: Date
  repliedAt: Date | null
}
