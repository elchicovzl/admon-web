import { auth } from './auth'
import { UserRole } from '@prisma/client'

/**
 * Check if current user has required role
 */
export async function hasRole(roles: UserRole[]): Promise<boolean> {
  const session = await auth()

  if (!session?.user) {
    return false
  }

  return roles.includes(session.user.role)
}

/**
 * Check if current user is SUPER_ADMIN
 */
export async function isSuperAdmin(): Promise<boolean> {
  return hasRole([UserRole.SUPER_ADMIN])
}

/**
 * Check if current user is MANAGER
 */
export async function isManager(): Promise<boolean> {
  return hasRole([UserRole.MANAGER])
}

/**
 * Require specific role (throws error if not authorized)
 */
export async function requireRole(roles: UserRole[]): Promise<void> {
  const hasRequiredRole = await hasRole(roles)

  if (!hasRequiredRole) {
    throw new Error('Unauthorized: Insufficient permissions')
  }
}

/**
 * Require SUPER_ADMIN role
 */
export async function requireSuperAdmin(): Promise<void> {
  return requireRole([UserRole.SUPER_ADMIN])
}

/**
 * Get current user role
 */
export async function getCurrentUserRole(): Promise<UserRole | null> {
  const session = await auth()
  return session?.user?.role || null
}
