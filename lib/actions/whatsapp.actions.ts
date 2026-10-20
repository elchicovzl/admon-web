'use server'

import type { Prisma } from '@prisma/client'
import prisma from '@/lib/db/prisma'
import type { ActionResponse } from '@/lib/types/auth.types'
import { requireWhatsAppAuth } from '@/lib/whatsapp/access'
import { presignGet } from '@/lib/storage/r2'
import {
  getConversationThreadSchema,
  getMediaUrlSchema,
  getUpdatesSchema,
  listConversationsSchema,
  markConversationReadInboxSchema,
  resendFailedMessageSchema,
  sendReplySchema,
  sendTemplateSchema,
  type GetConversationThreadInput,
  type GetUpdatesInput,
  type ListConversationsInput,
  type ResendFailedMessageInput,
  type SendReplyInput,
  type SendTemplateInput,
} from '@/lib/validations/whatsapp.schema'
import type {
  ConversationListPage,
  ConversationSummary,
  ConversationThread,
  InboxUpdates,
  ThreadMessage,
} from '@/lib/types/whatsapp.types'
import { resendMessage, sendReplyMessage, sendTemplateMessage, type Sent } from '@/lib/whatsapp/outbound'
import {
  conversationMarkers,
  olderThanCursor,
  resolveDisplayName,
  sortConversations,
} from '@/lib/whatsapp/inbox'

export interface MediaUrl {
  url: string
  mimeType: string
  fileName: string | null
  expiresInSeconds: number
}

const MEDIA_URL_TTL_SECONDS = 600
/** Types the browser can render inline; everything else is offered as a download. */
const INLINE_MIME = /^(image|audio|video)\/|^application\/pdf$/

/**
 * Presigned URL (10 min) for a stored WhatsApp attachment (MH-2). Module access
 * (SUPER_ADMIN, or a MANAGER with canAccessWhatsApp) is checked first. The R2 key
 * never leaves the server, and the Meta URL was never stored (MH-1).
 */
export async function getMediaUrl(input: { messageId: string }): Promise<ActionResponse<MediaUrl>> {
  try {
    const authCheck = await requireWhatsAppAuth()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const parsed = getMediaUrlSchema.safeParse(input)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
    }

    const media = await prisma.whatsAppMedia.findUnique({
      where: { messageId: parsed.data.messageId },
      select: { status: true, s3Key: true, mimeType: true, fileName: true, r2DeletedAt: true },
    })
    if (!media) {
      return { success: false, error: 'Archivo no encontrado' }
    }
    if (media.status === 'PENDING') {
      return { success: false, error: 'El archivo aún se está descargando' }
    }
    if (media.status !== 'STORED' || !media.s3Key || media.r2DeletedAt) {
      return { success: false, error: 'El archivo no está disponible' }
    }

    const url = await presignGet(media.s3Key, {
      expiresInSeconds: MEDIA_URL_TTL_SECONDS,
      contentType: media.mimeType,
      fileName: media.fileName ?? undefined,
      disposition: INLINE_MIME.test(media.mimeType) ? 'inline' : 'attachment',
    })

    return {
      success: true,
      data: { url, mimeType: media.mimeType, fileName: media.fileName, expiresInSeconds: MEDIA_URL_TTL_SECONDS },
    }
  } catch {
    // Never log the error object: it could carry a signed URL or storage details.
    console.error('[whatsapp] getMediaUrl failed')
    return { success: false, error: 'No se pudo obtener el archivo' }
  }
}

// ---------------------------------------------------------------- inbox reads (PR2.2)

const GENERIC_ERROR = 'No se pudo completar la operación'
/** Escalated conversations are always loaded together: there are few and they must stay on top. */
const ESCALATED_CAP = 200
/** Safety cap for one incremental update; hitting it tells the client to reload. */
const UPDATES_CAP = 200
/**
 * `updatedSince` is re-read with this much overlap so a transaction that committed just after
 * the previous read cannot be missed. Merging is idempotent, so the overlap only costs bytes.
 */
const UPDATES_OVERLAP_MS = 5000

const conversationSelect = {
  id: true,
  status: true,
  aiPaused: true,
  unreadCount: true,
  lastMessagePreview: true,
  lastMessageAt: true,
  lastInboundAt: true,
  escalatedAt: true,
  attentionDueAt: true,
  escalatedOutOfHours: true,
  updatedAt: true,
  takenOverBy: { select: { name: true } },
  contact: {
    select: {
      waId: true,
      profileName: true,
      matchStatus: true,
      client: { select: { id: true, fullName: true } },
      lead: { select: { status: true } },
    },
  },
} as const

type ConversationRow = Prisma.ConversationGetPayload<{ select: typeof conversationSelect }>

