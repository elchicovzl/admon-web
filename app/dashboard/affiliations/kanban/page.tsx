/**
 * Affiliations Kanban Page
 * Server Component that fetches data and renders the Kanban board
 */

import { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth'
import { getSubProcessesForKanban } from '@/lib/actions/affiliation.actions'
import { getManagers } from '@/lib/actions/user.actions'
import { KanbanClient } from './kanban-client'
import { KanbanBoardSkeleton } from '@/components/dashboard/affiliations/kanban-board-skeleton'

export const metadata: Metadata = {
  title: 'Vista Kanban - Afiliaciones',
  description: 'Vista Kanban de sub-procesos de afiliaciones',
}

// Async component for kanban board
async function KanbanBoard({ userId, userRole }: { userId: string; userRole: string }) {
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
      currentUserId={userId}
      currentUserRole={userRole}
    />
  )
}

export default async function AffiliationsKanbanPage() {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  return (
    <Suspense fallback={<KanbanBoardSkeleton />}>
      <KanbanBoard userId={session.user.id} userRole={session.user.role} />
    </Suspense>
  )
}
