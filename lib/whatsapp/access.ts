import { auth } from '@/lib/auth/auth'
import { hasWhatsAppAccess } from '@/lib/auth/rbac'

export const WHATSAPP_ERROR_NOT_AUTHENTICATED = 'No autenticado'
export const WHATSAPP_ERROR_NO_ACCESS = 'No tienes acceso al módulo de WhatsApp'

/**
 * Authorization for every WhatsApp Server Action, in the `{ authorized, error }`
 * shape used by the rest of the project's actions.
 *
 * SUPER_ADMIN always passes; a MANAGER passes only with `canAccessWhatsApp`.
 * The permission is read from the database (hasWhatsAppAccess), never from the
 * session token, so revocation takes effect on the next call. Server Actions
 * can be invoked directly, so each one must call this itself; middleware and
 * layout gating are not enough.
 *
 * This lives outside lib/actions/whatsapp.actions.ts on purpose: that file is
 * a 'use server' module, and every export of such a module becomes a public
 * endpoint.
 */
export async function requireWhatsAppAuth() {
  const session = await auth()

  if (!session?.user?.id) {
    return { authorized: false as const, error: WHATSAPP_ERROR_NOT_AUTHENTICATED }
  }

  if (!(await hasWhatsAppAccess())) {
    return { authorized: false as const, error: WHATSAPP_ERROR_NO_ACCESS }
  }

  return { authorized: true as const, userId: session.user.id }
}