function toSummary(row: ConversationRow): ConversationSummary {
  const { contact } = row
  return {
    id: row.id,
    displayName: resolveDisplayName({
      clientName: contact.client?.fullName ?? null,
      profileName: contact.profileName,
      waId: contact.waId,
    }),
    phone: `+${contact.waId}`,
    clientId: contact.client?.id ?? null,
    status: row.status,
    aiPaused: row.aiPaused,
    unreadCount: row.unreadCount,
    preview: row.lastMessagePreview,
    lastMessageAt: row.lastMessageAt.toISOString(),
    lastInboundAt: row.lastInboundAt?.toISOString() ?? null,
    escalatedAt: row.escalatedAt?.toISOString() ?? null,
    attentionDueAt: row.attentionDueAt?.toISOString() ?? null,
    escalatedOutOfHours: row.escalatedOutOfHours,
    takenOverByName: row.takenOverBy?.name ?? null,
    markers: conversationMarkers({
      hasClient: contact.client !== null,
      matchStatus: contact.matchStatus,
      leadStatus: contact.lead?.status ?? null,
    }),
    updatedAt: row.updatedAt.toISOString(),
  }
}

const messageSelect = {
  id: true,
  direction: true,
  source: true,
  type: true,
  text: true,
  templateName: true,
  status: true,
  errorCode: true,
  errorMessage: true,
  timestamp: true,
  updatedAt: true,
  sentBy: { select: { name: true } },
  // No s3Key here on purpose: files are only reachable through getMediaUrl.
  media: {
    select: {
      status: true,
      mimeType: true,
      fileName: true,
      transcript: true,
      transcriptStatus: true,
      durationSec: true,
    },
  },
} as const

type MessageRow = Prisma.WhatsAppMessageGetPayload<{ select: typeof messageSelect }>

function toThreadMessage(row: MessageRow): ThreadMessage {
  return {
    id: row.id,
    direction: row.direction,
    source: row.source,
    type: row.type,
    text: row.text,
    templateName: row.templateName,
    status: row.status,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    senderName: row.sentBy?.name ?? null,
    timestamp: row.timestamp.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    media: row.media,
  }
}

function validationError(issues: { message: string }[]): { success: false; error: string } {
  return { success: false, error: issues[0]?.message ?? 'Datos inválidos' }
}

/**
 * Inbox list (WI-2, WI-12). Shared among permitted users: no per-user filter. The first page
 * carries every ESCALATED conversation (attention order) plus the newest others; `cursor`
 * pages through the others only.
 */
export async function listConversations(
  input: ListConversationsInput = {}
): Promise<ActionResponse<ConversationListPage>> {
  try {
    const authCheck = await requireWhatsAppAuth()
    if (!authCheck.authorized) return { success: false, error: authCheck.error }

    const parsed = listConversationsSchema.safeParse(input)
    if (!parsed.success) return validationError(parsed.error.issues)
    const { state, limit, cursor } = parsed.data

    const cursorAt = new Date()
    const wantEscalated = !cursor && (!state || state === 'ESCALATED')
    const wantOthers = state !== 'ESCALATED'

    const [escalated, others] = await Promise.all([
      wantEscalated
        ? prisma.conversation.findMany({
            where: { status: 'ESCALATED' },
            orderBy: [{ attentionDueAt: 'asc' }, { lastMessageAt: 'desc' }],
            take: ESCALATED_CAP,
            select: conversationSelect,
          })
        : Promise.resolve([] as ConversationRow[]),
      wantOthers
        ? prisma.conversation.findMany({
            where: state ? { status: state } : { status: { not: 'ESCALATED' } },
            orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
            take: limit + 1,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            select: conversationSelect,
          })
        : Promise.resolve([] as ConversationRow[]),
    ])

    const hasMore = others.length > limit
    const page = hasMore ? others.slice(0, limit) : others

    return {
      success: true,
      data: {
        items: sortConversations([...escalated, ...page].map(toSummary)),
        nextCursor: hasMore ? page[page.length - 1].id : null,
        cursor: cursorAt.toISOString(),
      },
    }
  } catch {
    console.error('[whatsapp] listConversations failed')
    return { success: false, error: GENERIC_ERROR }
  }
}

/** One conversation with its newest messages (oldest first); `before` loads older history. */
export async function getConversationThread(
  input: GetConversationThreadInput
): Promise<ActionResponse<ConversationThread>> {
  try {
    const authCheck = await requireWhatsAppAuth()
    if (!authCheck.authorized) return { success: false, error: authCheck.error }

    const parsed = getConversationThreadSchema.safeParse(input)
    if (!parsed.success) return validationError(parsed.error.issues)
    const { conversationId, before, limit } = parsed.data

    const cursorAt = new Date()
    const [conversation, rows] = await Promise.all([
      prisma.conversation.findUnique({ where: { id: conversationId }, select: conversationSelect }),
      prisma.whatsAppMessage.findMany({
        where: { conversationId, ...(before ? olderThanCursor(before) : {}) },
        orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        select: messageSelect,
      }),
    ])
    if (!conversation) return { success: false, error: 'Conversación no encontrada' }

    const hasMore = rows.length > limit
    const newest = (hasMore ? rows.slice(0, limit) : rows).reverse()

    return {
      success: true,
      data: {
        conversation: toSummary(conversation),
        messages: newest.map(toThreadMessage),
        hasMore,
        cursor: cursorAt.toISOString(),
      },
    }
  } catch {
    console.error('[whatsapp] getConversationThread failed')
    return { success: false, error: GENERIC_ERROR }
  }
}

