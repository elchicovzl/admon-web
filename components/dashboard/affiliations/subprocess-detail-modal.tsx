/**
 * SubProcess Detail Modal Component
 * Full-screen modal with tabs for viewing and managing all sub-process details
 */

'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import { X, User, Calendar, Clock, FileText, MessageSquare, History, Loader2, Building2 } from 'lucide-react'
import { toast } from 'sonner'
import { StatusBadge, TypeBadge } from './status-badge'
import { SubProcessObservationsSection } from './subprocess-observations-section'
import { SubProcessDocumentsSection } from './subprocess-documents-section'
import { updateSubProcessStatus, assignSubProcess, getSubProcessStatusLogs } from '@/lib/actions/affiliation.actions'
import { getManagers } from '@/lib/actions/user.actions'
import { AffiliationSubProcessStatus } from '@prisma/client'
import type { SafeUser } from '@/lib/types/auth.types'
import type {
  AffiliationSubProcessWithRelations,
  AffiliationObservationWithRelations,
  AffiliationStatusLogWithRelations,
  SafeAffiliationDocument,
} from '@/lib/types/affiliation.types'
import { SubProcessStatusLabels } from '@/lib/types/affiliation.types'
import { SubProcessClientTab } from './subprocess-client-tab'

interface SubProcessDetailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  subProcess: AffiliationSubProcessWithRelations
  clientId?: string
  clientName?: string
  currentUserId?: string
  currentUserRole?: string
  onSubProcessUpdated?: (updates: Partial<AffiliationSubProcessWithRelations>) => void
  onObservationAdded?: (observation: AffiliationObservationWithRelations) => void
  onObservationDeleted?: (observationId: string) => void
  onDocumentUploaded?: (document: SafeAffiliationDocument) => void
  onDocumentDeleted?: (documentId: string) => void
}

