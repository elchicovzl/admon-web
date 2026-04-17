'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ArrowLeft, User, Calendar, Clock, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { StatusBadge, TypeBadge } from '@/components/dashboard/affiliations/status-badge'
import { SubProcessObservationsSection } from '@/components/dashboard/affiliations/subprocess-observations-section'
import { SubProcessDocumentsSection } from '@/components/dashboard/affiliations/subprocess-documents-section'
import { SubProcessClientTab } from '@/components/dashboard/affiliations/subprocess-client-tab'
import { SubProcessDisabilityFields } from '@/components/dashboard/affiliations/subprocess-disability-fields'
import { SubProcessBeneficiariesSection } from '@/components/dashboard/affiliations/subprocess-beneficiaries-section'
import { updateSubProcessStatus, assignSubProcess } from '@/lib/actions/affiliation.actions'
import { getManagers } from '@/lib/actions/user.actions'
import { AffiliationSubProcessStatus, AffiliationSubProcessType } from '@prisma/client'
import type { SafeUser } from '@/lib/types/auth.types'
import type {
  AffiliationSubProcessWithRelations,
  AffiliationObservationWithRelations,
  SafeAffiliationDocument,
} from '@/lib/types/affiliation.types'
import { SubProcessStatusLabels, SubProcessTypeLabels } from '@/lib/types/affiliation.types'
import { useDashboardStore } from '@/lib/stores/use-dashboard-store'

interface SubProcessPageClientProps {
  subProcess: AffiliationSubProcessWithRelations
  affiliationId: string
  affiliationNumber: number
  clientId: string
  clientName?: string
  currentUserId: string
  currentUserRole: string
}

