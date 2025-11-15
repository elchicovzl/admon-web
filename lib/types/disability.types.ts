import { DisabilityStatus, HealthAdministrator } from '@prisma/client'

export interface Disability {
  id: string
  receptionDate: Date
  status: DisabilityStatus
  clientId: string
  employeeId: string
  administrator: HealthAdministrator
  startDate: Date
  endDate: Date
  bankRegistry: boolean
  transcription: string
  filing: string
  proofFileUrl: string | null
  proofS3Key: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  createdById: string
}

export interface SafeDisability {
  id: string
  receptionDate: Date
  status: DisabilityStatus
  clientId: string
  employeeId: string
  administrator: HealthAdministrator
  startDate: Date
  endDate: Date
  bankRegistry: boolean
  transcription: string
  filing: string
  proofFileUrl: string | null
  proofS3Key: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface DisabilityWithRelations extends SafeDisability {
  client?: {
    id: string
    fullName: string
    email: string
  }
  employee?: {
    id: string
    fullName: string
    email: string
  }
  observations?: DisabilityObservation[]
  createdBy?: {
    id: string
    name: string | null
    email: string
  }
}

export interface DisabilityObservation {
  id: string
  content: string
  disabilityId: string
  createdById: string
  createdAt: Date
  updatedAt: Date
  createdBy?: {
    id: string
    name: string | null
    email: string
  }
}
