'use server'

import type { Prisma } from '@prisma/client'
import prisma from '@/lib/db/prisma'
import type { ActionResponse } from '@/lib/types/auth.types'
import { requireWhatsAppAuth } from '@/lib/whatsapp/access'
import { presignGet } from '@/lib/storage/r2'
import {
  closeConversationSchema,
  conversationActionSchema,
  getClientConversationsSchema,
  getConversationThreadSchema,
  getMediaUrlSchema,
  getUpdatesSchema,
  linkContactToClientSchema,
  listConversationsSchema,
  markConversationReadInboxSchema,
  reopenConversationSchema,
  resendFailedMessageSchema,
  searchClientsForLinkSchema,
  sendReplySchema,
  sendTemplateSchema,
  setConversationAiPausedSchema,
  type CloseConversationInput,
  type ConversationActionInput,
  type GetClientConversationsInput,
  type GetConversationThreadInput,
  type GetUpdatesInput,
  type LinkContactToClientInput,
  type ListConversationsInput,
  type ReopenConversationInput,
  type ResendFailedMessageInput,
  type SearchClientsForLinkInput,
  type SendReplyInput,
  type SendTemplateInput,
  type SetConversationAiPausedInput,
} from '@/lib/validations/whatsapp.schema'
import type {
  ClientConversationItem,
  ClientLinkOption,
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
import { buildConversationSearchSql } from '@/lib/whatsapp/search'
import { buildClientLinkSearchSql } from '@/lib/whatsapp/client-search'
import {
  applyTransition,
  setConversationAiPaused as setAiPaused,
  type TransitionInput,
  type TransitionOutcome,
} from '@/lib/whatsapp/transitions'
import {
  confirmContactAsUnknown as confirmUnknown,
  linkContactToClient as linkContact,
  unlinkContactFromClient as unlinkContact,
} from '@/lib/whatsapp/contacts'

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
    const { state, limit, cursor, q } = parsed.data
    // Search narrows both queries (escalated and others) and combines with the state filter.
    const searchSql = buildConversationSearchSql(q)
    const search: Prisma.ConversationWhereInput = searchSql
      ? { id: { in: (await prisma.$queryRaw<{ id: string }[]>(searchSql)).map((row) => row.id) } }
      : {}

    const cursorAt = new Date()
    const wantEscalated = !cursor && (!state || state === 'ESCALATED')
    const wantOthers = state !== 'ESCALATED'

    const [escalated, others] = await Promise.all([
      wantEscalated
        ? prisma.conversation.findMany({
            where: { status: 'ESCALATED', ...search },
            orderBy: [{ attentionDueAt: 'asc' }, { lastMessageAt: 'desc' }],
            take: ESCALATED_CAP,
            select: conversationSelect,
          })
        : Promise.resolve([] as ConversationRow[]),
      wantOthers
        ? prisma.conversation.findMany({
            where: { ...(state ? { status: state } : { status: { not: 'ESCALATED' } }), ...search },
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

// ---------------------------------------------------------------- handoff and contacts (PR2.4)

const TRANSITION_ERRORS: Record<string, string> = {
  NOT_FOUND: 'Conversación no encontrada',
  CONFLICT: 'La conversación cambió mientras tanto. Intente de nuevo.',
}
const TRANSITION_REJECTED = 'Esta acción no está disponible en el estado actual de la conversación'

/** Same contract as the other actions: never throws, and logs only the action name. */
async function guarded<T>(name: string, body: () => Promise<ActionResponse<T>>): Promise<ActionResponse<T>> {
  try {
    return await body()
  } catch {
    console.error(`[whatsapp] ${name} failed`)
    return { success: false, error: GENERIC_ERROR }
  }
}

/** The conversation as the inbox shows it, so the caller can merge it without waiting for a poll. */
async function freshSummary(conversationId: string): Promise<ActionResponse<ConversationSummary>> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: conversationSelect,
  })
  if (!conversation) return { success: false, error: TRANSITION_ERRORS.NOT_FOUND }
  return { success: true, data: toSummary(conversation) }
}

async function runTransition(input: Omit<TransitionInput, 'actor'>): Promise<ActionResponse<ConversationSummary>> {
  const outcome: TransitionOutcome = await applyTransition({ ...input, actor: 'USER' })
  if (!outcome.ok) return { success: false, error: TRANSITION_ERRORS[outcome.code] ?? TRANSITION_REJECTED }
  return freshSummary(input.conversationId)
}

/** "Atender": a person takes the conversation from the AI or from an escalation (CH-2). */
export async function takeConversation(input: ConversationActionInput): Promise<ActionResponse<ConversationSummary>> {
  return guarded('takeConversation', async () => {
    const authCheck = await requireWhatsAppAuth()
    if (!authCheck.authorized) return { success: false, error: authCheck.error }
    const parsed = conversationActionSchema.safeParse(input)
    if (!parsed.success) return validationError(parsed.error.issues)

    return runTransition({ conversationId: parsed.data.conversationId, event: 'TAKE', actorUserId: authCheck.userId })
  })
}

/** Manual hand-back to the AI only (CH-6): the actor is audited and the backlog is skipped. */
export async function returnToAi(input: ConversationActionInput): Promise<ActionResponse<ConversationSummary>> {
  return guarded('returnToAi', async () => {
    const authCheck = await requireWhatsAppAuth()
    if (!authCheck.authorized) return { success: false, error: authCheck.error }
    const parsed = conversationActionSchema.safeParse(input)
    if (!parsed.success) return validationError(parsed.error.issues)

    return runTransition({
      conversationId: parsed.data.conversationId,
      event: 'RETURN_TO_AI',
      actorUserId: authCheck.userId,
    })
  })
}

export async function closeConversation(input: CloseConversationInput): Promise<ActionResponse<ConversationSummary>> {
  return guarded('closeConversation', async () => {
    const authCheck = await requireWhatsAppAuth()
    if (!authCheck.authorized) return { success: false, error: authCheck.error }
    const parsed = closeConversationSchema.safeParse(input)
    if (!parsed.success) return validationError(parsed.error.issues)
    const { conversationId, reason } = parsed.data

    return runTransition({ conversationId, event: 'CLOSE', actorUserId: authCheck.userId, ...(reason ? { reason } : {}) })
  })
}

/** A closed conversation reopens with the AI or with a person, as the user chooses (CH-2). */
export async function reopenConversation(
  input: ReopenConversationInput
): Promise<ActionResponse<ConversationSummary>> {
  return guarded('reopenConversation', async () => {
    const authCheck = await requireWhatsAppAuth()
    if (!authCheck.authorized) return { success: false, error: authCheck.error }
    const parsed = reopenConversationSchema.safeParse(input)
    if (!parsed.success) return validationError(parsed.error.issues)
    const { conversationId, target } = parsed.data

    return runTransition({ conversationId, event: 'REOPEN', actorUserId: authCheck.userId, target })
  })
}

/** Per-conversation AI switch (WI-9). It never changes the state; see `setConversationAiPaused`. */
export async function setConversationAiPaused(
  input: SetConversationAiPausedInput
): Promise<ActionResponse<ConversationSummary>> {
  return guarded('setConversationAiPaused', async () => {
    const authCheck = await requireWhatsAppAuth()
    if (!authCheck.authorized) return { success: false, error: authCheck.error }
    const parsed = setConversationAiPausedSchema.safeParse(input)
    if (!parsed.success) return validationError(parsed.error.issues)

    const outcome = await setAiPaused({ ...parsed.data, actorUserId: authCheck.userId })
    if (!outcome.ok) return { success: false, error: TRANSITION_ERRORS.NOT_FOUND }
    return freshSummary(parsed.data.conversationId)
  })
}

type ContactOfConversation = { contactId: string; clientId: string | null }

async function contactOf(conversationId: string): Promise<ContactOfConversation | null> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { contactId: true, contact: { select: { clientId: true } } },
  })
  return conversation ? { contactId: conversation.contactId, clientId: conversation.contact.clientId } : null
}

