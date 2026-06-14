import { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth'
import { getClientHistory } from '@/lib/actions/client-history.actions'
import { ClientHistoryDetailClient } from './client-history-detail-client'

export const metadata: Metadata = {
  title: 'Histórico del cliente | Dashboard',
  description: 'Historial completo del cliente',
}

interface ClientHistoryDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function ClientHistoryDetailPage({
  params,
}: ClientHistoryDetailPageProps) {
  const session = await auth()
  if (!session?.user) {
    redirect('/login')
  }

  const { id } = await params
  const result = await getClientHistory(id)

  if (!result.success || !result.data) {
    notFound()
  }

  return <ClientHistoryDetailClient detail={result.data} />
}