/**
 * Incremental poll (WI-5): conversations changed since the cursor, and, when a conversation
 * is open, its changed messages. The cursor is server time, so client clocks never matter.
 */
export async function getUpdates(input: GetUpdatesInput): Promise<ActionResponse<InboxUpdates>> {
  try {
    const authCheck = await requireWhatsAppAuth()
    if (!authCheck.authorized) return { success: false, error: authCheck.error }

    const parsed = getUpdatesSchema.safeParse(input)
    if (!parsed.success) return validationError(parsed.error.issues)
    const { updatedSince, conversationId } = parsed.data

    const cursorAt = new Date()
    const since = new Date(new Date(updatedSince).getTime() - UPDATES_OVERLAP_MS)

    const [conversations, messages] = await Promise.all([
      prisma.conversation.findMany({
        where: { updatedAt: { gt: since } },
        orderBy: { updatedAt: 'asc' },
        take: UPDATES_CAP + 1,
        select: conversationSelect,
      }),
      conversationId
        ? prisma.whatsAppMessage.findMany({
            where: { conversationId, updatedAt: { gt: since } },
            orderBy: { updatedAt: 'asc' },
            take: UPDATES_CAP + 1,
            select: messageSelect,
          })
        : Promise.resolve([] as MessageRow[]),
    ])

    const truncated = conversations.length > UPDATES_CAP || messages.length > UPDATES_CAP
    return {
      success: true,
      data: {
        conversations: conversations.slice(0, UPDATES_CAP).map(toSummary),
        messages: messages.slice(0, UPDATES_CAP).map(toThreadMessage),
        truncated,
        cursor: cursorAt.toISOString(),
      },
    }
  } catch {
    console.error('[whatsapp] getUpdates failed')
    return { success: false, error: GENERIC_ERROR }
  }
}

/**
 * Opening a thread clears the shared unread counter. This is the only write of the read-only
 * inbox: it touches `unreadCount` and nothing else (no state, no version, no audit).
 */
export async function markConversationRead(input: {
  conversationId: string
}): Promise<ActionResponse<{ updated: number }>> {
  try {
    const authCheck = await requireWhatsAppAuth()
    if (!authCheck.authorized) return { success: false, error: authCheck.error }

    const parsed = markConversationReadInboxSchema.safeParse(input)
    if (!parsed.success) return validationError(parsed.error.issues)

    const { count } = await prisma.conversation.updateMany({
      where: { id: parsed.data.conversationId, unreadCount: { gt: 0 } },
      data: { unreadCount: 0 },
    })
    return { success: true, data: { updated: count } }
  } catch {
    console.error('[whatsapp] markConversationRead failed')
    return { success: false, error: GENERIC_ERROR }
  }
}

// ---------------------------------------------------------------- sending (PR2.3)

/**
 * Free-text reply. Allowed only while the 24 h window is open (WC-13) and the conversation is not
 * CLOSED; it moves the conversation to HUMAN in the same transaction as the outbox insert (WI-7).
 * Attachments go through POST /api/whatsapp/messages/media, which shares the same service.
 */
export async function sendReply(input: SendReplyInput): Promise<ActionResponse<Sent>> {
  try {
    const authCheck = await requireWhatsAppAuth()
    if (!authCheck.authorized) return { success: false, error: authCheck.error }

    const parsed = sendReplySchema.safeParse(input)
    if (!parsed.success) return validationError(parsed.error.issues)

    return await sendReplyMessage({ ...parsed.data, userId: authCheck.userId })
  } catch {
    console.error('[whatsapp] sendReply failed')
    return { success: false, error: GENERIC_ERROR }
  }
}

/** Approved template (WI-10): the only thing that can be sent once the 24 h window is closed. */
export async function sendTemplate(input: SendTemplateInput): Promise<ActionResponse<Sent>> {
  try {
    const authCheck = await requireWhatsAppAuth()
    if (!authCheck.authorized) return { success: false, error: authCheck.error }

    const parsed = sendTemplateSchema.safeParse(input)
    if (!parsed.success) return validationError(parsed.error.issues)

    return await sendTemplateMessage({ ...parsed.data, userId: authCheck.userId })
  } catch {
    console.error('[whatsapp] sendTemplate failed')
    return { success: false, error: GENERIC_ERROR }
  }
}

/** Sends a FAILED dashboard message again (S-WI-9). AI and system messages are not resendable. */
export async function resendFailedMessage(input: ResendFailedMessageInput): Promise<ActionResponse<Sent>> {
  try {
    const authCheck = await requireWhatsAppAuth()
    if (!authCheck.authorized) return { success: false, error: authCheck.error }

    const parsed = resendFailedMessageSchema.safeParse(input)
    if (!parsed.success) return validationError(parsed.error.issues)

    return await resendMessage({ ...parsed.data, userId: authCheck.userId })
  } catch {
    console.error('[whatsapp] resendFailedMessage failed')
    return { success: false, error: GENERIC_ERROR }
  }
}
