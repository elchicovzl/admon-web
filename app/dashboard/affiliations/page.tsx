/**
 * Affiliations List Page
 * Main page for viewing all affiliations with progressive rendering
 */

import { Metadata } from 'next'
import { Suspense } from 'react'
import { auth } from '@/lib/auth/auth'
import { getAffiliations } from '@/lib/actions/affiliation.actions'
import { AffiliationsClient } from './affiliations-client'
import { AffiliationsTableSkeleton } from '@/components/dashboard/affiliations/affiliations-table-skeleton'

export const metadata: Metadata = {
  title: 'Afiliaciones | Dashboard',
  description: 'Gestión de afiliaciones a seguridad social',
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

      {/* Table - progressive rendering with skeleton */}
      <Suspense fallback={<AffiliationsTableSkeleton />}>
        <AffiliationsTable userId={session?.user?.id} />
      </Suspense>
    </div>
  )
}
