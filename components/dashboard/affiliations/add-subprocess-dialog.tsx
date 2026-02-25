/**
 * Add Sub-Process Dialog
 * Dialog to add new sub-processes to an existing affiliation
 */

'use client'

import { useState, useEffect } from 'react'
import { AffiliationSubProcessType } from '@prisma/client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Check, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { getCompanyEmployees } from '@/lib/actions/client.actions'
import { getManagers } from '@/lib/actions'
import { addSubProcesses } from '@/lib/actions/affiliation.actions'
import type { SafeClient } from '@/lib/types/client.types'
import type { SafeUser } from '@/lib/types/auth.types'
import type { SafeAffiliationSubProcess } from '@/lib/types/affiliation.types'

interface AddSubProcessDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  affiliationId: string
  clientId: string
  clientType: string
  currentUserId?: string
  existingSubProcesses: { type: AffiliationSubProcessType; employeeId: string | null }[]
  onSubProcessesAdded?: (created: SafeAffiliationSubProcess[]) => void
}

const subProcessTypes = [
  { value: AffiliationSubProcessType.ARL, label: 'ARL' },
  { value: AffiliationSubProcessType.EPS, label: 'EPS' },
  { value: AffiliationSubProcessType.AFP, label: 'AFP' },
  { value: AffiliationSubProcessType.CCF, label: 'CCF' },
]

