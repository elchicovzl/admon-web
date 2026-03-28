/**
 * Affiliation Detail Page
 * Detailed view of a single affiliation with all sub-processes
 */

import { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { auth } from '@/lib/auth/auth'
import { getAffiliationById } from '@/lib/actions/affiliation.actions'
import { AffiliationDetailClient } from './affiliation-detail-client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SendAffiliationButton } from '@/components/dashboard/affiliations/send-affiliation-button'
import { AffiliationStatusLabels, AffiliationStatusColors, AffiliationProcessTypeLabels } from '@/lib/types/affiliation.types'
import { AffiliationProcessType } from '@prisma/client'
import { AffiliationSubProcessStatus } from '@prisma/client'
import { SentEmailViewer } from '@/components/dashboard/affiliations/sent-email-viewer'
import { AffiliationEditDialog } from '@/components/dashboard/affiliations/affiliation-edit-dialog'
import { ArrowLeft, CheckCircle2, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

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

  // Calculate completion status
  const totalSubProcesses = affiliation.subProcesses?.length || 0
  const completedSubProcesses =
    affiliation.subProcesses?.filter((sp) => sp.status === AffiliationSubProcessStatus.COMPLETED)
      .length || 0
  const allCompleted = totalSubProcesses > 0 && completedSubProcesses === totalSubProcesses

  // Status badge colors
  const statusColors = AffiliationStatusColors[affiliation.status]
  const statusLabel = AffiliationStatusLabels[affiliation.status]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/dashboard/affiliations">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-3xl font-bold tracking-tight">
                {affiliation.affiliationNumber} - {affiliation.client?.fullName}
              </h1>
              <Badge
                variant="outline"
                className={cn(
                  statusColors.bg,
                  statusColors.text,
                  statusColors.border,
                  'font-medium'
                )}
              >
                {statusLabel}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {affiliation.client?.identificationType} {affiliation.client?.identificationNumber}
            </p>
            {affiliation.processType && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {affiliation.processType === AffiliationProcessType.OTRO && affiliation.processTypeOther
                  ? affiliation.processTypeOther
                  : AffiliationProcessTypeLabels[affiliation.processType]}
              </p>
            )}
            {affiliation.startDate && (
              <p className="text-sm text-muted-foreground mt-0.5">
                Inicio: {format(new Date(affiliation.startDate), "d 'de' MMMM, yyyy", { locale: es })}
              </p>
            )}
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-3">
          {/* Completion Indicator */}
          {allCompleted && affiliation.status === 'ACTIVE' && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Lista para enviar
            </Badge>
          )}
          {!allCompleted && affiliation.status === 'ACTIVE' && (
            <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-300">
              <Clock className="h-3 w-3 mr-1" />
              {completedSubProcesses} de {totalSubProcesses} completados
            </Badge>
          )}

          {/* Edit Button */}
          {affiliation.status === 'ACTIVE' && (
            <AffiliationEditDialog
              affiliationId={affiliation.id}
              currentProcessType={affiliation.processType}
              currentProcessTypeOther={affiliation.processTypeOther}
              currentStartDate={affiliation.startDate}
            />
          )}

          {/* Send Button */}
          <SendAffiliationButton
            affiliationId={affiliation.id}
            clientName={affiliation.client?.fullName || 'Cliente'}
            clientEmail={affiliation.client?.email || ''}
            allCompleted={allCompleted}
            currentStatus={affiliation.status}
          />
        </div>
      </div>

      {/* Sent/Archived Information */}
      {(affiliation.status === 'SENT' || affiliation.status === 'ARCHIVED') && (
        <div className="bg-muted/50 border rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium">Afiliación Archivada</p>
                <p className="text-sm text-muted-foreground">
                  Enviada el{' '}
                  {affiliation.sentAt
                    ? format(new Date(affiliation.sentAt), "d 'de' MMMM 'de' yyyy 'a las' HH:mm", {
                        locale: es,
                      })
                    : 'fecha desconocida'}
                  {affiliation.sentBy && ` por ${affiliation.sentBy.name || affiliation.sentBy.email}`}
                </p>
              </div>
            </div>
            <SentEmailViewer affiliationId={affiliation.id} />
          </div>
        </div>
      )}

      {/* Client Component with interactive features */}
      <AffiliationDetailClient
        affiliation={affiliation}
        currentUserId={session.user.id}
        currentUserRole={session.user.role}
      />
    </div>
  )
}
