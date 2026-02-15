/**
 * Clients Management Page
 * Server Component with progressive rendering
 */

import { Metadata } from 'next'
import { Suspense } from 'react'
import { getClients, getClientsCount } from '@/lib/actions/client.actions'
import { ClientsClient } from './clients-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, UserCheck, UserX } from 'lucide-react'
import { ClientsStatsSkeleton } from '@/components/dashboard/clients/clients-stats-skeleton'
import { ClientsTableSkeleton } from '@/components/dashboard/clients/clients-table-skeleton'

export const metadata: Metadata = {
  title: 'Clientes | Dashboard',
  description: 'Gestión de clientes',
}

// Async component for stats
async function ClientsStats() {
  const statsResult = await getClientsCount()
  const stats = statsResult.success ? statsResult.data : null

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.total || 0}</div>
          <p className="text-xs text-muted-foreground">Clientes registrados</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Clientes Activos</CardTitle>
          <UserCheck className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.active || 0}</div>
          <p className="text-xs text-muted-foreground">Con estado activo</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Clientes Inactivos</CardTitle>
          <UserX className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.inactive || 0}</div>
          <p className="text-xs text-muted-foreground">Con estado inactivo</p>
        </CardContent>
      </Card>
    </div>
  )
}

// Async component for table
async function ClientsTable() {
  const clientsResult = await getClients()
  const clients = clientsResult.success ? clientsResult.data || [] : []

  return <ClientsClient initialClients={clients} />
}

export default async function ClientsPage() {
  return (
    <div className="space-y-6">
      {/* Stats - progressive rendering */}
      <Suspense fallback={<ClientsStatsSkeleton />}>
        <ClientsStats />
      </Suspense>

      {/* Table - progressive rendering */}
      <Suspense fallback={<ClientsTableSkeleton />}>
        <ClientsTable />
      </Suspense>
    </div>
  )
}
