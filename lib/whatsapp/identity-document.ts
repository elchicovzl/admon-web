import type { IdentificationType } from "@prisma/client"
import prisma from "@/lib/db/prisma"
import { ensureLead, findClientsByWaId, linkContactToClient } from "./contacts"

/**
 * Data the AI read from a photo of an identity document or a RUT (`recordIdentityDocument`).
 * It runs after the turn commits, never inside it, and it never overwrites what a person wrote:
 * - AMBIGUOUS contact (its phone matches several Clients): the document number picks the one
 *   Client among them, and the contact is linked to it (`linkContactToClient`);
 * - otherwise the contact's lead gets the data in its empty fields, plus a note saying it was
 *   extracted by the AI and must be verified.
 * A contact already linked to a Client is left alone.
 */

export const IDENTITY_DOCUMENT_TYPES = [
  "CEDULA",
  "CEDULA_EXTRANJERIA",
  "TARJETA_IDENTIDAD",
  "PASAPORTE",
  "PPT",
  "NIT",
] as const satisfies readonly IdentificationType[]

export interface IdentityDocument {
  documentType: (typeof IDENTITY_DOCUMENT_TYPES)[number]
  /** As printed on the document, e.g. "1.033.657.664" or "900.123.456-7". */
  number: string
  /** Person's full name; empty when the document does not show one. */
  fullName: string
  /** Razón social on a RUT; empty otherwise. */
  businessName: string
}

export type IdentityDocumentOutcome =
  | { status: "LINKED"; clientId: string }
  | { status: "LEAD_UPDATED"; leadId: string }
  | { status: "SKIPPED"; reason: "INVALID_NUMBER" | "CONTACT_NOT_FOUND" | "ALREADY_LINKED" | "LEAD_SUPPRESSED" | "NOTHING_NEW" }

/** Phone matches considered when the document resolves an ambiguous contact. */
const MAX_AMBIGUOUS_CANDIDATES = 20

const DOCUMENT_LABELS: Record<IdentityDocument["documentType"], string> = {
  CEDULA: "la cédula",
  CEDULA_EXTRANJERIA: "la cédula de extranjería",
  TARJETA_IDENTIDAD: "la tarjeta de identidad",
  PASAPORTE: "el pasaporte",
  PPT: "el PPT",
  NIT: "el RUT",
}

const normalize = (value: string) => value.toUpperCase().replace(/[^0-9A-Z]/g, "")
/** A NIT without its check digit: "900.123.456-7" → "900123456". */
const withoutCheckDigit = (value: string) => normalize(value.replace(/-\s*\d\s*$/, ""))

/** Same document number, ignoring dots, spaces, dashes and a NIT's check digit. */
export function documentNumbersMatch(stored: string, extracted: string): boolean {
  return normalize(stored) === normalize(extracted) || withoutCheckDigit(stored) === withoutCheckDigit(extracted)
}

export async function applyIdentityDocument(input: {
  contactId: string
  conversationId: string
  document: IdentityDocument
  now?: Date
}): Promise<IdentityDocumentOutcome> {
  const { document } = input
  const normalized = normalize(document.number)
  if (normalized.length < 5 || normalized.length > 20) return { status: "SKIPPED", reason: "INVALID_NUMBER" }

  const contact = await prisma.whatsAppContact.findUnique({
    where: { id: input.contactId },
    select: { id: true, waId: true, profileName: true, clientId: true, matchStatus: true, matchLocked: true, leadSuppressed: true },
  })
  if (!contact) return { status: "SKIPPED", reason: "CONTACT_NOT_FOUND" }
  if (contact.clientId) return { status: "SKIPPED", reason: "ALREADY_LINKED" }

  if (contact.matchStatus === "AMBIGUOUS" && !contact.matchLocked) {
    const ids = await findClientsByWaId(contact.waId, MAX_AMBIGUOUS_CANDIDATES)
    const candidates = ids.length
      ? await prisma.client.findMany({ where: { id: { in: ids } }, select: { id: true, identificationNumber: true } })
      : []
    const matches = candidates.filter((client) => documentNumbersMatch(client.identificationNumber, document.number))
    if (matches.length === 1) {
      const linked = await linkContactToClient(contact.id, matches[0].id)
      if (linked.ok) return { status: "LINKED", clientId: matches[0].id }
    }
  }

  const ensured = await ensureLead(contact, input.conversationId)
  if (!ensured.lead) return { status: "SKIPPED", reason: "LEAD_SUPPRESSED" }
  const lead = ensured.lead

  const name = (document.documentType === "NIT" ? document.businessName || document.fullName : document.fullName).trim()
  const data: { fullName?: string; identificationType?: IdentificationType; identificationNumber?: string; notes?: string } = {}
  if (!lead.fullName && name) data.fullName = name
  // Type and number travel together, so an empty number never ends up next to another document's type.
  if (!lead.identificationNumber) {
    data.identificationNumber = document.number.trim()
    data.identificationType = document.documentType
  }

  const line = noteLine(document, input.now ?? new Date())
  if (!(lead.notes ?? "").includes(line)) data.notes = lead.notes ? `${lead.notes}\n${line}` : line

  if (Object.keys(data).length === 0) return { status: "SKIPPED", reason: "NOTHING_NEW" }
  await prisma.lead.update({ where: { id: lead.id }, data })
  return { status: "LEAD_UPDATED", leadId: lead.id }
}

function noteLine(document: IdentityDocument, now: Date): string {
  const date = now.toLocaleDateString("es-CO", { timeZone: "America/Bogota", day: "2-digit", month: "2-digit", year: "numeric" })
  const details =
    document.documentType === "NIT"
      ? [document.businessName && `razón social ${document.businessName.trim()}`, `NIT ${document.number.trim()}`]
      : [document.fullName.trim(), `${document.documentType} ${document.number.trim()}`]
  return `Extraído por IA de una foto de ${DOCUMENT_LABELS[document.documentType]} (${date}): ${details.filter(Boolean).join(", ")}. Pendiente de verificar.`
}
