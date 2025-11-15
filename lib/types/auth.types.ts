import { UserRole } from '@prisma/client'

export interface User {
  id: string
  name: string | null
  email: string
  emailVerified: Date | null
  image: string | null
  role: UserRole
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  createdById: string | null
}

export interface SafeUser {
  id: string
  name: string | null
  email: string
  image: string | null
  role: UserRole
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface AuthSession {
  user: SafeUser
  expires: string
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterCredentials {
  name: string
  email: string
  password: string
  role?: UserRole
}

export interface ActionResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}