/**
 * Contact changes do not touch the conversation row, so it is bumped: pollers merge by
 * `updatedAt`, and the list markers (Sin cliente / Lead / Ambiguo) must refresh for everyone.
 */
async function touchAndSummarize(conversationId: string): Promise<ActionResponse<ConversationSummary>> {
  await prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } })
  return freshSummary(conversationId)
}

/** Manual link to a Client (LD-5): wins over automatic matching and converts the lead. */
export async function linkContactToClient(
  input: LinkContactToClientInput
): Promise<ActionResponse<ConversationSummary>> {
  return guarded('linkContactToClient', async () => {
    const authCheck = await requireWhatsAppAuth()
    if (!authCheck.authorized) return { success: false, error: authCheck.error }
    const parsed = linkContactToClientSchema.safeParse(input)
    if (!parsed.success) return validationError(parsed.error.issues)
    const { conversationId, clientId } = parsed.data

    const contact = await contactOf(conversationId)
    if (!contact) return { success: false, error: TRANSITION_ERRORS.NOT_FOUND }

    const outcome = await linkContact(contact.contactId, clientId)
    if (!outcome.ok) return { success: false, error: 'Cliente no encontrado' }
    return touchAndSummarize(conversationId)
  })
}

/** The number is not the linked Client's: unlink, lock, and keep it as a lead. */
export async function unlinkContactFromClient(
  input: ConversationActionInput
): Promise<ActionResponse<ConversationSummary>> {
  return guarded('unlinkContactFromClient', async () => {
    const authCheck = await requireWhatsAppAuth()
    if (!authCheck.authorized) return { success: false, error: authCheck.error }
    const parsed = conversationActionSchema.safeParse(input)
    if (!parsed.success) return validationError(parsed.error.issues)
    const { conversationId } = parsed.data

    const contact = await contactOf(conversationId)
    if (!contact) return { success: false, error: TRANSITION_ERRORS.NOT_FOUND }
    if (!contact.clientId) return { success: false, error: 'La conversación no está vinculada a un cliente' }

    await unlinkContact(contact.contactId, conversationId)
    return touchAndSummarize(conversationId)
  })
}

