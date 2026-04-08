import { ClientType, IdentificationType, AdministratorType, DocumentCategory, EmployeeType, WorkDaysRange } from '@prisma/client'

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
  companyId?: string | null
}

export interface SafeClient {
  id: string
  fullName: string
  identificationType: IdentificationType
  identificationNumber: string
  clientType: ClientType
  employeeType?: EmployeeType | null
  workDaysRange?: WorkDaysRange | null
  email: string
  phone: string
  status: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  companyId?: string | null
  company?: {
    id: string
    fullName: string
  } | null
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
  // Company-Employee relations
  company?: SafeClient | null
  employees?: SafeClient[]
  // Address and additional info
  address?: ClientAddress | null
  additionalInfo?: ClientAdditionalInfo | null
  beneficiaries?: ClientBeneficiary[]
  legalRepresentative?: LegalRepresentative | null
  // Administradoras
  eps?: AdministradoraInfo | null
  afp?: AdministradoraInfo | null
  arl?: AdministradoraInfo | null
  arlRiskLevel?: number | null
  ccf?: AdministradoraInfo | null
}

export interface AdministradoraInfo {
  id: string
  name: string
  code: string
  type: string
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
  category: DocumentCategory
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
  category?: DocumentCategory
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

// Client Address
export interface ClientAddress {
  id: string
  clientId: string
  departamento: string
  municipio: string
  ciudad?: string | null
  direccion: string
  createdAt: Date
  updatedAt: Date
}

// Client Additional Info
export interface ClientAdditionalInfo {
  id: string
  clientId: string
  actividadComercial?: string | null
  salario?: number | null
  fechaIngreso?: Date | null
  fechaRetiro?: Date | null
  createdAt: Date
  updatedAt: Date
}

// Client Beneficiary
export interface ClientBeneficiary {
  id: string
  clientId: string
  tipoRelacion: string
  nombreCompleto: string
  identificationType: IdentificationType
  identificationNumber: string
  createdAt: Date
  updatedAt: Date
}

// Legal Representative (for companies)
export interface LegalRepresentative {
  id: string
  clientId: string
  fullName: string
  identificationType: IdentificationType
  identificationNumber: string
  email?: string | null
  phone?: string | null
  createdAt: Date
  updatedAt: Date
}