export function SubProcessPageClient({
  subProcess: initialSubProcess,
  affiliationId,
  affiliationNumber,
  clientId,
  clientName,
  currentUserId,
  currentUserRole,
}: SubProcessPageClientProps) {
  const [subProcess, setSubProcess] = useState(initialSubProcess)
  const setBreadcrumbLabels = useDashboardStore((s) => s.setBreadcrumbLabels)

  useEffect(() => {
    const subLabel = SubProcessTypeLabels[subProcess.type] +
      (subProcess.employee ? ` → ${subProcess.employee.fullName}` : '')
    setBreadcrumbLabels({
      [affiliationId]: `#${affiliationNumber}`,
      [subProcess.id]: subLabel,
    })
    return () => setBreadcrumbLabels({})
  }, [affiliationId, affiliationNumber, subProcess.id, subProcess.type, subProcess.employee, setBreadcrumbLabels])

  const [loading, setLoading] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<AffiliationSubProcessStatus | ''>('')
  const [statusReason, setStatusReason] = useState('')
  const [showReassign, setShowReassign] = useState(false)
  const [managers, setManagers] = useState<SafeUser[]>([])
  const [reassignLoading, setReassignLoading] = useState(false)

  async function handleStatusChange() {
    if (!selectedStatus) return

    if (selectedStatus === AffiliationSubProcessStatus.RETURNED && !statusReason.trim()) {
      toast.error('Debe proporcionar una razón al devolver el sub-proceso')
      return
    }

    setLoading(true)
    try {
      const result = await updateSubProcessStatus({
        subProcessId: subProcess.id,
        status: selectedStatus,
        reason: statusReason.trim() || undefined,
      })

      if (result.success) {
        toast.success('Estado actualizado exitosamente')
        setSubProcess((prev) => ({
          ...prev,
          status: selectedStatus,
          statusReason: statusReason.trim() || null,
        }))
        setSelectedStatus('')
        setStatusReason('')
      } else {
        toast.error(result.error || 'Error al actualizar el estado')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al actualizar el estado')
    } finally {
      setLoading(false)
    }
  }

  async function handleShowReassign() {
    setShowReassign(true)
    if (managers.length === 0) {
      const result = await getManagers()
      if (result.success && result.data) {
        setManagers(result.data)
      }
    }
  }

  async function handleReassign(managerId: string) {
    setReassignLoading(true)
    try {
      const result = await assignSubProcess({
        subProcessId: subProcess.id,
        managerId: managerId === 'unassigned' ? null : managerId,
      })
      if (result.success) {
        toast.success(result.message || 'Reasignado exitosamente')
        const assignedManager = managers.find((m) => m.id === managerId)
        setSubProcess((prev) => ({
          ...prev,
          assignedToId: managerId === 'unassigned' ? null : managerId,
          assignedTo: managerId === 'unassigned' ? null : assignedManager ? {
            id: assignedManager.id,
            name: assignedManager.name,
            email: assignedManager.email,
            image: assignedManager.image ?? null,
          } : null,
        }))
        setShowReassign(false)
      } else {
        toast.error(result.error || 'Error al reasignar')
      }
    } catch (error) {
      console.error('Reassign error:', error)
      toast.error('Error al reasignar')
    } finally {
      setReassignLoading(false)
    }
  }

  function handleObservationAdded(observation: AffiliationObservationWithRelations) {
    setSubProcess((prev) => ({
      ...prev,
      observations: [observation, ...(prev.observations || [])],
    }))
  }

  function handleObservationDeleted(observationId: string) {
    setSubProcess((prev) => ({
      ...prev,
      observations: (prev.observations || []).filter((o) => o.id !== observationId),
    }))
  }

  function handleDocumentUploaded(document: SafeAffiliationDocument) {
    setSubProcess((prev) => ({
      ...prev,
      documents: [document, ...(prev.documents || [])],
    }))
  }

  function handleDocumentDeleted(documentId: string) {
    setSubProcess((prev) => ({
      ...prev,
      documents: (prev.documents || []).filter((d) => d.id !== documentId),
    }))
  }

  const statusOptions = Object.values(AffiliationSubProcessStatus)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href={`/dashboard/affiliations/${affiliationId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <TypeBadge type={subProcess.type} />
            {clientName && (
              <>
                <span className="text-muted-foreground">—</span>
                <h1 className="text-2xl font-bold tracking-tight truncate">{clientName}</h1>
              </>
            )}
            {subProcess.employee && (
              <>
                <span className="text-muted-foreground">›</span>
                <span className="text-lg font-medium">{subProcess.employee.fullName}</span>
              </>
            )}
            <StatusBadge status={subProcess.status} />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Afiliación #{affiliationNumber}
          </p>
        </div>
      </div>

      {/* 2-column layout */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* LEFT COLUMN: Client/Employee Info */}
        <div>
          <SubProcessClientTab
            clientId={clientId}
            employeeId={subProcess.employeeId ?? undefined}
            active={true}
          />
        </div>

        {/* RIGHT COLUMN: Assignment + Status + Documents + Observations */}
        <div className="space-y-6">
          {/* Assignment */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Asignación</CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleShowReassign}
                  disabled={reassignLoading}
                >
                  Reasignar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                {subProcess.assignedTo ? (
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={subProcess.assignedTo.image ? `/api/avatar/${subProcess.assignedTo.id}` : undefined} />
                    <AvatarFallback>
                      {(subProcess.assignedTo.name || subProcess.assignedTo.email).substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <User className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Manager Asignado</p>
                  <p className="font-medium">
                    {subProcess.assignedTo?.name || subProcess.assignedTo?.email || (
                      <span className="text-muted-foreground italic">Sin asignar</span>
                    )}
                  </p>
                </div>
              </div>

              {showReassign && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label>Reasignar a</Label>
                    <Select
                      onValueChange={handleReassign}
                      defaultValue={subProcess.assignedToId ?? 'unassigned'}
                      disabled={reassignLoading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar manager..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Sin asignar</SelectItem>
                        {managers.map((manager) => (
                          <SelectItem key={manager.id} value={manager.id}>
                            {manager.name || manager.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Creación</p>
                    <p className="text-sm font-medium">
                      {format(new Date(subProcess.createdAt), "d MMM yyyy", { locale: es })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Actualización</p>
                    <p className="text-sm font-medium">
                      {format(new Date(subProcess.updatedAt), "d MMM yyyy", { locale: es })}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Estado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select
                value={selectedStatus || subProcess.status}
                onValueChange={(value) => {
                  const newStatus = value as AffiliationSubProcessStatus
                  setSelectedStatus(newStatus)
                  if (newStatus !== AffiliationSubProcessStatus.RETURNED) {
                    setStatusReason('')
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {SubProcessStatusLabels[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {(selectedStatus || subProcess.status) === AffiliationSubProcessStatus.RETURNED &&
                selectedStatus && (
                <div className="space-y-2">
                  <Label>Razón de Devolución *</Label>
                  <Textarea
                    placeholder="Describe la razón..."
                    value={statusReason}
                    onChange={(e) => setStatusReason(e.target.value)}
                    rows={3}
                  />
                </div>
              )}

              {selectedStatus && selectedStatus !== subProcess.status && (
                <Button onClick={handleStatusChange} disabled={loading} className="w-full">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Guardar
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Beneficiaries section (only INCLUSION/EXCLUSION_BENEFICIARIOS process types) */}
          {(subProcess.affiliation?.processType === 'INCLUSION_BENEFICIARIOS' ||
            subProcess.affiliation?.processType === 'EXCLUSION_BENEFICIARIOS') && (
            <SubProcessBeneficiariesSection
              subProcessId={subProcess.id}
              ownerClientId={subProcess.employeeId ?? clientId}
              processType={subProcess.affiliation.processType}
              initialBeneficiaryIds={
                (subProcess.beneficiaries ?? []).map((link) => link.beneficiary.id)
              }
              readonly={subProcess.status === AffiliationSubProcessStatus.COMPLETED}
            />
          )}

          {/* Disability fields (only INCAPACIDADES) */}
          {subProcess.type === AffiliationSubProcessType.INCAPACIDADES && (
            <SubProcessDisabilityFields
              subProcessId={subProcess.id}
              initial={{
                disabilityStartDate: subProcess.disabilityStartDate
                  ? new Date(subProcess.disabilityStartDate)
                  : null,
                disabilityEndDate: subProcess.disabilityEndDate
                  ? new Date(subProcess.disabilityEndDate)
                  : null,
                bankRegistry: subProcess.bankRegistry ?? false,
                transcription: subProcess.transcription ?? false,
                collection: subProcess.collection ?? false,
              }}
              onUpdated={(fields) =>
                setSubProcess((prev) => ({
                  ...prev,
                  ...fields,
                }))
              }
            />
          )}

          {/* Status Reason (if RETURNED) */}
          {subProcess.status === AffiliationSubProcessStatus.RETURNED &&
            subProcess.statusReason && (
              <Card className="border-red-200 bg-red-50">
                <CardHeader>
                  <CardTitle className="text-lg text-red-900">Razón de Devolución</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-red-700 whitespace-pre-wrap">
                    {subProcess.statusReason}
                  </p>
                </CardContent>
              </Card>
            )}

          {/* Documents */}
          <SubProcessDocumentsSection
            subProcessId={subProcess.id}
            documents={subProcess.documents || []}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
            onDocumentUploaded={handleDocumentUploaded}
            onDocumentDeleted={handleDocumentDeleted}
          />

          {/* Observations */}
          <SubProcessObservationsSection
            subProcessId={subProcess.id}
            observations={subProcess.observations || []}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
            onObservationAdded={handleObservationAdded}
            onObservationDeleted={handleObservationDeleted}
          />
        </div>
      </div>
    </div>
  )
}
