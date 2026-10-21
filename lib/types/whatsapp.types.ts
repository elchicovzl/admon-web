import type {
  ConversationStatus,
  MediaStatus,
  MessageDirection,
  MessageSource,
  MessageStatus,
  MessageType,
  TranscriptStatus,
} from '@prisma/client'

/** Inbox chips: why a conversation has no client behind it (WI-3). */
export type ConversationMarker = 'NO_CLIENT' | 'LEAD' | 'AMBIGUOUS'

/** One inbox row. Dates are ISO strings so the object crosses the server/client boundary. */
export interface ConversationSummary {
  id: string
  /** Client name, else WhatsApp profile name, else the phone. */
  displayName: string
  /** `+<waId>`. Staff-only UI; never logged. */
  phone: string
  clientId: string | null
  status: ConversationStatus
  aiPaused: boolean
  unreadCount: number
  preview: string | null
  lastMessageAt: string
  lastInboundAt: string | null
  escalatedAt: string | null
  attentionDueAt: string | null
  escalatedOutOfHours: boolean
  takenOverByName: string | null
  markers: ConversationMarker[]
  updatedAt: string
}

export interface ThreadMedia {
  status: MediaStatus
  mimeType: string
  fileName: string | null
  transcript: string | null
  transcriptStatus: TranscriptStatus | null
  durationSec: number | null
}

/** One bubble. There is no storage key anywhere in here: files go through `getMediaUrl`. */
export interface ThreadMessage {
  id: string
  direction: MessageDirection
  source: MessageSource
  type: MessageType
  text: string | null
  templateName: string | null
  status: MessageStatus
  /** Machine code of a FAILED send (Meta code or ours); lets the UI tell an unconfirmed delivery apart. */
  errorCode: string | null
  errorMessage: string | null
  senderName: string | null
  /** ISO timestamp used for ordering. */
  timestamp: string
  updatedAt: string
  media: ThreadMedia | null
}

export interface ConversationListPage {
  items: ConversationSummary[]
  /** Pass back as `cursor` for the next page of non-escalated rows; null when exhausted. */
  nextCursor: string | null
  /** Server time of this read; seed for `getUpdates`. */
  cursor: string
}

export interface ConversationThread {
  conversation: ConversationSummary
  /** Oldest first. */
  messages: ThreadMessage[]
  hasMore: boolean
  cursor: string
}

export interface InboxUpdates {
  conversations: ConversationSummary[]
  /** Only the open conversation's changed messages (new ones and status ticks). */
  messages: ThreadMessage[]
  /** True when a result hit the safety cap: the client should reload instead of trusting a merge. */
  truncated: boolean
  cursor: string
}

/** One row of the "Vincular a cliente" picker. */
export interface ClientLinkOption {
  id: string
  fullName: string
  identificationNumber: string
  phone: string
}

/** One conversation in the client profile's WhatsApp tab (CP-1). No consent data on purpose (CP-3). */
export interface ClientConversationItem {
  id: string
  phone: string
  profileName: string | null
  status: ConversationSummary['status']
  aiPaused: boolean
  unreadCount: number
  preview: string | null
  lastMessageAt: string
  takenOverByName: string | null
}

/** Global AI switch as the inbox shows it (AI-12). `envEnabled` is the server flag WHATSAPP_AI_ENABLED. */
export interface AiSettings {
  envEnabled: boolean
  aiEnabled: boolean
  /** Only a SUPER_ADMIN may change `aiEnabled`. */
  canManage: boolean
  updatedAt: string | null
}

/** AI usage counters; never carries conversation content (AI-13). */
export interface AiUsageCounters {
  turns: number
  replied: number
  escalated: number
  failed: number
  inputTokens: number
  outputTokens: number
  transcriptions: number
  audioMinutes: number
  costUsd: number
}

export interface AiUsageDay extends AiUsageCounters {
  /** YYYY-MM-DD in America/Bogota. */
  day: string
}

export interface AiUsageSummary {
  days: number
  perDay: AiUsageDay[]
  totals: AiUsageCounters
}

/** AI cost and abuse limits as Configuración → WhatsApp shows them (SUPER_ADMIN only). */
export interface AiLimitSettings {
  /** null = not saved: the server value applies (no cap for the daily budget). */
  saved: {
    dailyBudgetUsd: number | null
    maxTurnsPerDay: number | null
    maxConsecutiveFailures: number | null
    forbiddenTopics: string[]
  }
  /** Values from the server env, used when a saved field is empty. */
  server: { maxTurnsPerDay: number; maxConsecutiveFailures: number; forbiddenTopics: string[] }
  spentTodayUsd: number
}
