import { Prisma, type Lead, type WhatsAppContact } from "@prisma/client"
import prisma from "@/lib/db/prisma"
import { getNotifyPort } from "@/lib/notifications/port"
import { normalizeWaId, waIdMatchCandidates, waIdToE164 } from "@/lib/utils/phone"
import { isUniqueViolation } from "./utils"

export type ContactMatch =
  | { status: "MATCHED"; clientId: string }
  | { status: "AMBIGUOUS" }
  | { status: "UNMATCHED" }

/**
 * Finds active, non-deleted Clients whose free-form phone reduces to one of the
 * candidate digit strings. The comparison happens in SQL so Client.phone is never
 * rewritten (WC-9). Two rows are enough to know the match is ambiguous.
 */
export async function findClientsByWaId(waId: string): Promise<string[]> {
  const candidates = waIdMatchCandidates(waId)
  if (candidates.length === 0) return []
  const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT id FROM clients
    WHERE "isActive" = true
      AND status <> 'ELIMINADO'
      AND regexp_replace(phone, '\\D', '', 'g') IN (${Prisma.join(candidates)})
    LIMIT 2
  `)
  return rows.map((row) => row.id)
}

export async function matchClient(waId: string): Promise<ContactMatch> {
  const ids = await findClientsByWaId(waId)
  if (ids.length === 1) return { status: "MATCHED", clientId: ids[0] }
  if (ids.length > 1) return { status: "AMBIGUOUS" }
  return { status: "UNMATCHED" }
}

/**
 * Creates or refreshes the contact for a wa_id, then resolves its Client link:
 * - a manual link/unlink (`matchLocked`) or an existing link is never touched;
 * - exactly one Client: link and MATCHED;
 * - several Clients: AMBIGUOUS, no auto-link (flagged for a manager, LD-8);
 * - none: UNMATCHED.
 */
export async function upsertAndMatchContact(input: {
  waId: string
  profileName?: string | null
  seenAt: Date
}): Promise<WhatsAppContact> {
  const waId = normalizeWaId(input.waId)
  if (!waId) throw new Error("Invalid WhatsApp id")

  const profileName = input.profileName?.trim() || undefined
  const contact = await prisma.whatsAppContact.upsert({
    where: { waId },
    create: { waId, profileName: profileName ?? null, lastSeenAt: input.seenAt },
    update: { ...(profileName ? { profileName } : {}), lastSeenAt: input.seenAt },
  })

  if (contact.matchLocked || contact.clientId) return contact

  const match = await matchClient(waId)
  if (match.status === "MATCHED") {
    return prisma.whatsAppContact.update({
      where: { id: contact.id },
      data: { clientId: match.clientId, matchStatus: "MATCHED" },
    })
  }
  if (match.status !== contact.matchStatus) {
    return prisma.whatsAppContact.update({
      where: { id: contact.id },
      data: { matchStatus: match.status },
    })
  }
  return contact
}

export interface EnsureLeadResult {
  lead: Lead
  created: boolean
}

/**
 * Idempotent: exactly one Lead per contact (unique contactId). A concurrent first message
 * that loses the race re-reads the winner's row (S-LD-3). The NEW_LEAD notification fires
 * only for the call that actually created the lead, and a notifier failure never undoes it.
 */
export async function ensureLead(
  contact: Pick<WhatsAppContact, "id" | "waId" | "profileName">,
  conversationId?: string | null
): Promise<EnsureLeadResult> {
  const existing = await prisma.lead.findUnique({ where: { contactId: contact.id } })
  if (existing) return { lead: existing, created: false }

  let lead: Lead
  try {
    lead = await prisma.lead.create({
      data: {
        contactId: contact.id,
        source: "WHATSAPP",
        status: "NEW",
        phoneE164: waIdToE164(contact.waId),
        displayName: contact.profileName ?? null,
        conversationId: conversationId ?? null,
      },
    })
  } catch (error) {
    if (!isUniqueViolation(error)) throw error
    const winner = await prisma.lead.findUnique({ where: { contactId: contact.id } })
    if (!winner) throw error
    return { lead: winner, created: false }
  }

  try {
    await getNotifyPort().notify({
      type: "NEW_LEAD",
      leadId: lead.id,
      contactId: contact.id,
      conversationId: lead.conversationId,
    })
  } catch {
    console.error("[whatsapp] NEW_LEAD notification failed")
  }
  return { lead, created: true }
}

/**
 * A manager confirms an AMBIGUOUS number belongs to nobody on file (LD-8). The contact is
 * locked as UNMATCHED so the next inbound does not flip it back to ambiguous, and the
 * lead that was withheld is created now.
 */
export async function confirmContactAsUnknown(
  contactId: string,
  conversationId?: string | null
): Promise<EnsureLeadResult> {
  const contact = await prisma.whatsAppContact.update({
    where: { id: contactId },
    data: { matchStatus: "UNMATCHED", matchLocked: true, clientId: null },
  })
  return ensureLead(contact, conversationId)
}

const LEAD_RECOVERY_BATCH = 50

/**
 * Recovery for a swallowed `ensureLead` failure (LD-2 lets lead creation fail without
 * blocking the message). The failure leaves a recognizable shape: an UNMATCHED contact
 * that has a conversation but no lead. `confirmContactAsUnknown` and every inbound
 * create the lead immediately, and AMBIGUOUS contacts are excluded on purpose (LD-8), so
 * anything matching this query is a lead that should exist. Idempotent: `ensureLead`
 * never duplicates. Runs from the `wa.event.sweep` cron; one failure does not stop the
 * rest. Returns how many leads were created.
 */
export async function recoverMissingLeads(limit: number = LEAD_RECOVERY_BATCH): Promise<number> {
  const orphans = await prisma.whatsAppContact.findMany({
    where: { matchStatus: "UNMATCHED", lead: null, conversation: { isNot: null } },
    select: { id: true, waId: true, profileName: true, conversation: { select: { id: true } } },
    orderBy: { createdAt: "asc" },
    take: limit,
  })

  let created = 0
  for (const contact of orphans) {
    try {
      const result = await ensureLead(contact, contact.conversation?.id)
      if (result.created) created++
    } catch {
      console.error("[whatsapp] lead recovery failed; will retry on the next sweep")
    }
  }
  return created
}
