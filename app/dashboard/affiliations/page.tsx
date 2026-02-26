/**
 * Affiliations List Page
 * Main page for viewing all affiliations with progressive rendering
 */

import { Metadata } from 'next'
import { Suspense } from 'react'
import { auth } from '@/lib/auth/auth'
import { getAffiliations, getAffiliationStats } from '@/lib/actions/affiliation.actions'
import { AffiliationsClient } from './affiliations-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, CheckCircle2, Clock, Loader2 } from 'lucide-react'
import { AffiliationsStatsSkeleton } from '@/components/dashboard/affiliations/affiliations-stats-skeleton'
import { AffiliationsTableSkeleton } from '@/components/dashboard/affiliations/affiliations-table-skeleton'

export const metadata: Metadata = {
  title: 'Afiliaciones | Dashboard',
  description: 'Gestión de afiliaciones a seguridad social',
}

// Async component for stats - loads independently
async function AffiliationsStats() {
  const statsResult = await getAffiliationStats()
  const stats = statsResult.success ? statsResult.data : null

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Afiliaciones</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.total || 0}</div>
          <p className="text-xs text-muted-foreground">
            {stats?.completed || 0} completadas • {stats?.inProgress || 0} en proceso
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Sin Iniciar</CardTitle>
          <Clock className="h-4 w-4 text-gray-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats?.byStatus.find((s) => s.status === 'NOT_STARTED')?.count || 0}
          </div>
          <p className="text-xs text-muted-foreground">
            Sub-procesos sin iniciar
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">En Proceso</CardTitle>
          <Loader2 className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats?.byStatus.find((s) => s.status === 'IN_PROGRESS')?.count || 0}
          </div>
          <p className="text-xs text-muted-foreground">
            Sub-procesos en progreso
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Completados</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats?.byStatus.find((s) => s.status === 'COMPLETED')?.count || 0}
          </div>
          <p className="text-xs text-muted-foreground">
            Sub-procesos completados
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

// Async component for table - loads independently
async function AffiliationsTable({ userId }: { userId?: string }) {
  const affiliationsResult = await getAffiliations()
  const affiliations = affiliationsResult.success ? affiliationsResult.data || [] : []

  return (
    <AffiliationsClient
      initialAffiliations={affiliations}
      currentUserId={userId}
    />
  )
}

export default async function AffiliationsPage() {
  const session = await auth()

  return (
    <div className="space-y-6">
      {/* Header - renders immediately */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Procesos de Seguridad Social</h1>
        <p className="text-muted-foreground">
          Gestiona los procesos de afiliación de clientes a ARL, EPS, AFP y CCF
        </p>
      </div>

      {/* Stats Cards - progressive rendering with skeleton */}
      <Suspense fallback={<AffiliationsStatsSkeleton />}>
        <AffiliationsStats />
      </Suspense>

      {/* Table - progressive rendering with skeleton */}
      <Suspense fallback={<AffiliationsTableSkeleton />}>
        <AffiliationsTable userId={session?.user?.id} />
      </Suspense>
    </div>
  )
}
