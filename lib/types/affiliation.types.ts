/**
 * TypeScript types for Affiliation Module
 * Afiliaciones a Seguridad Social
 */

import {
  AffiliationSubProcessType,
  AffiliationSubProcessStatus,
  AffiliationDocumentCategory,
} from '@prisma/client'

// ========================================
// BASE TYPES (from database)
// ========================================

export interface Affiliation {
  id: string
  clientId: string
  createdById: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface AffiliationSubProcess {
  id: string
  affiliationId: string
  type: AffiliationSubProcessType
  status: AffiliationSubProcessStatus
  assignedToId: string | null
  statusReason: string | null
  createdAt: Date
  updatedAt: Date
}

export interface AffiliationDocument {
  id: string
  subProcessId: string
  fileName: string
  fileUrl: string
  fileType: string
  fileSize: number
  s3Key: string
  category: AffiliationDocumentCategory
  uploadedById: string
  createdAt: Date
}

export interface AffiliationObservation {
  id: string
  content: string
  subProcessId: string
  createdById: string
  createdAt: Date
  updatedAt: Date
}

export interface AffiliationStatusLog {
  id: string
  subProcessId: string
  fromStatus: AffiliationSubProcessStatus | null
  toStatus: AffiliationSubProcessStatus
  reason: string | null
  changedById: string
  createdAt: Date
}

// ========================================
// SAFE TYPES (without sensitive fields)
// ========================================

export interface SafeAffiliation {
  id: string
  clientId: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface SafeAffiliationSubProcess {
  id: string
  affiliationId: string
  type: AffiliationSubProcessType
  status: AffiliationSubProcessStatus
  assignedToId: string | null
  statusReason: string | null
  createdAt: Date
  updatedAt: Date
}

export interface SafeAffiliationDocument {
  id: string
  subProcessId: string
  fileName: string
  fileUrl: string
  fileType: string
  fileSize: number
  s3Key: string
  category: AffiliationDocumentCategory
  createdAt: Date
}

export interface SafeAffiliationObservation {
  id: string
  content: string
  subProcessId: string
  createdAt: Date
  updatedAt: Date
}

export interface SafeAffiliationStatusLog {
  id: string
  subProcessId: string
  fromStatus: AffiliationSubProcessStatus | null
  toStatus: AffiliationSubProcessStatus
  reason: string | null
  createdAt: Date
}

// ========================================
// TYPES WITH RELATIONS (for detail views)
// ========================================

export interface AffiliationWithRelations extends SafeAffiliation {
  client?: {
    id: string
    fullName: string
    email: string
    phone: string
    identificationType: string
    identificationNumber: string
    clientType: string
  }
  subProcesses?: AffiliationSubProcessWithRelations[]
  createdBy?: {
    id: string
    name: string | null
    email: string
  }
}

export interface AffiliationSubProcessWithRelations extends SafeAffiliationSubProcess {
  affiliation?: {
    id: string
    clientId: string
  }
  assignedTo?: {
    id: string
    name: string | null
    email: string
  } | null
  documents?: SafeAffiliationDocument[]
  observations?: AffiliationObservationWithRelations[]
  statusLogs?: AffiliationStatusLogWithRelations[]
}

export interface AffiliationObservationWithRelations extends SafeAffiliationObservation {
  createdBy?: {
    id: string
    name: string | null
    email: string
  }
}

export interface AffiliationStatusLogWithRelations extends SafeAffiliationStatusLog {
  changedBy?: {
    id: string
    name: string | null
    email: string
  }
}

// ========================================
// INPUT TYPES (for forms and mutations)
// ========================================

export interface CreateAffiliationInput {
  clientId: string
  subProcesses: {
    type: AffiliationSubProcessType
    assignedToId?: string | null
  }[]
}

export interface UpdateAffiliationInput {
  isActive?: boolean
}

export interface UpdateSubProcessStatusInput {
  subProcessId: string
  status: AffiliationSubProcessStatus
  reason?: string
}

export interface AssignSubProcessInput {
  subProcessId: string
  managerId: string | null // null to unassign
}

export interface AddObservationInput {
  subProcessId: string
  content: string
}

export interface UploadDocumentInput {
  subProcessId: string
  fileName: string
  fileType: string
  fileSize: number
  category?: AffiliationDocumentCategory
}

// ========================================
// RESPONSE TYPES (for server actions)
// ========================================

export interface AffiliationStats {
  total: number
  active: number
  inactive: number
  completed: number
  inProgress: number
  bySubProcessType: {
    type: AffiliationSubProcessType
    count: number
  }[]
  byStatus: {
    status: AffiliationSubProcessStatus
    count: number
  }[]
}

export interface MyAssignmentsStats {
  total: number
  notStarted: number
  inProgress: number
  pendingSupport: number
  inReview: number
  completed: number
  returned: number
}

// ========================================
// UI HELPER TYPES
// ========================================

export interface SubProcessProgress {
  total: number
  completed: number
  percentage: number
}

export interface AffiliationListItem extends SafeAffiliation {
  client: {
    id: string
    fullName: string
    identificationType: string
    identificationNumber: string
  }
  subProcesses: {
    type: AffiliationSubProcessType
    status: AffiliationSubProcessStatus
  }[]
  progress: SubProcessProgress
  globalStatus: 'completed' | 'in_progress' | 'not_started' | 'pending'
}

// ========================================
// ENUM LABELS (for UI display)
// ========================================

export const SubProcessTypeLabels: Record<AffiliationSubProcessType, string> = {
  ARL: 'ARL',
  EPS: 'EPS',
  AFP: 'AFP',
  CCF: 'CCF',
}

export const SubProcessStatusLabels: Record<AffiliationSubProcessStatus, string> = {
  NOT_STARTED: 'Sin Iniciar',
  IN_PROGRESS: 'En Proceso',
  PENDING_SUPPORT: 'Pendiente de Soporte',
  IN_REVIEW: 'En Revisión',
  COMPLETED: 'Terminado',
  RETURNED: 'Devuelto',
}

export const DocumentCategoryLabels: Record<AffiliationDocumentCategory, string> = {
  ARL_DOCS: 'Documentos ARL',
  EPS_DOCS: 'Documentos EPS',
  AFP_DOCS: 'Documentos AFP',
  CCF_DOCS: 'Documentos CCF',
  GENERAL: 'General',
}

// ========================================
// STATUS COLORS (for badges)
// ========================================

export const SubProcessStatusColors: Record<
  AffiliationSubProcessStatus,
  { bg: string; text: string; border: string }
> = {
  NOT_STARTED: {
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    border: 'border-gray-300',
  },
  IN_PROGRESS: {
    bg: 'bg-blue-100',
    text: 'text-blue-700',
    border: 'border-blue-300',
  },
  PENDING_SUPPORT: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-700',
    border: 'border-yellow-300',
  },
  IN_REVIEW: {
    bg: 'bg-purple-100',
    text: 'text-purple-700',
    border: 'border-purple-300',
  },
  COMPLETED: {
    bg: 'bg-green-100',
    text: 'text-green-700',
    border: 'border-green-300',
  },
  RETURNED: {
    bg: 'bg-red-100',
    text: 'text-red-700',
    border: 'border-red-300',
  },
}

export const SubProcessTypeColors: Record<
  AffiliationSubProcessType,
  { bg: string; text: string; border: string }
> = {
  ARL: {
    bg: 'bg-orange-100',
    text: 'text-orange-700',
    border: 'border-orange-300',
  },
  EPS: {
    bg: 'bg-blue-100',
    text: 'text-blue-700',
    border: 'border-blue-300',
  },
  AFP: {
    bg: 'bg-green-100',
    text: 'text-green-700',
    border: 'border-green-300',
  },
  CCF: {
    bg: 'bg-purple-100',
    text: 'text-purple-700',
    border: 'border-purple-300',
  },
}