/** An ambiguous (or unmatched) number belongs to nobody on file: lock it and create its lead (LD-8). */
export async function confirmContactAsUnknown(
  input: ConversationActionInput
): Promise<ActionResponse<ConversationSummary>> {
  return guarded('confirmContactAsUnknown', async () => {
    const authCheck = await requireWhatsAppAuth()
    if (!authCheck.authorized) return { success: false, error: authCheck.error }
    const parsed = conversationActionSchema.safeParse(input)
    if (!parsed.success) return validationError(parsed.error.issues)
    const { conversationId } = parsed.data

    const contact = await contactOf(conversationId)
    if (!contact) return { success: false, error: TRANSITION_ERRORS.NOT_FOUND }
    if (contact.clientId) {
      return { success: false, error: 'El contacto está vinculado a un cliente. Desvincúlelo primero.' }
    }

    await confirmUnknown(contact.contactId, conversationId)
    return touchAndSummarize(conversationId)
  })
}

/** Client picker for "Vincular a cliente": name, document or phone digits; active clients only. */
export async function searchClientsForLink(
  input: SearchClientsForLinkInput
): Promise<ActionResponse<ClientLinkOption[]>> {
  try {
    const authCheck = await requireWhatsAppAuth()
    if (!authCheck.authorized) return { success: false, error: authCheck.error }
    const parsed = searchClientsForLinkSchema.safeParse(input)
    if (!parsed.success) return validationError(parsed.error.issues)

    const sql = buildClientLinkSearchSql(parsed.data.q)
    if (!sql) return { success: true, data: [] }
    const rows = await prisma.$queryRaw<ClientLinkOption[]>(sql)
    return {
      success: true,
      data: rows.map((row) => ({
        id: row.id,
        fullName: row.fullName,
        identificationNumber: row.identificationNumber,
        phone: row.phone,
      })),
    }
  } catch {
    console.error('[whatsapp] searchClientsForLink failed')
    return { success: false, error: GENERIC_ERROR }
  }
}

// ---------------------------------------------------------------- client profile tab (PR2.5)

/**
 * WhatsApp conversations of one client, newest first (CP-1). A client can have several numbers,
 * so several conversations. Conversations pending purge are left out (CP-4), and consent data is
 * never selected (CP-3).
 */
export async function getClientConversations(
  input: GetClientConversationsInput
): Promise<ActionResponse<ClientConversationItem[]>> {
  return guarded('getClientConversations', async () => {
    const authCheck = await requireWhatsAppAuth()
    if (!authCheck.authorized) return { success: false, error: authCheck.error }
    const parsed = getClientConversationsSchema.safeParse(input)
    if (!parsed.success) return validationError(parsed.error.issues)

    const rows = await prisma.conversation.findMany({
      where: { contact: { clientId: parsed.data.clientId }, purgePendingAt: null },
      orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        status: true,
        aiPaused: true,
        unreadCount: true,
        lastMessagePreview: true,
        lastMessageAt: true,
        takenOverBy: { select: { name: true } },
        contact: { select: { waId: true, profileName: true } },
      },
    })
    return {
      success: true,
      data: rows.map((row) => ({
        id: row.id,
        phone: `+${row.contact.waId}`,
        profileName: row.contact.profileName,
        status: row.status,
        aiPaused: row.aiPaused,
        unreadCount: row.unreadCount,
        preview: row.lastMessagePreview,
        lastMessageAt: row.lastMessageAt.toISOString(),
        takenOverByName: row.takenOverBy?.name ?? null,
      })),
    }
  })
}
