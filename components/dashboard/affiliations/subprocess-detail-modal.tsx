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
import { X, User, Calendar, Clock, FileText, MessageSquare, History, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { StatusBadge, TypeBadge } from './status-badge'
import { SubProcessObservationsSection } from './subprocess-observations-section'
import { SubProcessDocumentsSection } from './subprocess-documents-section'
import { updateSubProcessStatus, getSubProcessStatusLogs } from '@/lib/actions/affiliation.actions'
import { AffiliationSubProcessStatus } from '@prisma/client'
import type {
  AffiliationSubProcessWithRelations,
  AffiliationObservationWithRelations,
  AffiliationStatusLogWithRelations,
  SafeAffiliationDocument,
} from '@/lib/types/affiliation.types'
import { SubProcessStatusLabels } from '@/lib/types/affiliation.types'

interface SubProcessDetailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  subProcess: AffiliationSubProcessWithRelations
  clientName?: string
  currentUserId?: string
  currentUserRole?: string
  onSubProcessUpdated?: (updates: Partial<AffiliationSubProcessWithRelations>) => void
  onObservationAdded?: (observation: AffiliationObservationWithRelations) => void
  onObservationDeleted?: (observationId: string) => void
  onDocumentDeleted?: (documentId: string) => void
}

export function SubProcessDetailModal({
  open,
  onOpenChange,
  subProcess,
  clientName,
  currentUserId,
  currentUserRole,
  onSubProcessUpdated,
  onObservationAdded,
  onObservationDeleted,
  onDocumentDeleted,
}: SubProcessDetailModalProps) {
  const [activeTab, setActiveTab] = useState('info')
  const [loading, setLoading] = useState(false)
  const [showStatusChange, setShowStatusChange] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<AffiliationSubProcessStatus | ''>('')
  const [statusReason, setStatusReason] = useState('')
  const [statusLogs, setStatusLogs] = useState<AffiliationStatusLogWithRelations[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)

  const canManage = currentUserRole === 'SUPER_ADMIN' || subProcess.assignedToId === currentUserId

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
        setShowStatusChange(false)
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
              Información
            </TabsTrigger>
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
                    <CardTitle className="text-lg">Asignación</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                      <User className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Manager Asignado</p>
                        <p className="font-medium">
                          {subProcess.assignedTo?.name || subProcess.assignedTo?.email || (
                            <span className="text-muted-foreground italic">Sin asignar</span>
                          )}
                        </p>
                      </div>
                    </div>
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
                      <CardTitle className="text-lg">Cambiar Estado</CardTitle>
                      <CardDescription>
                        Actualiza el estado del sub-proceso según el progreso
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {!showStatusChange ? (
                        <Button onClick={() => setShowStatusChange(true)} className="w-full">
                          Cambiar Estado
                        </Button>
                      ) : (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Nuevo Estado</Label>
                            <Select
                              value={selectedStatus}
                              onValueChange={(value) =>
                                setSelectedStatus(value as AffiliationSubProcessStatus)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccionar estado..." />
                              </SelectTrigger>
                              <SelectContent>
                                {statusOptions.map((status) => (
                                  <SelectItem key={status} value={status}>
                                    {SubProcessStatusLabels[status]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {selectedStatus === AffiliationSubProcessStatus.RETURNED && (
                            <div className="space-y-2">
                              <Label>Razón de Devolución *</Label>
                              <Textarea
                                placeholder="Describe la razón por la cual se devuelve el sub-proceso..."
                                value={statusReason}
                                onChange={(e) => setStatusReason(e.target.value)}
                                rows={4}
                              />
                            </div>
                          )}

                          <div className="flex gap-2">
                            <Button onClick={handleStatusChange} disabled={loading} className="flex-1">
                              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              Guardar Cambios
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setShowStatusChange(false)
                                setSelectedStatus('')
                                setStatusReason('')
                              }}
                              disabled={loading}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
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

              {/* DOCUMENTS TAB */}
              <TabsContent value="documents" className="mt-0">
                <SubProcessDocumentsSection
                  subProcessId={subProcess.id}
                  documents={subProcess.documents || []}
                  currentUserId={currentUserId}
                  currentUserRole={currentUserRole}
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
