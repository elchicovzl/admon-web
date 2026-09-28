/**
 * Client History (Histórico) Page
 * Read-only aggregation view over existing client + process data. Lists ALL
 * clients, including soft-deleted ones, on the shared server-driven data
 * table shell (URL-driven search, status filter, sorting and pagination —
 * same experience as My Assignments / Archived).
 */

import { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth'
import { getClientHistoryList } from '@/lib/actions/client-history.actions'
import { parsePaginationParams } from '@/lib/utils/pagination'
import { ClientHistoryClient } from './client-history-client'
import { ClientHistoryTableSkeleton } from '@/components/dashboard/client-history/client-history-table-skeleton'
import type { ClientHistorySortBy, ClientHistoryStatusFilter } from '@/lib/types/client-history.types'

export const metadata: Metadata = {
  title: 'Histórico | Dashboard',
  description: 'Histórico completo de clientes y sus procesos',
}

type SearchParams = {
  page?: string
  pageSize?: string
  q?: string
  status?: string
  sortBy?: string
  sortDir?: string
}

function parseArgs(sp: SearchParams) {
  const { page, pageSize, sortDir } = parsePaginationParams(sp)
  return {
    page,
    pageSize,
    q: sp.q?.trim() || undefined,
    status: (sp.status || undefined) as ClientHistoryStatusFilter | undefined,
    sortBy: (sp.sortBy || undefined) as ClientHistorySortBy | undefined,
    sortDir,
  }
}

// Async component for the client history table
async function ClientHistoryTable({ args }: { args: ReturnType<typeof parseArgs> }) {
  const result = await getClientHistoryList(args)

  if (!result.success) {
    return (
      <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
        <p>Error al cargar el histórico de clientes: {result.error}</p>
      </div>
    )
  }

  const pageData = result.data ?? {
    data: [],
    total: 0,
    page: args.page,
    pageSize: args.pageSize,
    totalPages: 1,
  }

  return <ClientHistoryClient initialPage={pageData} />
}

export default async function ClientHistoryPage({
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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Histórico</h1>
        <p className="text-muted-foreground">
          Toda la información de cada cliente: procesos, archivos y actividad.
          Incluye clientes eliminados, con opción de reactivarlos.
        </p>
      </div>

      <Suspense key={suspenseKey} fallback={<ClientHistoryTableSkeleton />}>
        <ClientHistoryTable args={args} />
      </Suspense>
    </div>
  )
}
