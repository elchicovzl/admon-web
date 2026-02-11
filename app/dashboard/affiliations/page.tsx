/**
 * Affiliations List Page
 * Main page for viewing all affiliations
 */

import { Metadata } from 'next'
import { Suspense } from 'react'
import { auth } from '@/lib/auth/auth'
import { getAffiliations, getAffiliationStats } from '@/lib/actions/affiliation.actions'
import { AffiliationsClient } from './affiliations-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, CheckCircle2, Clock, Loader2 } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Afiliaciones | Dashboard',
  description: 'Gestión de afiliaciones a seguridad social',
}

export default async function AffiliationsPage() {
  const session = await auth()

  // Load data in parallel
  const [affiliationsResult, statsResult] = await Promise.all([
    getAffiliations(),
    getAffiliationStats(),
  ])

  const affiliations = affiliationsResult.success ? affiliationsResult.data || [] : []
  const stats = statsResult.success ? statsResult.data : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Afiliaciones a Seguridad Social</h1>
        <p className="text-muted-foreground">
          Gestiona los procesos de afiliación de clientes a ARL, EPS, AFP y CCF
        </p>
      </div>

      {/* Stats Cards */}
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

      {/* Client Component with affiliations table */}
      <Suspense fallback={<div>Cargando afiliaciones...</div>}>
        <AffiliationsClient
          initialAffiliations={affiliations}
          initialStats={stats || undefined}
          currentUserId={session?.user?.id}
        />
      </Suspense>
    </div>
  )
}
