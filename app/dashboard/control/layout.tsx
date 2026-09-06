/**
 * Layout del segmento /dashboard/control/*.
 *
 * Acá vive el guard REAL del módulo. El middleware ya rebota a quien no tiene
 * permiso, pero lee el JWT — que vive 30 días y por lo tanto puede estar
 * desactualizado. hasControlAccess() consulta la base, así que un permiso
 * revocado deja de funcionar en el siguiente request y no en un mes.
 *
 * Que el layout lo verifique cubre todas las páginas del segmento de una vez;
 * las Server Actions lo repiten por su cuenta porque se invocan directo, sin
 * pasar por ninguna ruta.
 */

import { redirect } from 'next/navigation'
import { hasControlAccess } from '@/lib/auth/rbac'

export const dynamic = 'force-dynamic'

export default async function ControlLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (!(await hasControlAccess())) {
    redirect('/dashboard?error=unauthorized')
  }

  return <>{children}</>
}
