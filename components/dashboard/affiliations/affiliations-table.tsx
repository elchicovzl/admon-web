/**
 * Affiliations Table Component
 * Displays all affiliations with client info, sub-processes, and progress
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Eye, MoreHorizontal, Power, PowerOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { toggleAffiliationStatus } from '@/lib/actions/affiliation.actions'
import type { AffiliationWithRelations } from '@/lib/types/affiliation.types'
import { TypeBadge } from './status-badge'
import { AffiliationSubProcessStatus } from '@prisma/client'

interface AffiliationsTableProps {
  affiliations: AffiliationWithRelations[]
  onAffiliationUpdated?: (affiliationId: string, updates: Partial<AffiliationWithRelations>) => void
}

export function AffiliationsTable({
  affiliations,
  onAffiliationUpdated,
}: AffiliationsTableProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null)

  async function handleToggleStatus(affiliationId: string, currentStatus: boolean) {
    setLoadingId(affiliationId)
    try {
      const result = await toggleAffiliationStatus(affiliationId, !currentStatus)
      if (result.success) {
        toast.success(result.message || 'Status actualizado')
        onAffiliationUpdated?.(affiliationId, { isActive: !currentStatus })
      } else {
        toast.error(result.error || 'Error al actualizar el status')
      }
    } catch (error) {
      console.error('Error toggling status:', error)
      toast.error('Error al actualizar el status')
    } finally {
      setLoadingId(null)
    }
  }

  function calculateProgress(affiliation: AffiliationWithRelations) {
    const subProcesses = affiliation.subProcesses || []
    if (subProcesses.length === 0) return { completed: 0, total: 0, percentage: 0 }

    const completed = subProcesses.filter(
      (sp) => sp.status === AffiliationSubProcessStatus.COMPLETED
    ).length

    return {
      completed,
      total: subProcesses.length,
      percentage: Math.round((completed / subProcesses.length) * 100),
    }
  }

  function getGlobalStatus(affiliation: AffiliationWithRelations) {
    const subProcesses = affiliation.subProcesses || []
    if (subProcesses.length === 0) return 'not_started'

    const allCompleted = subProcesses.every(
      (sp) => sp.status === AffiliationSubProcessStatus.COMPLETED
    )
    if (allCompleted) return 'completed'

    const someInProgress = subProcesses.some(
      (sp) =>
        sp.status === AffiliationSubProcessStatus.IN_PROGRESS ||
        sp.status === AffiliationSubProcessStatus.IN_REVIEW
    )
    if (someInProgress) return 'in_progress'

    return 'not_started'
  }

  const globalStatusConfig = {
    completed: { label: 'Completada', className: 'bg-green-100 text-green-700 border-green-300' },
    in_progress: { label: 'En Proceso', className: 'bg-blue-100 text-blue-700 border-blue-300' },
    not_started: { label: 'Sin Iniciar', className: 'bg-gray-100 text-gray-700 border-gray-300' },
    pending: { label: 'Pendiente', className: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  }

  if (affiliations.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No hay afiliaciones registradas</p>
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>Identificación</TableHead>
            <TableHead>Sub-procesos</TableHead>
            <TableHead>Progreso</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Fecha de Creación</TableHead>
            <TableHead>Archivo</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {affiliations.map((affiliation) => {
            const progress = calculateProgress(affiliation)
            const globalStatus = getGlobalStatus(affiliation)
            const statusConfig = globalStatusConfig[globalStatus as keyof typeof globalStatusConfig]

            return (
              <TableRow key={affiliation.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/dashboard/affiliations/${affiliation.id}`}
                    className="hover:text-primary hover:underline cursor-pointer"
                  >
                    {affiliation.client?.fullName}
                  </Link>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    <div className="text-muted-foreground">{affiliation.client?.identificationType}</div>
                    <div>{affiliation.client?.identificationNumber}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {affiliation.subProcesses?.map((sp) => (
                      <TypeBadge key={sp.id} type={sp.type} className="text-xs" />
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1 w-32">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {progress.completed}/{progress.total}
                      </span>
                      <span className="font-medium">{progress.percentage}%</span>
                    </div>
                    <Progress value={progress.percentage} className="h-2" />
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={statusConfig.className}>
                    {statusConfig.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  {format(new Date(affiliation.createdAt), "d 'de' MMM 'de' yyyy", { locale: es })}
                </TableCell>
                <TableCell>
                  {affiliation.status === 'ARCHIVED' || affiliation.archivedAt ? (
                    <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-300">
                      Archivada
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                      Activa
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Abrir menú</span>
                        {loadingId === affiliation.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <MoreHorizontal className="h-4 w-4" />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                      <DropdownMenuItem asChild>
                        <Link
                          href={`/dashboard/affiliations/${affiliation.id}`}
                          className="cursor-pointer"
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Ver Detalles
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleToggleStatus(affiliation.id, affiliation.isActive)}
                        disabled={loadingId === affiliation.id}
                      >
                        {affiliation.isActive ? (
                          <>
                            <PowerOff className="mr-2 h-4 w-4" />
                            Desactivar
                          </>
                        ) : (
                          <>
                            <Power className="mr-2 h-4 w-4" />
                            Activar
                          </>
                        )}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
