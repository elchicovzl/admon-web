/**
 * Archived Affiliations Page
 * Displays archived affiliations that have been sent to clients
 */

import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth'
import { getArchivedAffiliations } from '@/lib/actions/affiliation.actions'
import { ArchivedAffiliationsClient } from './archived-affiliations-client'

export const metadata: Metadata = {
  title: 'Afiliaciones Archivadas | Dashboard',
  description: 'Historial de afiliaciones completadas y archivadas',
}

export default async function ArchivedAffiliationsPage() {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  const result = await getArchivedAffiliations()

  if (!result.success) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Afiliaciones Archivadas</h1>
          <p className="text-muted-foreground">
            Historial de afiliaciones completadas y enviadas a clientes
          </p>
        </div>
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
          <p>Error al cargar las afiliaciones archivadas: {result.error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Afiliaciones Archivadas</h1>
        <p className="text-muted-foreground">
          Historial de afiliaciones completadas y enviadas a clientes
        </p>
      </div>

      <ArchivedAffiliationsClient affiliations={result.data || []} />
    </div>
  )
}
