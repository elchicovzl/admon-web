/**
 * TypeScript types for Affiliation Module
 * Afiliaciones a Seguridad Social
 */

import {
  AffiliationStatus,
  AffiliationSubProcessType,
  AffiliationSubProcessStatus,
  AffiliationDocumentCategory,
  AffiliationProcessType,
} from '@prisma/client'

export { AffiliationStatus, AffiliationProcessType }

// ========================================
// BASE TYPES (from database)
// ========================================

export interface Affiliation {
  id: string
  affiliationNumber: string
  clientId: string
  processType: AffiliationProcessType | null
  processTypeOther: string | null
  status: AffiliationStatus
  sentAt: Date | null
  sentById: string | null
  archivedAt: Date | null
  startDate: Date | null
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
  employeeId: string | null
  statusReason: string | null
  disabilityStartDate: Date | null
  disabilityEndDate: Date | null
  bankRegistry: boolean
  transcription: boolean
  collection: boolean
  paidToUser: boolean
  disabilityAdministradoraId: string | null
  disabilityAdministradoraType: 'EPS' | 'AFP' | 'ARL' | 'CCF' | null
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
  affiliationNumber: string
  clientId: string
  processType: AffiliationProcessType | null
  processTypeOther: string | null
  status: AffiliationStatus
  sentAt: Date | null
  sentById: string | null
  archivedAt: Date | null
  startDate: Date | null
  note: string | null
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
  employeeId: string | null
  statusReason: string | null
  disabilityStartDate: Date | null
  disabilityEndDate: Date | null
  bankRegistry: boolean
  transcription: boolean
  collection: boolean
  paidToUser: boolean
  disabilityAdministradoraId: string | null
  disabilityAdministradoraType: 'EPS' | 'AFP' | 'ARL' | 'CCF' | null
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
  sentBy?: {
    id: string
    name: string | null
    email: string
  } | null
}

export interface AffiliationSubProcessWithRelations extends SafeAffiliationSubProcess {
  affiliation?: {
    id: string
    clientId: string
    affiliationNumber?: string
    processType?: AffiliationProcessType | null
    processTypeOther?: string | null
    startDate?: Date | null
    note?: string | null
    client?: {
      id: string
      fullName: string
      email?: string
      phone?: string
      identificationType?: string
      identificationNumber?: string
      clientType?: string
    }
  }
  assignedTo?: {
    id: string
    name: string | null
    email: string
    image: string | null
  } | null
  employee?: {
    id: string
    fullName: string
  } | null
  documents?: SafeAffiliationDocument[]
  observations?: AffiliationObservationWithRelations[]
  statusLogs?: AffiliationStatusLogWithRelations[]
  beneficiaries?: SubProcessBeneficiary[]
  disabilityAdministradora?: {
    id: string
    name: string
    code: string
    type: 'EPS' | 'AFP' | 'ARL' | 'CCF'
  } | null
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
    employeeId?: string | null
    disabilityStartDate?: Date | null
    disabilityEndDate?: Date | null
    bankRegistry?: boolean
    transcription?: boolean
    collection?: boolean
    paidToUser?: boolean
    beneficiaryIds?: string[]
  }[]
}

export interface SubProcessBeneficiary {
  id: string
  beneficiary: {
    id: string
    clientId: string
    tipoRelacion: string
    nombreCompleto: string
    identificationType: string
    identificationNumber: string
    isExcluded: boolean
    excludedAt: Date | null
  }
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
  bySubProcessTypeNotStarted: {
    type: AffiliationSubProcessType
    count: number
  }[]
}

export interface MyAssignmentsStats {
  total: number
  notStarted: number
  inProgress: number
  inReview: number
  completed: number
  returned: number
}

export type MyAssignmentsSortBy =
  | 'createdAt'
  | 'updatedAt'
  | 'startDate'
  | 'status'
  | 'subProcess'
  | 'company'
  | 'employee'

export interface GetMyAssignmentsArgs {
  page?: number
  pageSize?: number
  company?: string
  employee?: string
  processType?: AffiliationProcessType
  subProcess?: AffiliationSubProcessType
  status?: AffiliationSubProcessStatus
  sortBy?: MyAssignmentsSortBy
  sortDir?: 'asc' | 'desc'
}

