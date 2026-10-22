import { Prisma, type Lead, type WhatsAppContact } from "@prisma/client"
import prisma from "@/lib/db/prisma"
import { getNotifyPort } from "@/lib/notifications/port"
import { DEFAULT_PHONE_COUNTRY, normalizeWaId, waIdMatchCandidates, waIdToE164 } from "@/lib/utils/phone"
import { isUniqueViolation } from "./utils"

export type ContactMatch =
  | { status: "MATCHED"; clientId: string }
  | { status: "AMBIGUOUS" }
  | { status: "UNMATCHED" }

/**
 * Finds active, non-deleted Clients whose free-form phone reduces to one of the
 * candidate digit strings. The comparison happens in SQL so Client.phone is never
 * rewritten (WC-9). Two rows are enough to know the match is ambiguous; a caller that needs
 * the candidates themselves (resolving an ambiguous contact) asks for more.
 */
export async function findClientsByWaId(waId: string, limit = 2): Promise<string[]> {
  const candidates = waIdMatchCandidates(waId)
  if (candidates.length === 0) return []
  const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT id FROM clients
    WHERE "isActive" = true
      AND status <> 'ELIMINADO'
      AND regexp_replace(phone, '\\D', '', 'g') IN (${Prisma.join(candidates)})
    LIMIT ${Prisma.raw(String(Math.max(1, Math.trunc(limit))))}
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

export type EnsureLeadResult =
  | { lead: Lead; created: boolean }
  /** The lead was removed on purpose (`removeLead`); nothing is recreated. */
  | { lead: null; created: false; suppressed: true }

type LeadContact = Pick<WhatsAppContact, "id" | "waId" | "profileName"> & { leadSuppressed?: boolean }

/**
 * Idempotent: exactly one Lead per contact (unique contactId). A concurrent first message
 * that loses the race re-reads the winner's row (S-LD-3). The NEW_LEAD notification fires
 * only for the call that actually created the lead, and a notifier failure never undoes it.
 * A contact whose lead was removed on purpose (`leadSuppressed`) never gets a new one here;
 * only `confirmContactAsUnknown` (an explicit manager decision) lifts that.
 */
export async function ensureLead(contact: LeadContact, conversationId?: string | null): Promise<EnsureLeadResult> {
  if (contact.leadSuppressed) return { lead: null, created: false, suppressed: true }
  return createLeadOnce(contact, conversationId)
}

async function createLeadOnce(
  contact: LeadContact,
  conversationId?: string | null
): Promise<{ lead: Lead; created: boolean }> {
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
 * Deletes the contact's lead on purpose and remembers it, so neither the next inbound nor the
 * recovery sweep recreates it. Use this (not a bare `lead.delete`) whenever a person removes a
 * lead. A DISCARDED lead needs no flag: its row still exists, so it is never "missing".
 */
export async function removeLead(contactId: string): Promise<void> {
  await prisma.$transaction([
    prisma.lead.deleteMany({ where: { contactId } }),
    prisma.whatsAppContact.update({ where: { id: contactId }, data: { leadSuppressed: true } }),
  ])
}

/**
 * A manager confirms an AMBIGUOUS number belongs to nobody on file (LD-8). The contact is
 * locked as UNMATCHED so the next inbound does not flip it back to ambiguous, and the
 * lead that was withheld is created now.
 */
export async function confirmContactAsUnknown(
  contactId: string,
  conversationId?: string | null
): Promise<{ lead: Lead; created: boolean }> {
  const contact = await prisma.whatsAppContact.update({
    where: { id: contactId },
    // An explicit confirmation overrides an earlier deliberate removal of the lead.
    data: { matchStatus: "UNMATCHED", matchLocked: true, clientId: null, leadSuppressed: false },
  })
  return createLeadOnce(contact, conversationId)
}

export type LinkContactOutcome = { ok: true } | { ok: false; code: "CLIENT_NOT_FOUND" }

/**
 * A manager links a contact to a Client by hand (LD-5): MANUAL and locked, so automatic
 * matching never overrides it, and the contact's lead (if any) is converted to that Client.
 * Only active, non-deleted Clients qualify, the same rule automatic matching uses.
 */
export async function linkContactToClient(contactId: string, clientId: string): Promise<LinkContactOutcome> {
  const client = await prisma.client.findFirst({
    where: { id: clientId, isActive: true, status: { not: "ELIMINADO" } },
    select: { id: true },
  })
  if (!client) return { ok: false, code: "CLIENT_NOT_FOUND" }

  await prisma.$transaction([
    prisma.whatsAppContact.update({
      where: { id: contactId },
      data: { clientId, matchStatus: "MANUAL", matchLocked: true },
    }),
    prisma.lead.updateMany({ where: { contactId }, data: { status: "CONVERTED", convertedClientId: clientId } }),
  ])
  return { ok: true }
}

/**
 * A manager says the number does not belong to its linked Client. The contact is locked as
 * UNMATCHED (automatic matching would relink it otherwise), a lead converted through that link
 * goes back to NEW, and a contact without a lead gets one: an explicit decision, so it also
 * lifts an earlier deliberate removal, like `confirmContactAsUnknown`. The three writes are not one
 * transaction (lead creation notifies, and a notifier must never run inside one), but each is
 * idempotent, so repeating the action after a partial failure converges to the same state.
 */
export async function unlinkContactFromClient(
  contactId: string,
  conversationId?: string | null
): Promise<{ lead: Lead; created: boolean }> {
  const contact = await prisma.whatsAppContact.update({
    where: { id: contactId },
    data: { clientId: null, matchStatus: "UNMATCHED", matchLocked: true, leadSuppressed: false },
  })
  await prisma.lead.updateMany({
    where: { contactId, status: "CONVERTED" },
    data: { status: "NEW", convertedClientId: null },
  })
  return createLeadOnce(contact, conversationId)
}

export interface AutoLinkResult {
  linked: number
  ambiguous: number
}

/**
 * wa_ids a free-form `Client.phone` may belong to: its digits, plus the default country code when
 * the phone was stored without one (the reverse of `waIdMatchCandidates`).
 */
function waIdsForClientPhone(phone: string): string[] {
  const digits = normalizeWaId(phone)
  if (!digits) return []
  const { dialCode } = DEFAULT_PHONE_COUNTRY
  if (digits.startsWith(dialCode)) return [digits]
  const withCode = normalizeWaId(`${dialCode}${digits}`)
  return withCode ? [digits, withCode] : [digits]
}

/**
 * Best-effort hook after a client is created or its phone changes (LD-5, PR1.6): WhatsApp
 * contacts already waiting under that number get linked. Each contact goes through
 * `matchClient`, the same rule inbound uses, so a number shared by several clients is flagged
 * AMBIGUOUS instead of linked. Manual decisions (`matchLocked`) and existing links are never
 * touched. Never throws: a failure here must not fail the client action that called it.
 */
export async function autoLinkContactsForClient(clientId: string): Promise<AutoLinkResult> {
  const result: AutoLinkResult = { linked: 0, ambiguous: 0 }
  try {
    const client = await prisma.client.findFirst({
      where: { id: clientId, isActive: true, status: { not: "ELIMINADO" } },
      select: { id: true, phone: true },
    })
    const waIds = client ? waIdsForClientPhone(client.phone) : []
    if (waIds.length === 0) return result

    const contacts = await prisma.whatsAppContact.findMany({
      where: { waId: { in: waIds }, matchLocked: false, clientId: null },
      select: { id: true, waId: true, matchStatus: true },
    })

    for (const contact of contacts) {
      try {
        const match = await matchClient(contact.waId)
        if (match.status === "MATCHED" && match.clientId === clientId) {
          await prisma.$transaction([
            prisma.whatsAppContact.update({
              where: { id: contact.id },
              data: { clientId, matchStatus: "MATCHED" },
            }),
            prisma.lead.updateMany({
              where: { contactId: contact.id },
              data: { status: "CONVERTED", convertedClientId: clientId },
            }),
            // Pollers merge by updatedAt; the inbox markers must refresh.
            prisma.conversation.updateMany({ where: { contactId: contact.id }, data: { updatedAt: new Date() } }),
          ])
          result.linked++
        } else if (match.status === "AMBIGUOUS" && contact.matchStatus !== "AMBIGUOUS") {
          await prisma.whatsAppContact.update({ where: { id: contact.id }, data: { matchStatus: "AMBIGUOUS" } })
          result.ambiguous++
        }
      } catch {
        console.error("[whatsapp] auto-link failed for one contact; it stays as it was")
      }
    }
  } catch {
    console.error("[whatsapp] auto-link failed; contacts stay as they were")
  }
  return result
}

const LEAD_RECOVERY_BATCH = 50
/** A contact that fails this many sweeps stops being retried (needs a person; see the warning). */
export const LEAD_RECOVERY_MAX_ATTEMPTS = 5
/** Minimum wait between two recovery attempts for the same contact. */
export const LEAD_RECOVERY_COOLDOWN_MS = 15 * 60 * 1000

/**
 * Recovery for a swallowed `ensureLead` failure (LD-2 lets lead creation fail without
 * blocking the message). The failure leaves a recognizable shape: an UNMATCHED contact
 * that has a conversation but no lead. `confirmContactAsUnknown` and every inbound
 * create the lead immediately, and AMBIGUOUS contacts are excluded on purpose (LD-8), so
 * anything matching this query is a lead that should exist. Idempotent: `ensureLead`
 * never duplicates. Runs from the `wa.event.sweep` cron; one failure does not stop the
 * rest. Returns how many leads were created.
 *
 * Starvation guard: each failed attempt bumps `leadRecoveryAttempts` and stamps
 * `leadRecoveryAt`; a contact is retried only after the cooldown and at most
 * LEAD_RECOVERY_MAX_ATTEMPTS times, and never-tried contacts go first, so permanently failing
 * contacts cannot occupy the whole batch and block healthy ones.
 *
 * Deliberate removals are respected: `leadSuppressed` contacts are skipped, and a DISCARDED
 * lead still has its row, so `lead: null` never matches it.
 */
export async function recoverMissingLeads(
  limit: number = LEAD_RECOVERY_BATCH,
  now: Date = new Date()
): Promise<number> {
  const retryBefore = new Date(now.getTime() - LEAD_RECOVERY_COOLDOWN_MS)
  const orphans = await prisma.whatsAppContact.findMany({
    where: {
      matchStatus: "UNMATCHED",
      leadSuppressed: false,
      lead: null,
      conversation: { isNot: null },
      leadRecoveryAttempts: { lt: LEAD_RECOVERY_MAX_ATTEMPTS },
      OR: [{ leadRecoveryAt: null }, { leadRecoveryAt: { lt: retryBefore } }],
    },
    select: { id: true, waId: true, profileName: true, leadSuppressed: true, conversation: { select: { id: true } } },
    orderBy: [{ leadRecoveryAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
    take: limit,
  })

  let created = 0
  for (const contact of orphans) {
    try {
      const result = await ensureLead(contact, contact.conversation?.id)
      if (result.created) created++
    } catch {
      console.error("[whatsapp] lead recovery failed; will retry after the cooldown")
      await recordRecoveryFailure(contact.id, now)
    }
  }
  return created
}

async function recordRecoveryFailure(contactId: string, now: Date): Promise<void> {
  try {
    const { leadRecoveryAttempts } = await prisma.whatsAppContact.update({
      where: { id: contactId },
      data: { leadRecoveryAttempts: { increment: 1 }, leadRecoveryAt: now },
      select: { leadRecoveryAttempts: true },
    })
    if (leadRecoveryAttempts >= LEAD_RECOVERY_MAX_ATTEMPTS) {
      console.warn(`[whatsapp] lead recovery gave up on contact ${contactId} after ${leadRecoveryAttempts} attempts`)
    }
  } catch {
    console.error("[whatsapp] could not record a lead recovery failure")
  }
}
