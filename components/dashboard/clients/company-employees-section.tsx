'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { SafeClient } from '@/lib/types/client.types'
import { removeEmployeeFromCompany } from '@/lib/actions'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Users,
  UserPlus,
  MoreHorizontal,
  Eye,
  UserMinus,
  Plus
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { IdentificationType } from '@prisma/client'
import { AssignEmployeeDialog } from './assign-employee-dialog'
import { CreateEmployeeDialog } from './create-employee-dialog'

interface CompanyEmployeesSectionProps {
  companyId: string
  initialEmployees: SafeClient[]
}

export function CompanyEmployeesSection({
  companyId,
  initialEmployees,
}: CompanyEmployeesSectionProps) {
  const router = useRouter()
  const [employees, setEmployees] = useState<SafeClient[]>(initialEmployees)
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)

  const getIdentificationTypeLabel = (type: IdentificationType) => {
    const labels = {
      CEDULA: 'Cédula',
      CEDULA_EXTRANJERIA: 'Cédula Extranjería',
      PPT: 'PPT',
      NIT: 'NIT',
    }
    return labels[type]
  }

  const handleViewEmployee = (employee: SafeClient) => {
    router.push(`/dashboard/clients/${employee.id}`)
  }

  const handleRemoveEmployee = async (employee: SafeClient) => {
    if (!confirm(`¿Estás seguro de desasignar a ${employee.fullName} de esta empresa?`)) {
      return
    }

    setIsRemoving(true)

    try {
      const result = await removeEmployeeFromCompany(employee.id)

      if (result.success) {
        toast.success(result.message || 'Empleado desasignado exitosamente')
        setEmployees((prev) => prev.filter((e) => e.id !== employee.id))
        router.refresh()
      } else {
        toast.error(result.error || 'Error al desasignar empleado')
      }
    } catch (error) {
      console.error('Remove employee error:', error)
      toast.error('Error inesperado al desasignar empleado')
    } finally {
      setIsRemoving(false)
    }
  }

  const handleEmployeeAdded = (employee: SafeClient) => {
    setEmployees((prev) => [...prev, employee])
    router.refresh()
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle>Empleados</CardTitle>
                <CardDescription>
                  {employees.length} {employees.length === 1 ? 'empleado' : 'empleados'} asignados
                </CardDescription>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Agregar Empleado
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Opciones</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setIsAssignDialogOpen(true)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Asignar Empleado Existente
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Crear Nuevo Empleado
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          {employees.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="text-sm">No hay empleados asignados a esta empresa</p>
              <p className="text-xs mt-2">
                Usa el botón "Agregar Empleado" para asignar empleados
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Identificación</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Fecha de Registro</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell
                        className="font-medium cursor-pointer hover:text-primary hover:underline transition-colors"
                        onClick={() => handleViewEmployee(employee)}
                      >
                        {employee.fullName}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground">
                            {getIdentificationTypeLabel(employee.identificationType)}
                          </span>
                          <span className="font-mono text-sm">
                            {employee.identificationNumber}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{employee.email}</TableCell>
                      <TableCell className="text-sm">{employee.phone}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(employee.createdAt), "d 'de' MMMM, yyyy", {
                          locale: es,
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Abrir menú</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleViewEmployee(employee)}>
                              <Eye className="mr-2 h-4 w-4" />
                              Ver Detalles
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleRemoveEmployee(employee)}
                              disabled={isRemoving}
                              className="text-destructive focus:text-destructive"
                            >
                              <UserMinus className="mr-2 h-4 w-4" />
                              Desasignar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AssignEmployeeDialog
        companyId={companyId}
        isOpen={isAssignDialogOpen}
        onClose={() => setIsAssignDialogOpen(false)}
        onEmployeeAssigned={handleEmployeeAdded}
      />

      <CreateEmployeeDialog
        companyId={companyId}
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onEmployeeCreated={handleEmployeeAdded}
      />
    </>
  )
}