export interface MyAssignmentsPage {
  data: AffiliationSubProcessWithRelations[]
  total: number
  page: number
  pageSize: number
  totalPages: number
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

export interface SubProcessKanbanItem {
  id: string
  type: AffiliationSubProcessType
  status: AffiliationSubProcessStatus
  affiliationId: string
  affiliationNumber: string
  employeeId: string | null
  createdAt: Date
  updatedAt: Date
  client: {
    id: string
    fullName: string
  }
  employee: {
    id: string
    fullName: string
  } | null
  assignedTo: {
    id: string
    name: string | null
    email: string
    image: string | null
  } | null
  _count: {
    documents: number
  }
}

// ========================================
// ENUM LABELS (for UI display)
// ========================================

export const SubProcessTypeLabels: Record<AffiliationSubProcessType, string> = {
  ARL: 'ARL',
  EPS: 'EPS',
  AFP: 'AFP',
  CCF: 'CCF',
  PILA: 'Pila',
  TRASLADOS: 'Traslados',
  INCAPACIDADES: 'Incapacidades',
  CONCILIACION_MORA: 'Conciliación Mora',
}

export const SubProcessStatusLabels: Record<AffiliationSubProcessStatus, string> = {
  NOT_STARTED: 'Sin Iniciar',
  IN_PROGRESS: 'En Proceso',
  PENDING_SUPPORT: 'Pendiente Soporte',
  IN_REVIEW: 'En Revisión',
  COMPLETED: 'Terminado',
  RETURNED: 'Devuelto',
}

export const DocumentCategoryLabels: Record<AffiliationDocumentCategory, string> = {
  ARL_DOCS: 'Documentos ARL',
  EPS_DOCS: 'Documentos EPS',
  AFP_DOCS: 'Documentos AFP',
  CCF_DOCS: 'Documentos CCF',
  PILA_DOCS: 'Documentos Pila',
  TRASLADOS_DOCS: 'Documentos Traslados',
  INCAPACIDADES_DOCS: 'Documentos Incapacidades',
  CONCILIACION_MORA_DOCS: 'Documentos Conciliación Mora',
  GENERAL: 'General',
}

export const AffiliationStatusLabels: Record<AffiliationStatus, string> = {
  ACTIVE: 'En Progreso',
  SENT: 'Enviada',
  ARCHIVED: 'Archivada',
}

export const AffiliationProcessTypeLabels: Record<AffiliationProcessType, string> = {
  DEPENDIENTE: '(01) Dependiente',
  INDEPENDIENTE: '(3) Independiente',
  TRABAJADOR_TIEMPO_PARCIAL: '(51) Trabajador de tiempo parcial',
  INDEPENDIENTE_VOLUNTARIO: '(57) Independiente voluntario',
  CONTRATISTA_INDEPENDIENTE: '(59) Contratista independiente',
  BENEFICIARIO_UPC_ADICIONAL: '(40) Beneficiario UPC adicional',
  COTIZANTE_INDEPENDIENTE_SALUD: '(42) Cotizante independiente pago solo salud',
  COTIZANTE_PENSIONES_PAGO_TERCERO: '(43) Cotizante a pensiones con pago por tercero',
  PLANILLA_S_SERVICIO_DOMESTICO: 'Planilla S Servicio doméstico',
  PLANILLA_E_EMPLEADOS: 'Planilla E (Empleados)',
  LIQUIDACIONES: 'Liquidaciones',
  TRASLADO_EPS: 'Traslado de EPS',
  COBRO_INCAPACIDADES: 'Cobro Incapacidades',
  PENSIONADO: 'Pensionado',
  INCLUSION_BENEFICIARIOS: 'Inclusion Beneficiarios',
  EXCLUSION_BENEFICIARIOS: 'Exclusión de Beneficiarios',
  ASESORIAS_PENSIONES: 'Asesorias y pensiones',
  OTRO: 'Otro',
}

// ========================================
// EMAIL TYPES
// ========================================

export interface SentEmailData {
  id: string
  toEmail: string
  ccEmails: string[]
  subject: string
  htmlBody: string
  attachments: SentEmailAttachment[]
  sentAt: Date
  sentBy: {
    name: string | null
    email: string
  }
}

export interface SentEmailAttachment {
  fileName: string
  fileType: string
  fileSize: number
}

export interface EmailComposeData {
  to: string
  subject: string
  emailBody: string
  clientName: string
  affiliationNumber: string
  processTypeLabel: string
  processTypeAction?: 'INCLUSION_BENEFICIARIOS' | 'EXCLUSION_BENEFICIARIOS' | null
  subProcesses: {
    id: string
    type: string
    label: string
    employeeName?: string | null
    beneficiaries?: {
      nombreCompleto: string
      tipoRelacion: string
      identificationType: string
      identificationNumber: string
    }[]
  }[]
  documents: EmailComposeDocument[]
}

export interface EmailComposeDocument {
  id: string
  fileName: string
  fileType: string
  fileSize: number
  s3Key: string
  subProcessType: string
  subProcessLabel: string
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
  PILA: {
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    border: 'border-amber-300',
  },
  TRASLADOS: {
    bg: 'bg-teal-100',
    text: 'text-teal-700',
    border: 'border-teal-300',
  },
  INCAPACIDADES: {
    bg: 'bg-rose-100',
    text: 'text-rose-700',
    border: 'border-rose-300',
  },
  CONCILIACION_MORA: {
    bg: 'bg-indigo-100',
    text: 'text-indigo-700',
    border: 'border-indigo-300',
  },
}

export const AffiliationStatusColors: Record<
  AffiliationStatus,
  { bg: string; text: string; border: string }
> = {
  ACTIVE: {
    bg: 'bg-blue-100',
    text: 'text-blue-700',
    border: 'border-blue-300',
  },
  SENT: {
    bg: 'bg-green-100',
    text: 'text-green-700',
    border: 'border-green-300',
  },
  ARCHIVED: {
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    border: 'border-gray-300',
  },
}
