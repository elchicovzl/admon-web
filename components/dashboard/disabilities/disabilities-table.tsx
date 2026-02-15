'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { SafeDisability } from '@/lib/types/disability.types'
import { toggleDisabilityStatus } from '@/lib/actions'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Eye, MoreHorizontal, Edit, Power } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { DisabilityStatus, HealthAdministrator } from '@prisma/client'

interface DisabilitiesTableProps {
  disabilities: SafeDisability[]
  onEditDisability?: (disability: SafeDisability) => void
}

const statusConfig = {
  [DisabilityStatus.NOT_STARTED]: {
    label: 'Por Iniciar',
    color: 'bg-gray-500',
  },
  [DisabilityStatus.IN_PROGRESS]: {
    label: 'En Proceso',
    color: 'bg-blue-500',
  },
  [DisabilityStatus.COMPLETED]: {
    label: 'Terminado',
    color: 'bg-green-500',
  },
  [DisabilityStatus.CLOSED]: {
    label: 'Cerrado',
    color: 'bg-gray-700',
  },
  [DisabilityStatus.URGENT]: {
    label: 'Urgente',
    color: 'bg-red-500',
  },
}

const administratorLabels = {
  [HealthAdministrator.EPS_SURA]: 'EPS SURA',
  [HealthAdministrator.PORVENIR]: 'PORVENIR',
  [HealthAdministrator.NUEVA_EPS]: 'NUEVA EPS',
  [HealthAdministrator.ARL_SURA]: 'ARL SURA',
  [HealthAdministrator.SALUD_TOTAL]: 'SALUD TOTAL',
  [HealthAdministrator.SAVIA_SALUD]: 'SAVIA SALUD',
}

export function DisabilitiesTable({
  disabilities,
  onEditDisability,
}: DisabilitiesTableProps) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const handleToggleStatus = async (disabilityId: string, currentStatus: boolean) => {
    setLoadingId(disabilityId)
    try {
      const result = await toggleDisabilityStatus(disabilityId, !currentStatus)

      if (result.success) {
        toast.success(result.message || 'Status actualizado')
        // Server Action already calls revalidatePath
      } else {
        toast.error(result.error || 'Error al actualizar status')
      }
    } catch (error) {
      console.error('Toggle status error:', error)
      toast.error('Error inesperado')
    } finally {
      setLoadingId(null)
    }
  }

  const handleViewDetails = (disabilityId: string) => {
    router.push(`/dashboard/disabilities/${disabilityId}`)
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha Recepción</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Administradora</TableHead>
            <TableHead>Fecha Inicio</TableHead>
            <TableHead>Fecha Fin</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {disabilities.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                No hay incapacidades registradas
              </TableCell>
            </TableRow>
          ) : (
            disabilities.map((disability) => {
              const statusInfo = statusConfig[disability.status]

              return (
                <TableRow key={disability.id}>
                  <TableCell>
                    {format(new Date(disability.receptionDate), 'dd MMM yyyy', { locale: es })}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
                  </TableCell>
                  <TableCell>{administratorLabels[disability.administrator]}</TableCell>
                  <TableCell>
                    {format(new Date(disability.startDate), 'dd MMM yyyy', { locale: es })}
                  </TableCell>
                  <TableCell>
                    {format(new Date(disability.endDate), 'dd MMM yyyy', { locale: es })}
                  </TableCell>
                  <TableCell>
                    <Badge variant={disability.isActive ? 'default' : 'secondary'}>
                      {disability.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
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
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleViewDetails(disability.id)}>
                          <Eye className="mr-2 h-4 w-4" />
                          Ver Detalles
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEditDisability?.(disability)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleToggleStatus(disability.id, disability.isActive)}
                          disabled={loadingId === disability.id}
                        >
                          <Power className="mr-2 h-4 w-4" />
                          {disability.isActive ? 'Desactivar' : 'Activar'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
