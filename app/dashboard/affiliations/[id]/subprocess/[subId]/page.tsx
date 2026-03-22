import { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth'
import { getSubProcessById, getAffiliationById } from '@/lib/actions/affiliation.actions'
import { SubProcessPageClient } from './subprocess-page-client'

export const metadata: Metadata = {
  title: 'Sub-Proceso | Dashboard',
  description: 'Detalle del sub-proceso de afiliación',
}

interface SubProcessPageProps {
  params: {
    id: string
    subId: string
  }
}

export default async function SubProcessPage({ params }: SubProcessPageProps) {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  const { id, subId } = await params

  const [subProcessResult, affiliationResult] = await Promise.all([
    getSubProcessById(subId),
    getAffiliationById(id),
  ])

  if (!subProcessResult.success || !subProcessResult.data) {
    notFound()
  }

  if (!affiliationResult.success || !affiliationResult.data) {
    notFound()
  }

  return (
    <SubProcessPageClient
      subProcess={subProcessResult.data}
      affiliationId={id}
      affiliationNumber={affiliationResult.data.affiliationNumber}
      clientId={affiliationResult.data.clientId}
      clientName={affiliationResult.data.client?.fullName}
      currentUserId={session.user.id}
      currentUserRole={session.user.role}
    />
  )
}
