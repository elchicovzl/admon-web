/**
 * Layout of the /dashboard/whatsapp/* segment.
 *
 * This is the REAL guard of the module's pages. Middleware already bounces
 * users without permission, but it reads the JWT, which lives 30 days and can
 * be stale. hasWhatsAppAccess() queries the database, so a revoked permission
 * stops working on the next request. Server Actions repeat the check on their
 * own (requireWhatsAppAuth) because they can be invoked without any route.
 */

import { redirect } from 'next/navigation'
import { hasWhatsAppAccess } from '@/lib/auth/rbac'

export const dynamic = 'force-dynamic'

export default async function WhatsAppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (!(await hasWhatsAppAccess())) {
    redirect('/dashboard?error=unauthorized')
  }

  // Return the children as-is instead of wrapping them in JSX. Vitest only
  // parses .ts files here, so a JSX-free layout is what lets the guard above
  // be unit tested.
  return children
}
