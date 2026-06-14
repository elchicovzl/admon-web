import type {
  ClientType,
  IdentificationType,
  AffiliationStatus,
  AffiliationProcessType,
  AffiliationSubProcessType,
  AffiliationSubProcessStatus,
  AffiliationDocumentCategory,
} from '@prisma/client'
import type { ClientWithRelations } from './client.types'

/**
 * Row in the histórico list (one per client, INCLUDING soft-deleted ones).
 * isDeleted is derived from status === 'ELIMINADO' in the server action.
 */
export interface ClientHistoryListItem {
  id: string
  fullName: string
  identificationType: IdentificationType
  identificationNumber: string
  clientType: ClientType
  email: string
  phone: string
  status: string
  isActive: boolean
  isDeleted: boolean
  createdAt: Date
  updatedAt: Date
  company?: {
    id: string
    fullName: string
  } | null
  affiliationsCount: number
  documentsCount: number
}

// ========================================
// AFFILIATION SLICE (read-only, for histórico)
// ========================================

export interface HistoryStatusLog {
  id: string
  fromStatus: AffiliationSubProcessStatus | null
  toStatus: AffiliationSubProcessStatus
  reason: string | null
  createdAt: Date
  changedBy?: { name: string | null; email: string } | null
}

export interface HistoryObservation {
  id: string
  content: string
  createdAt: Date
  createdBy?: { name: string | null; email: string } | null
}

export interface HistoryAffiliationDocument {
  id: string
  fileName: string
  fileUrl: string
  fileType: string
  fileSize: number
  category: AffiliationDocumentCategory
  createdAt: Date
  uploadedBy?: { name: string | null; email: string } | null
}

export interface HistorySubProcess {
  id: string
  type: AffiliationSubProcessType
  status: AffiliationSubProcessStatus
  createdAt: Date
  assignedTo?: { name: string | null; email: string } | null
  employee?: { id: string; fullName: string } | null
  // Disability-specific fields (only meaningful when type = INCAPACIDADES)
  disabilityStartDate: Date | null
  disabilityEndDate: Date | null
  bankRegistry: boolean
  transcription: boolean
  collection: boolean
  paidToUser: boolean
  documents: HistoryAffiliationDocument[]
  observations: HistoryObservation[]
  statusLogs: HistoryStatusLog[]
}

export interface HistorySentEmail {
  id: string
  toEmail: string
  subject: string
  sentAt: Date
  sentBy?: { name: string | null; email: string } | null
}

export interface HistoryAffiliation {
  id: string
  affiliationNumber: string
  processType: AffiliationProcessType | null
  processTypeOther: string | null
  status: AffiliationStatus
  startDate: Date | null
  sentAt: Date | null
  archivedAt: Date | null
  createdAt: Date
  note: string | null
  createdBy?: { name: string | null; email: string } | null
  subProcesses: HistorySubProcess[]
  sentEmails: HistorySentEmail[]
}

// ========================================
// TIMELINE (unified activity feed)
// ========================================

export type TimelineEventType =
  | 'client_created'
  | 'client_note'
  | 'client_document'
  | 'affiliation_created'
  | 'subprocess_status'
  | 'affiliation_document'
  | 'affiliation_observation'
  | 'affiliation_email'
  | 'affiliation_archived'

export type TimelineVariant = 'default' | 'success' | 'info' | 'warning' | 'muted'

export interface TimelineEvent {
  id: string
  type: TimelineEventType
  date: Date
  title: string
  description?: string | null
  /** Display name of the user who performed the action */
  actor?: string | null
  /** Affiliation number when the event belongs to a process */
  affiliationNumber?: string | null
  variant: TimelineVariant
}

// ========================================
// FULL DETAIL (everything about one client)
// ========================================

export interface ClientHistoryDetail {
  client: ClientWithRelations
  isDeleted: boolean
  affiliations: HistoryAffiliation[]
  timeline: TimelineEvent[]
}
