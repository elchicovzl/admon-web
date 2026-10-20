import type { IdentificationType, LeadSource, LeadStatus } from '@prisma/client'

/** A lead as the leads page shows it. Dates are ISO strings so the shape crosses the server boundary. */
export interface LeadListItem {
  id: string
  status: LeadStatus
  source: LeadSource
  phoneE164: string
  /** WhatsApp profile name captured on first contact. */
  displayName: string | null
  fullName: string | null
  identificationType: IdentificationType | null
  identificationNumber: string | null
  email: string | null
  notes: string | null
  conversationId: string | null
  convertedClient: { id: string; fullName: string } | null
  createdAt: string
  updatedAt: string
}

export interface LeadListPage {
  items: LeadListItem[]
  /** Pass back as `cursor` for the next page; null when exhausted. */
  nextCursor: string | null
}
