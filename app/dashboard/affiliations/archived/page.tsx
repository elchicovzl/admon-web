/**
 * Archived Affiliations Page
 * Displays archived affiliations that have been sent to clients, on the
 * shared server-driven data table shell (URL-driven search, sorting and
 * pagination — same experience as My Assignments).
 */

import { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth'
import { getArchivedAffiliations } from '@/lib/actions/affiliation.actions'
import { parsePaginationParams } from '@/lib/utils/pagination'
import { ArchivedAffiliationsClient } from './archived-affiliations-client'
import { ArchivedAffiliationsTableSkeleton } from '@/components/dashboard/affiliations/archived-affiliations-table-skeleton'
import type { ArchivedSortBy } from '@/lib/types/affiliation.types'

export const metadata: Metadata = {
  title: 'Afiliaciones Archivadas | Dashboard',
  description: 'Historial de afiliaciones completadas y archivadas',
}

type SearchParams = {
  page?: string
  pageSize?: string
  q?: string
  sortBy?: string
  sortDir?: string
}

function parseArgs(sp: SearchParams) {
  const { page, pageSize, sortDir } = parsePaginationParams(sp)
  return {
    page,
    pageSize,
    q: sp.q?.trim() || undefined,
    sortBy: (sp.sortBy || undefined) as ArchivedSortBy | undefined,
    sortDir,
  }
}

// Async component for archived table
async function ArchivedTable({ args }: { args: ReturnType<typeof parseArgs> }) {
  const result = await getArchivedAffiliations(args)

  if (!result.success) {
    return (
      <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
        <p>Error al cargar las afiliaciones archivadas: {result.error}</p>
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

  return <ArchivedAffiliationsClient initialPage={pageData} />
}

export default async function ArchivedAffiliationsPage({
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
        <h1 className="text-3xl font-bold tracking-tight">Afiliaciones Archivadas</h1>
        <p className="text-muted-foreground">
          Historial de afiliaciones completadas y enviadas a clientes
        </p>
      </div>

      {/* Table - progressive rendering */}
      <Suspense key={suspenseKey} fallback={<ArchivedAffiliationsTableSkeleton />}>
        <ArchivedTable args={args} />
      </Suspense>
    </div>
  )
}
