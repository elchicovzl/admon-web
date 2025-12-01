/**
 * Affiliation Detail Page
 * Detailed view of a single affiliation with all sub-processes
 */

import { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth/auth'
import { getAffiliationById } from '@/lib/actions/affiliation.actions'
import { AffiliationDetailClient } from './affiliation-detail-client'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Detalle de Afiliación | Dashboard',
  description: 'Detalles de la afiliación',
}

interface AffiliationDetailPageProps {
  params: {
    id: string
  }
}

export default async function AffiliationDetailPage({
  params,
}: AffiliationDetailPageProps) {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  const { id } = await params
  const result = await getAffiliationById(id)

  if (!result.success || !result.data) {
    notFound()
  }

  const affiliation = result.data

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/dashboard/affiliations">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Afiliación de {affiliation.client?.fullName}
            </h1>
            <p className="text-muted-foreground">
              {affiliation.client?.identificationType} {affiliation.client?.identificationNumber}
            </p>
          </div>
        </div>
      </div>

      {/* Client Component with interactive features */}
      <AffiliationDetailClient
        affiliation={affiliation}
        currentUserId={session.user.id}
        currentUserRole={session.user.role}
      />
    </div>
  )
}
