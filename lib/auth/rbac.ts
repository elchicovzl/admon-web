import { auth } from './auth'
import prisma from '@/lib/db/prisma'
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

/**
 * Check if the current user can access the Control module (caja interna).
 *
 * Reads the flag FROM THE DATABASE, not from the session token, and that is
 * deliberate. The session strategy is JWT with `maxAge: 30 días`
 * (lib/auth/auth.config.ts), so a token minted today keeps saying
 * `canAccessControl: true` for a month after the permission is revoked. For
 * clients or processes that lag is tolerable; for a module that holds payroll
 * and personal loans it is not — revocation has to bite on the next request.
 *
 * The token copy still exists, but only as a cheap gate in middleware.ts to
 * avoid a DB hit on every navigation. THIS is the authoritative check, and it
 * is the one every Server Action and page in /dashboard/control must call.
 *
 * SUPER_ADMIN always passes, flag or no flag.
 */
export async function hasControlAccess(): Promise<boolean> {
  const session = await auth()

  if (!session?.user?.id) {
    return false
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, isActive: true, canAccessControl: true },
  })

  // A user deactivated mid-session keeps a valid token until it expires, so the
  // isActive check belongs here too — not only in the login flow.
  if (!user || !user.isActive) {
    return false
  }

  return user.role === UserRole.SUPER_ADMIN || user.canAccessControl
}

/**
 * Require access to the Control module (throws if not authorized)
 *
 * Use at the top of every Server Action and Server Component under
 * /dashboard/control. Middleware protection is NOT enough: a Server Action can
 * be invoked directly without ever going through a matched route.
 */
export async function requireControlAccess(): Promise<void> {
  const allowed = await hasControlAccess()

  if (!allowed) {
    throw new Error('Unauthorized: Control module access required')
  }
}
