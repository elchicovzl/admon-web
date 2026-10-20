'use server'

import type { Prisma } from '@prisma/client'
import prisma from '@/lib/db/prisma'
import type { ActionResponse } from '@/lib/types/auth.types'
import type { LeadListItem, LeadListPage } from '@/lib/types/lead.types'
import { requireWhatsAppAuth } from '@/lib/whatsapp/access'
import { linkContactToClient, removeLead } from '@/lib/whatsapp/contacts'
import {
  convertLeadSchema,
  leadActionSchema,
  listLeadsSchema,
  setLeadStatusSchema,
  updateLeadSchema,
  type ConvertLeadInput,
  type LeadActionInput,
  type ListLeadsInput,
  type SetLeadStatusInput,
  type UpdateLeadInput,
} from '@/lib/validations/lead.schema'

/**
 * Leads are people who wrote on WhatsApp and are not clients yet (LD-3, LD-4). They belong to
 * the WhatsApp module, so every action uses the module's access check (`requireWhatsAppAuth`).
 */

const GENERIC_ERROR = 'No se pudo completar la operación'
const NOT_FOUND = 'Lead no encontrado'

const leadSelect = {
  id: true,
  contactId: true,
  status: true,
  source: true,
  phoneE164: true,
  displayName: true,
  fullName: true,
  identificationType: true,
  identificationNumber: true,
  email: true,
  notes: true,
  conversationId: true,
  convertedClient: { select: { id: true, fullName: true } },
  createdAt: true,
  updatedAt: true,
} as const

type LeadRow = Prisma.LeadGetPayload<{ select: typeof leadSelect }>

function toListItem(row: LeadRow): LeadListItem {
  return {
    id: row.id,
    status: row.status,
    source: row.source,
    phoneE164: row.phoneE164,
    displayName: row.displayName,
    fullName: row.fullName,
    identificationType: row.identificationType,
    identificationNumber: row.identificationNumber,
    email: row.email,
    notes: row.notes,
    conversationId: row.conversationId,
    convertedClient: row.convertedClient,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function validationError(issues: { message: string }[]): { success: false; error: string } {
  return { success: false, error: issues[0]?.message ?? 'Datos inválidos' }
}

export async function listLeads(input: ListLeadsInput = {}): Promise<ActionResponse<LeadListPage>> {
  try {
    const authCheck = await requireWhatsAppAuth()
    if (!authCheck.authorized) return { success: false, error: authCheck.error }

    const parsed = listLeadsSchema.safeParse(input)
    if (!parsed.success) return validationError(parsed.error.issues)
    const { status, q, limit, cursor } = parsed.data

    const digits = q?.replace(/\D/g, '') ?? ''
    const where: Prisma.LeadWhereInput = {
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { displayName: { contains: q, mode: 'insensitive' } },
              { fullName: { contains: q, mode: 'insensitive' } },
              ...(digits ? [{ phoneE164: { contains: digits } }] : []),
            ],
          }
        : {}),
    }

    const rows = await prisma.lead.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: leadSelect,
    })
    const hasMore = rows.length > limit
    const page = hasMore ? rows.slice(0, limit) : rows

    return {
      success: true,
      data: { items: page.map(toListItem), nextCursor: hasMore ? page[page.length - 1].id : null },
    }
  } catch {
    console.error('[leads] listLeads failed')
    return { success: false, error: GENERIC_ERROR }
  }
}

/** Contact details a manager gathers before converting (name, document, email, notes). */
export async function updateLead(input: UpdateLeadInput): Promise<ActionResponse<LeadListItem>> {
  try {
    const authCheck = await requireWhatsAppAuth()
    if (!authCheck.authorized) return { success: false, error: authCheck.error }

    const parsed = updateLeadSchema.safeParse(input)
    if (!parsed.success) return validationError(parsed.error.issues)
    const { leadId, ...data } = parsed.data

    const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true } })
    if (!lead) return { success: false, error: NOT_FOUND }

    const updated = await prisma.lead.update({ where: { id: leadId }, data, select: leadSelect })
    return { success: true, data: toListItem(updated) }
  } catch {
    console.error('[leads] updateLead failed')
    return { success: false, error: GENERIC_ERROR }
  }
}

/** NEW / CONTACTED / DISCARDED. A converted lead is only reverted by unlinking its contact. */
export async function setLeadStatus(input: SetLeadStatusInput): Promise<ActionResponse<LeadListItem>> {
  try {
    const authCheck = await requireWhatsAppAuth()
    if (!authCheck.authorized) return { success: false, error: authCheck.error }

    const parsed = setLeadStatusSchema.safeParse(input)
    if (!parsed.success) return validationError(parsed.error.issues)
    const { leadId, status } = parsed.data

    const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { status: true } })
    if (!lead) return { success: false, error: NOT_FOUND }
    if (lead.status === 'CONVERTED') {
      return {
        success: false,
        error: 'El lead ya es cliente. Para revertirlo, desvincule el contacto desde la conversación.',
      }
    }

    const updated = await prisma.lead.update({ where: { id: leadId }, data: { status }, select: leadSelect })
    return { success: true, data: toListItem(updated) }
  } catch {
    console.error('[leads] setLeadStatus failed')
    return { success: false, error: GENERIC_ERROR }
  }
}

/**
 * Conversion (S-LD-4): the client is created first with the regular client form (prefilled from
 * the lead); this links the lead's WhatsApp contact to it, which also marks the lead CONVERTED.
 * The conversation is bumped so the inbox markers refresh on the next poll.
 */
export async function convertLead(input: ConvertLeadInput): Promise<ActionResponse<LeadListItem>> {
  try {
    const authCheck = await requireWhatsAppAuth()
    if (!authCheck.authorized) return { success: false, error: authCheck.error }

    const parsed = convertLeadSchema.safeParse(input)
    if (!parsed.success) return validationError(parsed.error.issues)
    const { leadId, clientId } = parsed.data

    const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: leadSelect })
    if (!lead) return { success: false, error: NOT_FOUND }
    if (lead.status === 'CONVERTED') return { success: false, error: 'El lead ya fue convertido en cliente' }

    const outcome = await linkContactToClient(lead.contactId, clientId)
    if (!outcome.ok) return { success: false, error: 'Cliente no encontrado' }

    await prisma.conversation.updateMany({ where: { contactId: lead.contactId }, data: { updatedAt: new Date() } })
    const converted = await prisma.lead.findUnique({ where: { id: leadId }, select: leadSelect })
    if (!converted) return { success: false, error: NOT_FOUND }
    return { success: true, data: toListItem(converted) }
  } catch {
    console.error('[leads] convertLead failed')
    return { success: false, error: GENERIC_ERROR }
  }
}

/** Deletes the lead for good: `removeLead` keeps inbound and recovery from recreating it. */
export async function deleteLead(input: LeadActionInput): Promise<ActionResponse<{ id: string }>> {
  try {
    const authCheck = await requireWhatsAppAuth()
    if (!authCheck.authorized) return { success: false, error: authCheck.error }

    const parsed = leadActionSchema.safeParse(input)
    if (!parsed.success) return validationError(parsed.error.issues)
    const { leadId } = parsed.data

    const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { contactId: true } })
    if (!lead) return { success: false, error: NOT_FOUND }

    await removeLead(lead.contactId)
    return { success: true, data: { id: leadId } }
  } catch {
    console.error('[leads] deleteLead failed')
    return { success: false, error: GENERIC_ERROR }
  }
}