export function SubProcessDetailModal({
  open,
  onOpenChange,
  subProcess,
  clientId,
  clientName,
  currentUserId,
  currentUserRole,
  onSubProcessUpdated,
  onObservationAdded,
  onObservationDeleted,
  onDocumentUploaded,
  onDocumentDeleted,
}: SubProcessDetailModalProps) {
  const [activeTab, setActiveTab] = useState('info')
  const [loading, setLoading] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<AffiliationSubProcessStatus | ''>('')
  const [statusReason, setStatusReason] = useState('')
  const [statusLogs, setStatusLogs] = useState<AffiliationStatusLogWithRelations[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)

  const canManage = true // Any manager or admin can edit/reassign
  const [showReassign, setShowReassign] = useState(false)
  const [managers, setManagers] = useState<SafeUser[]>([])
  const [reassignLoading, setReassignLoading] = useState(false)

  useEffect(() => {
    if (open && activeTab === 'history') {
      loadStatusLogs()
    }
  }, [open, activeTab, subProcess.id])

  async function loadStatusLogs() {
    setLoadingLogs(true)
    try {
      const result = await getSubProcessStatusLogs(subProcess.id)
      if (result.success && result.data) {
        setStatusLogs(result.data)
      }
    } catch (error) {
      console.error('Error loading status logs:', error)
    } finally {
      setLoadingLogs(false)
    }
  }

  async function handleStatusChange() {
    if (!selectedStatus) {
      toast.error('Debe seleccionar un estado')
      return
    }

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

      if (result.success && result.data) {
        toast.success('Estado actualizado exitosamente')
        onSubProcessUpdated?.({
          status: selectedStatus,
          statusReason: statusReason.trim() || null,
        })
        setSelectedStatus('')
        setStatusReason('')
        // Reload logs if on history tab
        if (activeTab === 'history') {
          loadStatusLogs()
        }
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
        onSubProcessUpdated?.({
          assignedToId: managerId === 'unassigned' ? null : managerId,
          assignedTo: managerId === 'unassigned' ? null : assignedManager ? {
            id: assignedManager.id,
            name: assignedManager.name,
            email: assignedManager.email,
            image: assignedManager.image ?? null,
          } : null,
        })
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

  const statusOptions = Object.values(AffiliationSubProcessStatus)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-2xl flex items-center gap-3 flex-wrap">
                <TypeBadge type={subProcess.type} />
                {clientName && (
                  <>
                    <span className="text-muted-foreground">—</span>
                    <span className="text-lg font-normal truncate">{clientName}</span>
                  </>
                )}
              </DialogTitle>
              <DialogDescription className="mt-2">
                Gestiona todos los aspectos de este sub-proceso de afiliación
              </DialogDescription>
            </div>
            <StatusBadge status={subProcess.status} className="shrink-0" />
          </div>
        </DialogHeader>

        <Separator className="shrink-0" />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-6 shrink-0">
            <TabsTrigger value="info" className="gap-2">
              <FileText className="h-4 w-4" />
              Info
            </TabsTrigger>
            {clientId && (
              <TabsTrigger value="client" className="gap-2">
                <Building2 className="h-4 w-4" />
                Cliente
              </TabsTrigger>
            )}
            <TabsTrigger value="documents" className="gap-2">
              <FileText className="h-4 w-4" />
              Documentos ({subProcess.documents?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="observations" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Observaciones ({subProcess.observations?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              Historial
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              {/* INFO TAB */}
              <TabsContent value="info" className="mt-0 space-y-6">
                {/* Manager Info */}
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
                          <p className="text-sm text-muted-foreground">Fecha de Creación</p>
                          <p className="text-sm font-medium">
                            {format(new Date(subProcess.createdAt), "d 'de' MMM 'de' yyyy", {
                              locale: es,
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Clock className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Última Actualización</p>
                          <p className="text-sm font-medium">
                            {format(new Date(subProcess.updatedAt), "d 'de' MMM 'de' yyyy", {
                              locale: es,
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Status Change */}
                {canManage && (
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
                            placeholder="Describe la razón por la cual se devuelve el sub-proceso..."
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
                )}

                {/* Status Reason (if RETURNED) */}
                {subProcess.status === AffiliationSubProcessStatus.RETURNED &&
                  subProcess.statusReason && (
                    <Card className="border-red-200 bg-red-50">
                      <CardHeader>
                        <CardTitle className="text-lg text-red-900">
                          Razón de Devolución
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-red-700 whitespace-pre-wrap">
                          {subProcess.statusReason}
                        </p>
                      </CardContent>
                    </Card>
                  )}
              </TabsContent>

              {/* CLIENT TAB */}
              {clientId && (
                <TabsContent value="client" className="mt-0">
                  <SubProcessClientTab clientId={clientId} employeeId={subProcess.employeeId ?? undefined} active={activeTab === 'client'} />
                </TabsContent>
              )}

              {/* DOCUMENTS TAB */}
              <TabsContent value="documents" className="mt-0">
                <SubProcessDocumentsSection
                  subProcessId={subProcess.id}
                  documents={subProcess.documents || []}
                  currentUserId={currentUserId}
                  currentUserRole={currentUserRole}
                  onDocumentUploaded={onDocumentUploaded}
                  onDocumentDeleted={onDocumentDeleted}
                />
              </TabsContent>

              {/* OBSERVATIONS TAB */}
              <TabsContent value="observations" className="mt-0">
                <SubProcessObservationsSection
                  subProcessId={subProcess.id}
                  observations={subProcess.observations || []}
                  currentUserId={currentUserId}
                  currentUserRole={currentUserRole}
                  onObservationAdded={onObservationAdded}
                  onObservationDeleted={onObservationDeleted}
                />
              </TabsContent>

              {/* HISTORY TAB */}
              <TabsContent value="history" className="mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <History className="h-5 w-5" />
                      Historial de Cambios
                    </CardTitle>
                    <CardDescription>
                      Registro completo de todos los cambios de estado
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loadingLogs ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : statusLogs.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <History className="h-12 w-12 mx-auto mb-2 opacity-20" />
                        <p className="text-sm">No hay cambios de estado registrados</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {statusLogs.map((log, index) => (
                          <div key={log.id} className="flex gap-4">
                            <div className="flex flex-col items-center">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-primary bg-background">
                                <div className="h-2 w-2 rounded-full bg-primary" />
                              </div>
                              {index < statusLogs.length - 1 && (
                                <div className="w-0.5 flex-1 bg-border" />
                              )}
                            </div>
                            <div className="flex-1 pb-8">
                              <div className="flex items-start justify-between gap-4 mb-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {log.fromStatus && (
                                    <>
                                      <StatusBadge status={log.fromStatus} />
                                      <span className="text-muted-foreground">→</span>
                                    </>
                                  )}
                                  <StatusBadge status={log.toStatus} />
                                </div>
                                <time className="text-xs text-muted-foreground whitespace-nowrap">
                                  {format(new Date(log.createdAt), "d 'de' MMM 'de' yyyy, HH:mm", {
                                    locale: es,
                                  })}
                                </time>
                              </div>
                              <p className="text-sm text-muted-foreground mb-1">
                                Por: {log.changedBy?.name || log.changedBy?.email}
                              </p>
                              {log.reason && (
                                <div className="mt-2 rounded-lg bg-muted p-3">
                                  <p className="text-sm whitespace-pre-wrap">{log.reason}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
