/**
 * SubProcess Kanban Card Component
 * Card for displaying and managing individual sub-processes in Kanban style
 */

'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { StatusBadge, TypeBadge } from './status-badge'
import { FileText, MessageSquare, User, Loader2, Check } from 'lucide-react'
import { toast } from 'sonner'
import { updateSubProcessStatus, assignSubProcess } from '@/lib/actions/affiliation.actions'
import { AffiliationSubProcessStatus } from '@prisma/client'
import type { AffiliationSubProcessWithRelations } from '@/lib/types/affiliation.types'
import { SubProcessStatusLabels } from '@/lib/types/affiliation.types'

interface SubProcessKanbanCardProps {
  subProcess: AffiliationSubProcessWithRelations
  currentUserId?: string
  currentUserRole?: string
  onSubProcessUpdated?: (subProcessId: string, updates: Partial<AffiliationSubProcessWithRelations>) => void
  onViewDetails?: () => void
}

export function SubProcessKanbanCard({
  subProcess,
  currentUserId,
  currentUserRole,
  onSubProcessUpdated,
  onViewDetails,
}: SubProcessKanbanCardProps) {
  const [loading, setLoading] = useState(false)
  const [showStatusChange, setShowStatusChange] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<AffiliationSubProcessStatus | ''>('' )
  const [statusReason, setStatusReason] = useState('')

  const canManage =
    currentUserRole === 'SUPER_ADMIN' || subProcess.assignedToId === currentUserId

  const canTakeProcess = !subProcess.assignedToId && currentUserId

  async function handleTakeProcess() {
    if (!currentUserId) return

    setLoading(true)
    try {
      const result = await assignSubProcess({
        subProcessId: subProcess.id,
        managerId: currentUserId,
      })

      if (result.success && result.data) {
        toast.success('Sub-proceso asignado exitosamente')
        onSubProcessUpdated?.(subProcess.id, {
          assignedToId: currentUserId,
        })
      } else {
        toast.error(result.error || 'Error al asignar el sub-proceso')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al asignar el sub-proceso')
    } finally {
      setLoading(false)
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
        onSubProcessUpdated?.(subProcess.id, {
          status: selectedStatus,
          statusReason: statusReason.trim() || null,
        })
        setShowStatusChange(false)
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

  const statusOptions = Object.values(AffiliationSubProcessStatus)

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl flex items-center gap-2">
              <TypeBadge type={subProcess.type} />
            </CardTitle>
            <CardDescription className="flex items-center gap-2 text-sm">
              <User className="h-3 w-3" />
              {subProcess.assignedTo ? (
                <span>{subProcess.assignedTo.name || subProcess.assignedTo.email}</span>
              ) : (
                <span className="text-muted-foreground italic">Sin asignar</span>
              )}
            </CardDescription>
          </div>
          <StatusBadge status={subProcess.status} />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span>
              {subProcess.documents?.length || 0} documento{subProcess.documents?.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <MessageSquare className="h-4 w-4" />
            <span>
              {subProcess.observations?.length || 0} observación{subProcess.observations?.length !== 1 ? 'es' : ''}
            </span>
          </div>
        </div>

        {/* Status Reason (if RETURNED) */}
        {subProcess.status === AffiliationSubProcessStatus.RETURNED && subProcess.statusReason && (
          <div className="rounded-md bg-red-50 border border-red-200 p-3">
            <p className="text-sm font-medium text-red-900">Razón de devolución:</p>
            <p className="text-sm text-red-700 mt-1">{subProcess.statusReason}</p>
          </div>
        )}

        {/* Status Change Section */}
        {canManage && !showStatusChange && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setShowStatusChange(true)}
          >
            Cambiar Estado
          </Button>
        )}

        {canManage && showStatusChange && (
          <div className="space-y-3 border rounded-md p-3 bg-muted/30">
            <div className="space-y-2">
              <Label>Nuevo Estado</Label>
              <Select
                value={selectedStatus}
                onValueChange={(value) => setSelectedStatus(value as AffiliationSubProcessStatus)}
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
                <Label>Razón *</Label>
                <Textarea
                  placeholder="Escriba la razón de la devolución..."
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  rows={3}
                />
              </div>
            )}

            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleStatusChange}
                disabled={loading}
                className="flex-1"
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                Guardar
              </Button>
              <Button
                size="sm"
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

        {/* Take Process Button */}
        {canTakeProcess && (
          <Button
            variant="default"
            className="w-full"
            onClick={handleTakeProcess}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <User className="mr-2 h-4 w-4" />
            )}
            Tomar Proceso
          </Button>
        )}

        {/* View Details Button */}
        {onViewDetails && (
          <Button variant="outline" className="w-full" onClick={onViewDetails}>
            Ver Detalles Completos →
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
