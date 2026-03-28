/**
 * Dashboard KPI Cards
 * Top-level metrics for affiliations, clients, sub-processes, and disabilities
 */

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { FileText, Users, Layers, HeartPulse } from 'lucide-react'
import type { AffiliationStats } from '@/lib/types/affiliation.types'

interface DashboardKpiCardsProps {
  affiliationStats: AffiliationStats | null
  clientStats: { total: number; active: number; inactive: number } | null
  disabilityStats: { total: number; active: number; inactive: number; byStatus: { status: string; count: number }[] } | null
}

export function DashboardKpiCards({ affiliationStats, clientStats, disabilityStats }: DashboardKpiCardsProps) {
  const totalSubProcesses = affiliationStats?.byStatus.reduce((sum, s) => sum + s.count, 0) || 0
  const completedSubProcesses = affiliationStats?.byStatus.find(s => s.status === 'COMPLETED')?.count || 0
  const completionPct = totalSubProcesses > 0 ? Math.round((completedSubProcesses / totalSubProcesses) * 100) : 0

  const urgentDisabilities = disabilityStats?.byStatus.find(s => s.status === 'URGENT')?.count || 0

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Link href="/dashboard/affiliations">
        <Card className="hover:border-primary/50 transition-colors cursor-pointer">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Procesos Activos</p>
                <p className="text-3xl font-bold tracking-tight">{affiliationStats?.active || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {affiliationStats?.total || 0} totales
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950">
                <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>

      <Link href="/dashboard/clients">
        <Card className="hover:border-primary/50 transition-colors cursor-pointer">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Clientes</p>
                <p className="text-3xl font-bold tracking-tight">{clientStats?.total || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {clientStats?.active || 0} activos
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950">
                <Users className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Sub-procesos</p>
              <p className="text-3xl font-bold tracking-tight">{totalSubProcesses}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {completionPct}% completados
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50 dark:bg-violet-950">
              <Layers className="h-6 w-6 text-violet-600 dark:text-violet-400" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Incapacidades</p>
              <p className="text-3xl font-bold tracking-tight">{disabilityStats?.active || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {urgentDisabilities > 0 ? `${urgentDisabilities} urgente${urgentDisabilities > 1 ? 's' : ''}` : `${disabilityStats?.total || 0} totales`}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950">
              <HeartPulse className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
