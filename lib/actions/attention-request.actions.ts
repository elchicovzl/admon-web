'use server'

import { revalidatePath } from 'next/cache'
import type { AffiliationSubProcessType } from '@prisma/client'
import prisma from '@/lib/db/prisma'
import { auth } from '@/lib/auth/auth'
import type { ActionResponse } from '@/lib/types/auth.types'
import { SubProcessTypeLabels } from '@/lib/types/affiliation.types'
import type {
  AttentionFeed,
  AttentionFeedItem,
  AttentionRequestView,
} from '@/lib/types/attention-request.types'
import {
  ATTENTION_FEED_SIZE,
  listSubProcessAttentionSchema,
  markAttentionReadSchema,
  replyAttentionRequestSchema,
  sendAttentionRequestSchema,
  type ReplyAttentionRequestInput,
  type SendAttentionRequestInput,
} from '@/lib/validations/attention-request.schema'

/**
 * Process attention requests (header attention bell, separate from WhatsApp notifications).
 *
 * Any active user can ask the assignee of a sub-process for attention; the assignee answers once
 * and the reply goes back to the sender. Every query is scoped to the signed-in user; no action
 * accepts a user id. `isActive` is read from the DB on every call, not trusted from the token.
 */

const GENERIC_ERROR = 'No se pudo completar la operación'

type AuthResult = { authorized: true; userId: string } | { authorized: false; error: string }

async function requireActiveUser(): Promise<AuthResult> {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return { authorized: false, error: 'No autenticado' }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isActive: true } })
  if (!user?.isActive) return { authorized: false, error: 'Usuario inactivo' }

  return { authorized: true, userId }
}

function fail(error: string): { success: false; error: string } {
  return { success: false, error }
}

function subProcessPath(affiliationId: string, subProcessId: string): string {
  return `/dashboard/affiliations/${affiliationId}/subprocess/${subProcessId}`
}

function displayName(user: { name: string | null; email: string }): string {
  return user.name?.trim() || user.email
}

/** Sends an attention request to the current assignee of the sub-process. */
export async function sendAttentionRequest(
  input: SendAttentionRequestInput
): Promise<ActionResponse<{ id: string }>> {
  try {
    const authCheck = await requireActiveUser()
    if (!authCheck.authorized) return fail(authCheck.error)

    const parsed = sendAttentionRequestSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.errors[0]?.message ?? 'Datos inválidos')
    const { subProcessId, message } = parsed.data

    const subProcess = await prisma.affiliationSubProcess.findUnique({
      where: { id: subProcessId },
      select: { id: true, affiliationId: true, assignedToId: true, assignedTo: { select: { isActive: true } } },
    })
    if (!subProcess) return fail('Sub-proceso no encontrado')
    if (!subProcess.assignedToId || !subProcess.assignedTo) {
      return fail('Este sub-proceso no tiene responsable asignado')
    }
    if (!subProcess.assignedTo.isActive) return fail('El responsable de este sub-proceso está inactivo')
    if (subProcess.assignedToId === authCheck.userId) return fail('Eres el responsable de este sub-proceso')

    const created = await prisma.processAttentionRequest.create({
      data: { subProcessId, senderId: authCheck.userId, recipientId: subProcess.assignedToId, message },
      select: { id: true },
    })

    revalidatePath(subProcessPath(subProcess.affiliationId, subProcess.id))
    return { success: true, data: { id: created.id }, message: 'Solicitud enviada al responsable' }
  } catch (error) {
    console.error('sendAttentionRequest failed', error)
    return fail(GENERIC_ERROR)
  }
}

/** The recipient answers a request once; the reply shows up in the sender's bell. */
export async function replyAttentionRequest(input: ReplyAttentionRequestInput): Promise<ActionResponse> {
  try {
    const authCheck = await requireActiveUser()
    if (!authCheck.authorized) return fail(authCheck.error)

    const parsed = replyAttentionRequestSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.errors[0]?.message ?? 'Datos inválidos')
    const { id, reply } = parsed.data

    const request = await prisma.processAttentionRequest.findUnique({
      where: { id },
      select: { recipientId: true, reply: true, subProcess: { select: { id: true, affiliationId: true } } },
    })
    if (!request || request.recipientId !== authCheck.userId) return fail('Solicitud no encontrada')
    if (request.reply !== null) return fail('Esta solicitud ya fue respondida')

    const now = new Date()
    // Guarded on `reply: null` so two concurrent replies cannot both win.
    const updated = await prisma.processAttentionRequest.updateMany({
      where: { id, recipientId: authCheck.userId, reply: null },
      data: { reply, repliedAt: now, readAt: now },
    })
    if (updated.count === 0) return fail('Esta solicitud ya fue respondida')

    revalidatePath(subProcessPath(request.subProcess.affiliationId, request.subProcess.id))
    return { success: true, message: 'Respuesta enviada' }
  } catch (error) {
    console.error('replyAttentionRequest failed', error)
    return fail(GENERIC_ERROR)
  }
}

const feedSelect = {
  id: true,
  message: true,
  reply: true,
  repliedAt: true,
  readAt: true,
  replyReadAt: true,
  createdAt: true,
  sender: { select: { name: true, email: true } },
  recipient: { select: { name: true, email: true } },
  subProcess: {
    select: {
      id: true,
      type: true,
      affiliationId: true,
      affiliation: { select: { client: { select: { fullName: true } } } },
    },
  },
} as const

