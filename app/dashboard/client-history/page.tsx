/**
 * Client History (Histórico) Page
 * Read-only aggregation view over existing client + process data.
 * Lists ALL clients, including soft-deleted ones.
 */

import { Metadata } from 'next'
import { Suspense } from 'react'
import { getClientHistoryList } from '@/lib/actions/client-history.actions'
import { ClientHistoryClient } from './client-history-client'
import { ClientHistoryTableSkeleton } from '@/components/dashboard/client-history/client-history-table-skeleton'

export const metadata: Metadata = {
  title: 'Histórico | Dashboard',
  description: 'Histórico completo de clientes y sus procesos',
}

async function ClientHistoryList() {
  const result = await getClientHistoryList()
  const clients = result.success ? result.data || [] : []

  return <ClientHistoryClient initialClients={clients} />
}

export default function ClientHistoryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Histórico</h1>
        <p className="text-muted-foreground">
          Toda la información de cada cliente: procesos, archivos y actividad.
          Incluye clientes eliminados, con opción de reactivarlos.
        </p>
      </div>

      <Suspense fallback={<ClientHistoryTableSkeleton />}>
        <ClientHistoryList />
      </Suspense>
    </div>
  )
}
