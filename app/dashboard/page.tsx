/**
 * Dashboard Home Page
 * Overview with KPI cards, charts, assignments summary, and quick links
 */

import { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { auth } from '@/lib/auth/auth'
import { getAffiliationStats, getMyAssignmentsStats } from '@/lib/actions/affiliation.actions'
import { getClientsCount } from '@/lib/actions/client.actions'
import { getDisabilitiesCount } from '@/lib/actions/disability.actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowRight, Clock, AlertCircle, CheckCircle2, RotateCcw, Eye, Inbox } from 'lucide-react'
import { DashboardKpiCards } from '@/components/dashboard/dashboard-kpi-cards'
import { DashboardCharts } from '@/components/dashboard/dashboard-charts'
import { DashboardQuickLinks } from '@/components/dashboard/dashboard-quick-links'

export const metadata: Metadata = {
  title: 'Dashboard | Admon Web',
  description: 'Panel de administración',
}

// KPI + Charts loaded together
async function DashboardStats() {
  // Sequential to avoid exhausting DB connection pool
  const affiliationResult = await getAffiliationStats()
  const clientResult = await getClientsCount()
  const disabilityResult = await getDisabilitiesCount()

  const affiliationStats = affiliationResult.success ? affiliationResult.data! : null
  const clientStats = clientResult.success ? clientResult.data! : null
  const disabilityStats = disabilityResult.success ? disabilityResult.data! : null

  return (
    <>
      <DashboardKpiCards
        affiliationStats={affiliationStats}
        clientStats={clientStats}
        disabilityStats={disabilityStats}
      />
      <DashboardCharts
        affiliationStats={affiliationStats}
        clientStats={clientStats}
        disabilityStats={disabilityStats}
      />
    </>
  )
}

// My assignments mini summary
async function MyAssignmentsSummary() {
  const result = await getMyAssignmentsStats()
  const stats = result.success ? result.data : null

  if (!stats || stats.total === 0) {
    return null
  }

  const items = [
    { label: 'En Proceso', value: stats.inProgress, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950' },
    { label: 'Sin Iniciar', value: stats.notStarted, icon: Inbox, color: 'text-gray-600', bg: 'bg-gray-50 dark:bg-gray-900' },
    { label: 'En Revisión', value: stats.inReview, icon: Eye, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-950' },
    { label: 'Completados', value: stats.completed, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950' },
    { label: 'Devueltos', value: stats.returned, icon: RotateCcw, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950' },
  ]

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Mis Asignaciones</CardTitle>
            <CardDescription>{stats.total} sub-procesos asignados</CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/affiliations/my-assignments">
              Ver Todos
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {items.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="flex items-center justify-between py-2 border-b last:border-0">
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${color} shrink-0`} />
                <span className="text-sm">{label}</span>
              </div>
              <span className="text-sm font-bold">{value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Skeleton for stats section
function StatsSkeleton() {
  return (
    <>
      {/* KPI cards skeleton */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-12 w-12 rounded-xl" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Charts skeleton */}
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-56" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[250px] w-full rounded-lg" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-56" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[250px] w-full rounded-lg" />
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}

function AssignmentsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-48" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default async function DashboardPage() {
  const session = await auth()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Bienvenido, {session?.user?.name || session?.user?.email}
        </p>
      </div>

      {/* KPI Cards + Charts */}
      <Suspense fallback={<StatsSkeleton />}>
        <DashboardStats />
      </Suspense>

      {/* My Assignments + Quick Links */}
      <div className="grid gap-4 md:grid-cols-2">
        <Suspense fallback={<AssignmentsSkeleton />}>
          <MyAssignmentsSummary />
        </Suspense>
        <DashboardQuickLinks />
      </div>
    </div>
  )
}
