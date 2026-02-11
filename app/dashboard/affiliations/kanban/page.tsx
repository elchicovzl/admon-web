/**
 * Affiliations Kanban Page
 * Server Component that fetches data and renders the Kanban board
 */

import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth'
import { getSubProcessesForKanban } from '@/lib/actions/affiliation.actions'
import { getManagers } from '@/lib/actions'
import { KanbanClient } from './kanban-client'

export const metadata = {
  title: 'Vista Kanban - Afiliaciones',
  description: 'Vista Kanban de sub-procesos de afiliaciones',
}

export default async function AffiliationsKanbanPage() {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  // Fetch sub-processes and managers in parallel
  const [subProcessesResult, managersResult] = await Promise.all([
    getSubProcessesForKanban(),
    getManagers(),
  ])

  if (!subProcessesResult.success || !subProcessesResult.data) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Error al cargar los sub-procesos</h2>
          <p className="text-muted-foreground">{subProcessesResult.error}</p>
        </div>
      </div>
    )
  }

  const managers = managersResult.success && managersResult.data ? managersResult.data : []

  return (
    <KanbanClient
      initialSubProcesses={subProcessesResult.data}
      managers={managers}
      currentUserId={session.user.id}
      currentUserRole={session.user.role}
    />
  )
}