type FeedRow = {
  id: string
  message: string
  reply: string | null
  repliedAt: Date | null
  readAt: Date | null
  replyReadAt: Date | null
  createdAt: Date
  sender: { name: string | null; email: string }
  recipient: { name: string | null; email: string }
  subProcess: {
    id: string
    type: AffiliationSubProcessType
    affiliationId: string
    affiliation: { client: { fullName: string } }
  }
}

function toFeedItem(row: FeedRow, kind: AttentionFeedItem['kind']): AttentionFeedItem {
  const isRequest = kind === 'REQUEST'
  return {
    id: row.id,
    kind,
    read: isRequest ? row.readAt !== null : row.replyReadAt !== null,
    eventAt: isRequest ? row.createdAt : (row.repliedAt ?? row.createdAt),
    counterpartName: displayName(isRequest ? row.sender : row.recipient),
    subProcessLabel: `${SubProcessTypeLabels[row.subProcess.type]} · ${row.subProcess.affiliation.client.fullName}`,
    link: subProcessPath(row.subProcess.affiliationId, row.subProcess.id),
    message: row.message,
    reply: row.reply,
    canReply: isRequest && row.reply === null,
  }
}

/** Requests sent to me plus replies to my requests, newest first, with the unread total. */
export async function getAttentionFeed(): Promise<ActionResponse<AttentionFeed>> {
  try {
    const authCheck = await requireActiveUser()
    if (!authCheck.authorized) return fail(authCheck.error)
    const me = authCheck.userId

    const [received, answered, unreadReceived, unreadReplies] = await Promise.all([
      prisma.processAttentionRequest.findMany({
        where: { recipientId: me },
        orderBy: { createdAt: 'desc' },
        take: ATTENTION_FEED_SIZE,
        select: feedSelect,
      }),
      prisma.processAttentionRequest.findMany({
        where: { senderId: me, repliedAt: { not: null } },
        orderBy: { repliedAt: 'desc' },
        take: ATTENTION_FEED_SIZE,
        select: feedSelect,
      }),
      prisma.processAttentionRequest.count({ where: { recipientId: me, readAt: null } }),
      prisma.processAttentionRequest.count({ where: { senderId: me, repliedAt: { not: null }, replyReadAt: null } }),
    ])

    const items = [
      ...received.map((row) => toFeedItem(row, 'REQUEST')),
      ...answered.map((row) => toFeedItem(row, 'REPLY')),
    ]
      .sort((a, b) => b.eventAt.getTime() - a.eventAt.getTime())
      .slice(0, ATTENTION_FEED_SIZE)

    return { success: true, data: { unreadCount: unreadReceived + unreadReplies, items } }
  } catch (error) {
    console.error('getAttentionFeed failed', error)
    return fail(GENERIC_ERROR)
  }
}

/** Marks my side of one request as read: the request I received and/or the reply I got. */
export async function markAttentionRead(input: { id: string }): Promise<ActionResponse> {
  try {
    const authCheck = await requireActiveUser()
    if (!authCheck.authorized) return fail(authCheck.error)

    const parsed = markAttentionReadSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.errors[0]?.message ?? 'Datos inválidos')
    const { id } = parsed.data
    const now = new Date()

    await Promise.all([
      prisma.processAttentionRequest.updateMany({
        where: { id, recipientId: authCheck.userId, readAt: null },
        data: { readAt: now },
      }),
      prisma.processAttentionRequest.updateMany({
        where: { id, senderId: authCheck.userId, repliedAt: { not: null }, replyReadAt: null },
        data: { replyReadAt: now },
      }),
    ])
    return { success: true }
  } catch (error) {
    console.error('markAttentionRead failed', error)
    return fail(GENERIC_ERROR)
  }
}

export async function markAllAttentionRead(): Promise<ActionResponse> {
  try {
    const authCheck = await requireActiveUser()
    if (!authCheck.authorized) return fail(authCheck.error)
    const now = new Date()

    await Promise.all([
      prisma.processAttentionRequest.updateMany({
        where: { recipientId: authCheck.userId, readAt: null },
        data: { readAt: now },
      }),
      prisma.processAttentionRequest.updateMany({
        where: { senderId: authCheck.userId, repliedAt: { not: null }, replyReadAt: null },
        data: { replyReadAt: now },
      }),
    ])
    return { success: true }
  } catch (error) {
    console.error('markAllAttentionRead failed', error)
    return fail(GENERIC_ERROR)
  }
}

/** History of one sub-process for its detail page, newest first. */
export async function listSubProcessAttentionRequests(input: {
  subProcessId: string
}): Promise<ActionResponse<AttentionRequestView[]>> {
  try {
    const authCheck = await requireActiveUser()
    if (!authCheck.authorized) return fail(authCheck.error)

    const parsed = listSubProcessAttentionSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.errors[0]?.message ?? 'Datos inválidos')

    const rows = await prisma.processAttentionRequest.findMany({
      where: { subProcessId: parsed.data.subProcessId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        message: true,
        reply: true,
        createdAt: true,
        repliedAt: true,
        sender: { select: { name: true, email: true } },
        recipient: { select: { name: true, email: true } },
      },
    })

    return {
      success: true,
      data: rows.map((row) => ({
        id: row.id,
        senderName: displayName(row.sender),
        recipientName: displayName(row.recipient),
        message: row.message,
        reply: row.reply,
        status: row.reply === null ? 'PENDING' : 'ANSWERED',
        createdAt: row.createdAt,
        repliedAt: row.repliedAt,
      })),
    }
  } catch (error) {
    console.error('listSubProcessAttentionRequests failed', error)
    return fail(GENERIC_ERROR)
  }
}
