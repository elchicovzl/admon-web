/**
 * Disabilities Page
 * Server Component with progressive rendering
 */

import { Metadata } from 'next'
import { Suspense } from 'react'
import { getDisabilities, getDisabilitiesCount } from '@/lib/actions/disability.actions'
import { DisabilitiesClient } from './disabilities-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, Clock, CheckCircle, AlertTriangle } from 'lucide-react'
import { DisabilitiesStatsSkeleton } from '@/components/dashboard/disabilities/disabilities-stats-skeleton'
import { DisabilitiesTableSkeleton } from '@/components/dashboard/disabilities/disabilities-table-skeleton'
import { DisabilityStatus } from '@prisma/client'

export const metadata: Metadata = {
  title: 'Incapacidades | Dashboard',
  description: 'Gestión de incapacidades',
}

// Async component for stats - loads independently
async function DisabilitiesStats() {
  const statsResult = await getDisabilitiesCount()
  const stats = statsResult.success ? statsResult.data : null

  const getStatusCount = (status: DisabilityStatus) => {
    const found = stats?.byStatus.find((s) => s.status === status)
    return found?.count || 0
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Incapacidades</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.total || 0}</div>
          <p className="text-xs text-muted-foreground">
            {stats?.active || 0} activas, {stats?.inactive || 0} inactivas
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">En Proceso</CardTitle>
          <Clock className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {getStatusCount(DisabilityStatus.IN_PROGRESS)}
          </div>
          <p className="text-xs text-muted-foreground">
            Incapacidades en proceso
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Terminadas</CardTitle>
          <CheckCircle className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {getStatusCount(DisabilityStatus.COMPLETED)}
          </div>
          <p className="text-xs text-muted-foreground">
            Incapacidades completadas
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Urgentes</CardTitle>
          <AlertTriangle className="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {getStatusCount(DisabilityStatus.URGENT)}
          </div>
          <p className="text-xs text-muted-foreground">
            Requieren atención inmediata
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

// Async component for table - loads independently
async function DisabilitiesTable() {
  const disabilitiesResult = await getDisabilities()
  const disabilities = disabilitiesResult.success ? disabilitiesResult.data || [] : []

  return <DisabilitiesClient initialDisabilities={disabilities} />
}

export default async function DisabilitiesPage() {
  return (
    <div className="space-y-6">
      {/* Stats Cards - progressive rendering with skeleton */}
      <Suspense fallback={<DisabilitiesStatsSkeleton />}>
        <DisabilitiesStats />
      </Suspense>

      {/* Table - progressive rendering with skeleton */}
      <Suspense fallback={<DisabilitiesTableSkeleton />}>
        <DisabilitiesTable />
      </Suspense>
    </div>
  )
}
