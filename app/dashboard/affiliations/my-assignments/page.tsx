/**
 * My Assignments Page
 * Shows all sub-processes assigned to the current manager
 */

import { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth'
import { getMyAssignments, getMyAssignmentsStats } from '@/lib/actions/affiliation.actions'
import { MyAssignmentsClient } from './my-assignments-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock, AlertCircle, CheckCircle2, XCircle, FileText, Eye } from 'lucide-react'
import { MyAssignmentsStatsSkeleton } from '@/components/dashboard/affiliations/my-assignments-stats-skeleton'
import { MyAssignmentsTableSkeleton } from '@/components/dashboard/affiliations/my-assignments-table-skeleton'

export const metadata: Metadata = {
  title: 'Mis Asignaciones | Dashboard',
  description: 'Sub-procesos asignados a mí',
}

// Async component for stats
async function AssignmentsStats() {
  const statsResult = await getMyAssignmentsStats()
  const stats = statsResult.success ? statsResult.data : null

  return (
    <>
      {/* Primary stats - 4 cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Asignados</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              Sub-procesos bajo tu responsabilidad
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Proceso</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.inProgress || 0}</div>
            <p className="text-xs text-muted-foreground">
              Sub-procesos activos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendiente de Soporte</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pendingSupport || 0}</div>
            <p className="text-xs text-muted-foreground">
              Requieren atención
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completados</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.completed || 0}</div>
            <p className="text-xs text-muted-foreground">
              Finalizados exitosamente
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Additional Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sin Iniciar</CardTitle>
            <Eye className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.notStarted || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Revisión</CardTitle>
            <Eye className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.inReview || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Devueltos</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.returned || 0}</div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

type SearchParams = {
  page?: string
  pageSize?: string
  company?: string
  employee?: string
  processType?: string
  subProcess?: string
  status?: string
  sortBy?: string
  sortDir?: string
}

function parseArgs(sp: SearchParams) {
  return {
    page: sp.page ? Math.max(1, parseInt(sp.page, 10) || 1) : 1,
    pageSize: sp.pageSize ? Math.min(200, Math.max(5, parseInt(sp.pageSize, 10) || 25)) : 25,
    company: sp.company?.trim() || undefined,
    employee: sp.employee?.trim() || undefined,
    processType: (sp.processType || undefined) as any,
    subProcess: (sp.subProcess || undefined) as any,
    status: (sp.status || undefined) as any,
    sortBy: (sp.sortBy || undefined) as any,
    sortDir: (sp.sortDir === 'asc' || sp.sortDir === 'desc' ? sp.sortDir : undefined) as
      | 'asc'
      | 'desc'
      | undefined,
  }
}

// Async component for table
async function AssignmentsTable({
  userId,
  userRole,
  args,
}: {
  userId: string
  userRole: string
  args: ReturnType<typeof parseArgs>
}) {
  const result = await getMyAssignments(args)
  const pageData = result.success && result.data
    ? result.data
    : { data: [], total: 0, page: args.page, pageSize: args.pageSize, totalPages: 1 }

  return (
    <MyAssignmentsClient
      initialPage={pageData}
      currentUserId={userId}
      currentUserRole={userRole}
    />
  )
}

export default async function MyAssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  const sp = await searchParams
  const args = parseArgs(sp)

  // Suspense key forces re-mount when args change so skeleton shows during navigation
  const suspenseKey = JSON.stringify(args)

  return (
    <div className="space-y-6">
      {/* Header - renders immediately */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mis Asignaciones</h1>
        <p className="text-muted-foreground">
          Sub-procesos asignados a ti
        </p>
      </div>

      {/* Stats - progressive rendering */}
      <Suspense fallback={<MyAssignmentsStatsSkeleton />}>
        <AssignmentsStats />
      </Suspense>

      {/* Table - progressive rendering */}
      <Suspense key={suspenseKey} fallback={<MyAssignmentsTableSkeleton />}>
        <AssignmentsTable userId={session.user.id} userRole={session.user.role} args={args} />
      </Suspense>
    </div>
  )
}
