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

  // Returning the children directly keeps this module free of JSX, so the
  // guard can be unit tested.
  return children
}
