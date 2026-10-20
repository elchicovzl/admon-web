import type { IdentificationType, LeadStatus } from '@prisma/client'
import { formatPhone, parsePhone } from '@/lib/utils/phone'
import type { LeadListItem } from '@/lib/types/lead.types'

/** Longest note kept on a lead. */
export const LEAD_NOTES_MAX_LENGTH = 2000

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  NEW: 'Nuevo',
  CONTACTED: 'Contactado',
  CONVERTED: 'Convertido',
  DISCARDED: 'Descartado',
}

type LeadNameFields = Pick<LeadListItem, 'fullName' | 'displayName' | 'phoneE164'>

/** Collected name, else the WhatsApp profile name, else the phone. */
export function leadDisplayName(lead: LeadNameFields): string {
  return lead.fullName ?? lead.displayName ?? lead.phoneE164
}

export interface ClientDefaults {
  fullName: string
  phone: string
  email?: string
  identificationType?: IdentificationType
  identificationNumber?: string
}

/**
 * Values that prefill the regular client form when a lead is converted (S-LD-4). The phone goes
 * in the form's "+<code> <number>" format; only fields the lead actually has are set.
 */
export function leadToClientDefaults(
  lead: LeadNameFields & Pick<LeadListItem, 'email' | 'identificationType' | 'identificationNumber'>
): ClientDefaults {
  const { dialCode, national } = parsePhone(lead.phoneE164)
  return {
    fullName: lead.fullName ?? lead.displayName ?? '',
    phone: formatPhone(dialCode, national),
    ...(lead.email ? { email: lead.email } : {}),
    ...(lead.identificationType ? { identificationType: lead.identificationType } : {}),
    ...(lead.identificationNumber ? { identificationNumber: lead.identificationNumber } : {}),
  }
}