export function AddSubProcessDialog({
  open,
  onOpenChange,
  affiliationId,
  clientId,
  clientType,
  currentUserId,
  existingSubProcesses,
  onSubProcessesAdded,
}: AddSubProcessDialogProps) {
  const [loading, setLoading] = useState(false)
  const [managers, setManagers] = useState<SafeUser[]>([])
  const [companyEmployees, setCompanyEmployees] = useState<SafeClient[]>([])

  const [selectedTypes, setSelectedTypes] = useState<Record<AffiliationSubProcessType, boolean>>({
    ARL: false, EPS: false, AFP: false, CCF: false,
  })
  const [assignments, setAssignments] = useState<Record<AffiliationSubProcessType, { assignedToId: string | null; assignToSelf: boolean }>>({
    ARL: { assignedToId: null, assignToSelf: false },
    EPS: { assignedToId: null, assignToSelf: false },
    AFP: { assignedToId: null, assignToSelf: false },
    CCF: { assignedToId: null, assignToSelf: false },
  })
  const [selectedEmployeesByType, setSelectedEmployeesByType] = useState<Record<AffiliationSubProcessType, string[]>>({
    ARL: [], EPS: [], AFP: [], CCF: [],
  })

  const isEmpresa = clientType === 'EMPRESA'

  useEffect(() => {
    if (open) {
      loadManagers()
      if (isEmpresa) {
        loadCompanyEmployees()
      }
    }
  }, [open, isEmpresa, clientId])

  async function loadManagers() {
    try {
      const result = await getManagers()
      if (result.success && result.data) {
        setManagers(result.data.filter((u) => u.isActive))
      }
    } catch (error) {
      console.error('Error loading managers:', error)
    }
  }

  async function loadCompanyEmployees() {
    try {
      const result = await getCompanyEmployees(clientId)
      if (result.success && result.data) {
        setCompanyEmployees(result.data)
      }
    } catch (error) {
      console.error('Error loading employees:', error)
    }
  }

  function toggleType(type: AffiliationSubProcessType) {
    setSelectedTypes((prev) => {
      const newState = { ...prev, [type]: !prev[type] }
      if (prev[type]) {
        setSelectedEmployeesByType((p) => ({ ...p, [type]: [] }))
      }
      return newState
    })
  }

  function toggleEmployeeForType(type: AffiliationSubProcessType, employeeId: string) {
    setSelectedEmployeesByType((prev) => {
      const current = prev[type]
      return {
        ...prev,
        [type]: current.includes(employeeId)
          ? current.filter((id) => id !== employeeId)
          : [...current, employeeId],
      }
    })
  }

  function getAvailableEmployeesForType(type: AffiliationSubProcessType) {
    const existingIds = existingSubProcesses
      .filter((sp) => sp.type === type && sp.employeeId)
      .map((sp) => sp.employeeId!)
    return companyEmployees.filter((e) => !existingIds.includes(e.id))
  }

  function toggleAllEmployeesForType(type: AffiliationSubProcessType) {
    const available = getAvailableEmployeesForType(type)
    setSelectedEmployeesByType((prev) => {
      const allSelected = prev[type].length === available.length
      return {
        ...prev,
        [type]: allSelected ? [] : available.map((e) => e.id),
      }
    })
  }

  function resetState() {
    setSelectedTypes({ ARL: false, EPS: false, AFP: false, CCF: false })
    setAssignments({
      ARL: { assignedToId: null, assignToSelf: false },
      EPS: { assignedToId: null, assignToSelf: false },
      AFP: { assignedToId: null, assignToSelf: false },
      CCF: { assignedToId: null, assignToSelf: false },
    })
    setSelectedEmployeesByType({ ARL: [], EPS: [], AFP: [], CCF: [] })
  }

  const hasSelectedTypes = Object.values(selectedTypes).some(Boolean)

  async function handleSubmit() {
    const activeTypes = (Object.entries(selectedTypes) as [AffiliationSubProcessType, boolean][])
      .filter(([, selected]) => selected)
      .map(([type]) => type)

    if (activeTypes.length === 0) {
      toast.error('Debe seleccionar al menos un sub-proceso')
      return
    }

    // Validate employees for EMPRESA
    if (isEmpresa) {
      for (const type of activeTypes) {
        if (selectedEmployeesByType[type].length === 0) {
          toast.error(`Debe seleccionar al menos un empleado para ${type}`)
          return
        }
      }
    }

    // Build sub-processes array
    const subProcessesData: { type: AffiliationSubProcessType; assignedToId?: string | null; employeeId?: string | null }[] = []

    for (const type of activeTypes) {
      const assignment = assignments[type]
      const assignedToId = assignment.assignToSelf ? currentUserId : assignment.assignedToId

      if (isEmpresa) {
        for (const employeeId of selectedEmployeesByType[type]) {
          subProcessesData.push({ type, assignedToId, employeeId })
        }
      } else {
        subProcessesData.push({ type, assignedToId })
      }
    }

    setLoading(true)
    try {
      const result = await addSubProcesses({
        affiliationId,
        subProcesses: subProcessesData,
      })

      if (result.success && result.data) {
        toast.success(result.message || 'Sub-procesos agregados exitosamente')
        resetState()
        onOpenChange(false)
        onSubProcessesAdded?.(result.data)
      } else {
        toast.error(result.error || 'Error al agregar sub-procesos')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al agregar sub-procesos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetState(); onOpenChange(v) }}>
      <DialogContent className={cn(
        'max-h-[85vh] overflow-y-auto',
        isEmpresa ? 'sm:max-w-[800px]' : 'sm:max-w-[600px]'
      )}>
        <DialogHeader>
          <DialogTitle>Agregar Sub-procesos</DialogTitle>
          <DialogDescription>
            Seleccione los sub-procesos a agregar a esta afiliación
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {subProcessTypes.map((spType) => {
            const isSelected = selectedTypes[spType.value]
            const assignment = assignments[spType.value]
            const selectedCount = selectedEmployeesByType[spType.value].length

            // Filter out employees that already have this sub-process type
            const existingEmployeeIdsForType = existingSubProcesses
              .filter((sp) => sp.type === spType.value && sp.employeeId)
              .map((sp) => sp.employeeId!)
            const availableEmployees = companyEmployees.filter(
              (e) => !existingEmployeeIdsForType.includes(e.id)
            )

            // For non-EMPRESA: check if this type already exists (without employees)
            const typeAlreadyExists = !isEmpresa && existingSubProcesses.some(
              (sp) => sp.type === spType.value
            )

            return (
              <Card key={spType.value} className={cn(isSelected && 'border-primary')}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleType(spType.value)}
                        disabled={typeAlreadyExists || (isEmpresa && availableEmployees.length === 0)}
                      />
                      <CardTitle className="text-base">{spType.label}</CardTitle>
                      {typeAlreadyExists && (
                        <span className="text-xs text-muted-foreground">(ya existe)</span>
                      )}
                      {isEmpresa && availableEmployees.length === 0 && existingEmployeeIdsForType.length > 0 && (
                        <span className="text-xs text-muted-foreground">(todos los empleados ya tienen este proceso)</span>
                      )}
                    </div>
                    {isSelected && isEmpresa && (
                      <Badge variant="secondary" className="text-xs">
                        <Users className="mr-1 h-3 w-3" />
                        {selectedCount} empleado{selectedCount !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                {isSelected && (
                  <CardContent className="space-y-3">
                    {/* Employee selection for EMPRESA */}
                    {isEmpresa && availableEmployees.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium">Seleccionar empleados</label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-auto py-1 px-2 text-xs"
                            onClick={() => toggleAllEmployeesForType(spType.value)}
                          >
                            {selectedEmployeesByType[spType.value].length === availableEmployees.length
                              ? 'Deseleccionar todos'
                              : 'Seleccionar todos'}
                          </Button>
                        </div>
                        <div className="max-h-40 overflow-y-auto rounded-md border p-2 space-y-1">
                          {availableEmployees.map((employee) => {
                            const isChecked = selectedEmployeesByType[spType.value].includes(employee.id)
                            return (
                              <div
                                key={employee.id}
                                className={cn(
                                  'flex items-center space-x-2 rounded-sm px-2 py-1.5 cursor-pointer hover:bg-muted/50',
                                  isChecked && 'bg-muted/30'
                                )}
                                onClick={() => toggleEmployeeForType(spType.value, employee.id)}
                              >
                                <div className={cn(
                                  'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border',
                                  isChecked ? 'bg-primary border-primary' : 'border-input'
                                )}>
                                  {isChecked && <Check className="h-3 w-3 text-primary-foreground" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{employee.fullName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {employee.identificationType} {employee.identificationNumber}
                                  </p>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Manager assignment */}
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={assignment.assignToSelf}
                        onCheckedChange={(checked) =>
                          setAssignments((prev) => ({
                            ...prev,
                            [spType.value]: { assignedToId: null, assignToSelf: checked as boolean },
                          }))
                        }
                      />
                      <label className="text-sm font-medium">Asignarme este sub-proceso</label>
                    </div>
                    {!assignment.assignToSelf && (
                      <div>
                        <label className="text-sm font-medium">Asignar a manager</label>
                        <Select
                          value={assignment.assignedToId || 'unassigned'}
                          onValueChange={(value) =>
                            setAssignments((prev) => ({
                              ...prev,
                              [spType.value]: {
                                assignedToId: value === 'unassigned' ? null : value,
                                assignToSelf: false,
                              },
                            }))
                          }
                        >
                          <SelectTrigger className="mt-2">
                            <SelectValue placeholder="Sin asignar (opcional)" />
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
                    )}
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !hasSelectedTypes}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Agregar Sub-procesos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
