'use client'

import { useState, useEffect } from 'react'
import type { SafeClient } from '@/lib/types/client.types'
import { getAvailableEmployees, assignEmployeeToCompany } from '@/lib/actions'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2, Check, ChevronsUpDown, X } from 'lucide-react'
import { IdentificationType } from '@prisma/client'
import { cn } from '@/lib/utils'

interface AssignEmployeeDialogProps {
  companyId: string
  isOpen: boolean
  onClose: () => void
  onEmployeeAssigned: (employee: SafeClient) => void
}

export function AssignEmployeeDialog({
  companyId,
  isOpen,
  onClose,
  onEmployeeAssigned,
}: AssignEmployeeDialogProps) {
  const [availableEmployees, setAvailableEmployees] = useState<SafeClient[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<SafeClient | null>(null)
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isAssigning, setIsAssigning] = useState(false)

  const getIdentificationTypeLabel = (type: IdentificationType) => {
    const labels = {
      CEDULA: 'CC',
      CEDULA_EXTRANJERIA: 'CE',
      PPT: 'PPT',
      NIT: 'NIT',
    }
    return labels[type]
  }

  useEffect(() => {
    if (isOpen) {
      loadAvailableEmployees()
    } else {
      // Reset state when dialog closes
      setSelectedEmployee(null)
      setOpen(false)
    }
  }, [isOpen])

  const loadAvailableEmployees = async () => {
    setIsLoading(true)
    try {
      const result = await getAvailableEmployees()

      if (result.success && result.data) {
        setAvailableEmployees(result.data)
      } else {
        toast.error(result.error || 'Error al cargar empleados disponibles')
      }
    } catch (error) {
      console.error('Error loading available employees:', error)
      toast.error('Error inesperado al cargar empleados')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelect = (employee: SafeClient) => {
    setSelectedEmployee(employee)
    setOpen(false)
  }

  const clearSelection = () => {
    setSelectedEmployee(null)
  }

  const handleAssign = async () => {
    if (!selectedEmployee) {
      toast.error('Selecciona un empleado')
      return
    }

    setIsAssigning(true)

    try {
      const result = await assignEmployeeToCompany(selectedEmployee.id, companyId)

      if (result.success) {
        toast.success(result.message || 'Empleado asignado exitosamente')
        onEmployeeAssigned(selectedEmployee)
        onClose()
      } else {
        toast.error(result.error || 'Error al asignar empleado')
      }
    } catch (error) {
      console.error('Assign employee error:', error)
      toast.error('Error inesperado al asignar empleado')
    } finally {
      setIsAssigning(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Asignar Empleado Existente</DialogTitle>
          <DialogDescription>
            Selecciona un empleado disponible para asignar a esta empresa
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : availableEmployees.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No hay empleados disponibles</p>
              <p className="text-xs mt-2">
                Todos los empleados ya están asignados a empresas
              </p>
            </div>
          ) : (
            <>
              {/* Combobox for employee selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Buscar y seleccionar empleado
                </label>
                <Popover open={open} onOpenChange={setOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={open}
                      className="w-full justify-between"
                    >
                      {selectedEmployee ? (
                        <span className="truncate">
                          {selectedEmployee.fullName}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Buscar empleado...</span>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[460px] p-0">
                    <Command>
                      <CommandInput placeholder="Buscar por nombre, identificación o email..." />
                      <CommandList>
                        <CommandEmpty>No se encontraron empleados</CommandEmpty>
                        <CommandGroup>
                          {availableEmployees.map((employee) => (
                            <CommandItem
                              key={employee.id}
                              value={`${employee.fullName} ${employee.identificationNumber} ${employee.email}`}
                              onSelect={() => handleSelect(employee)}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  selectedEmployee?.id === employee.id
                                    ? 'opacity-100'
                                    : 'opacity-0'
                                )}
                              />
                              <div className="flex flex-col">
                                <span className="font-medium">{employee.fullName}</span>
                                <span className="text-xs text-muted-foreground">
                                  {getIdentificationTypeLabel(employee.identificationType)}{' '}
                                  {employee.identificationNumber} • {employee.email}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Selected employee summary card */}
              {selectedEmployee && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">
                            Empleado Seleccionado
                          </p>
                          <p className="text-lg font-semibold">{selectedEmployee.fullName}</p>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Identificación</p>
                            <p className="font-medium">
                              {getIdentificationTypeLabel(selectedEmployee.identificationType)}{' '}
                              {selectedEmployee.identificationNumber}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Email</p>
                            <p className="font-medium">{selectedEmployee.email}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Teléfono</p>
                            <p className="font-medium">{selectedEmployee.phone}</p>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={clearSelection}
                        className="h-8 w-8"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isAssigning}>
            Cancelar
          </Button>
          <Button
            onClick={handleAssign}
            disabled={!selectedEmployee || isAssigning || isLoading}
          >
            {isAssigning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Asignar Empleado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
