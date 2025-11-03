import { ClientType, IdentificationType, AdministratorType } from '@prisma/client'

export interface Client {
  id: string
  fullName: string
  identificationType: IdentificationType
  identificationNumber: string
  clientType: ClientType
  email: string
  phone: string
  status: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  createdById: string
}

export interface SafeClient {
  id: string
  fullName: string
  identificationType: IdentificationType
  identificationNumber: string
  clientType: ClientType
  email: string
  phone: string
  status: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface ClientWithRelations extends SafeClient {
  notes?: ClientNote[]
  documents?: ClientDocument[]
  credentials?: ClientCredential[]
  createdBy?: {
    id: string
    name: string | null
    email: string
  }
}

export interface ClientNote {
  id: string
  content: string
  clientId: string
  createdById: string
  createdAt: Date
  updatedAt: Date
  createdBy?: {
    id: string
    name: string | null
    email: string
  }
}

export interface ClientDocument {
  id: string
  fileName: string
  fileUrl: string
  fileType: string
  fileSize: number
  s3Key: string
  clientId: string
  uploadedById: string
  createdAt: Date
  uploadedBy?: {
    id: string
    name: string | null
    email: string
  }
}

export interface UploadDocumentData {
  fileName: string
  fileType: string
  fileSize: number
}

export interface ClientCredential {
  id: string
  clientId: string
  administratorName: string
  administratorType: AdministratorType
  username: string
  encryptedPassword: string
  portalUrl: string | null
  notes: string | null
  createdById: string
  createdAt: Date
  updatedAt: Date
  createdBy?: {
    id: string
    name: string | null
    email: string
  }
}

export interface SafeClientCredential {
  id: string
  clientId: string
  administratorName: string
  administratorType: AdministratorType
  username: string
  portalUrl: string | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
  createdBy?: {
    id: string
    name: string | null
    email: string
  }
}

export interface ClientCredentialWithPassword extends SafeClientCredential {
  password: string
}
