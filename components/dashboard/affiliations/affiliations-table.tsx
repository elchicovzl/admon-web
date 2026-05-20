/**
 * Affiliations Table Component
 * Displays all affiliations with client info, sub-processes, and progress
 */

'use client'

import { useEffect, useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ChevronLeft, ChevronRight, Eye, MoreHorizontal, Pencil, Power, PowerOff, Trash2, Loader2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { toggleAffiliationStatus, deleteAffiliation } from '@/lib/actions/affiliation.actions'
import type { AffiliationWithRelations } from '@/lib/types/affiliation.types'
import {
  AffiliationProcessTypeLabels,
  AffiliationGlobalStatusLabels,
  getAffiliationGlobalStatus,
} from '@/lib/types/affiliation.types'
import { TypeBadge } from './status-badge'
import { AffiliationEditDialog } from './affiliation-edit-dialog'
import { AffiliationSubProcessStatus, AffiliationProcessType, ClientType } from '@prisma/client'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface AffiliationsTableProps {
  affiliations: AffiliationWithRelations[]
  searchQuery?: string
  onAffiliationUpdated?: (affiliationId: string, updates: Partial<AffiliationWithRelations>) => void
}

type EmployeeMini = { id: string; fullName: string; identificationNumber?: string | null }

function getUniqueEmployees(affiliation: AffiliationWithRelations): EmployeeMini[] {
  const map = new Map<string, EmployeeMini>()
  for (const sp of affiliation.subProcesses || []) {
    if (sp.employee && !map.has(sp.employee.id)) {
      map.set(sp.employee.id, sp.employee)
    }
  }
  return Array.from(map.values())
}

function matchesEmployee(emp: EmployeeMini, query: string): boolean {
  const q = query.toLowerCase()
  return (
    emp.fullName.toLowerCase().includes(q) ||
    (emp.identificationNumber || '').toLowerCase().includes(q)
  )
}

function EmployeeListPopover({
  employees,
  highlightQuery,
  triggerLabel,
}: {
  employees: EmployeeMini[]
  highlightQuery: string
  triggerLabel: string
}) {
  const q = highlightQuery.trim().toLowerCase()
  const sorted = q
    ? [...employees].sort((a, b) => {
        const aM = matchesEmployee(a, q) ? 0 : 1
        const bM = matchesEmployee(b, q) ? 0 : 1
        return aM - bM
      })
    : employees

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground bg-muted/60 hover:bg-muted border rounded px-1.5 py-0.5"
        >
          <Users className="h-3 w-3" />
          {triggerLabel}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-2"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-xs font-medium text-muted-foreground px-1 pb-1.5">
          Empleados ({employees.length})
        </div>
        <div className="max-h-64 overflow-y-auto space-y-0.5">
          {sorted.map((emp) => {
            const isMatch = q ? matchesEmployee(emp, q) : false
            return (
              <div
                key={emp.id}
                className={`text-xs rounded px-1.5 py-1 truncate ${
                  isMatch
                    ? 'bg-amber-50 text-amber-900 border border-amber-200'
                    : 'hover:bg-muted'
                }`}
                title={`${emp.fullName}${emp.identificationNumber ? ` · CC ${emp.identificationNumber}` : ''}`}
              >
                <span className="truncate">{emp.fullName}</span>
                {emp.identificationNumber && (
                  <span className="ml-1 text-muted-foreground">· {emp.identificationNumber}</span>
                )}
              </div>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function AffiliationsTable({
  affiliations,
  searchQuery = '',
  onAffiliationUpdated,
}: AffiliationsTableProps) {
  const PAGE_SIZE = 10
  const router = useRouter()
  const [isNavigating, startTransition] = useTransition()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [editingAffiliation, setEditingAffiliation] = useState<AffiliationWithRelations | null>(null)
  const [deleteAffiliationId, setDeleteAffiliationId] = useState<string | null>(null)
  const [isDeletingAffiliation, setIsDeletingAffiliation] = useState(false)

  // Reset to page 1 when filtered data changes
  useEffect(() => {
    setCurrentPage(1)
  }, [affiliations])

  const totalPages = Math.max(1, Math.ceil(affiliations.length / PAGE_SIZE))
  const safeCurrentPage = Math.min(currentPage, totalPages)

  const paginatedAffiliations = useMemo(() => {
    const start = (safeCurrentPage - 1) * PAGE_SIZE
    return affiliations.slice(start, start + PAGE_SIZE)
  }, [affiliations, safeCurrentPage])

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

  async function handleDeleteAffiliation() {
    if (!deleteAffiliationId) return
    setIsDeletingAffiliation(true)
    try {
      const result = await deleteAffiliation(deleteAffiliationId)
      if (result.success) {
        toast.success(result.message || 'Proceso eliminado exitosamente')
        onAffiliationUpdated?.(deleteAffiliationId, { isActive: false })
      } else {
        toast.error(result.error || 'Error al eliminar el proceso')
      }
    } catch (error) {
      console.error('Delete affiliation error:', error)
      toast.error('Error al eliminar el proceso')
    } finally {
      setIsDeletingAffiliation(false)
      setDeleteAffiliationId(null)
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

  const globalStatusClassName = {
    completed: 'bg-green-100 text-green-700 border-green-300',
    in_progress: 'bg-blue-100 text-blue-700 border-blue-300',
    not_started: 'bg-gray-100 text-gray-700 border-gray-300',
  } as const

  if (affiliations.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No hay afiliaciones registradas</p>
      </div>
    )
  }

  return (
    <>
    <div className="rounded-md border relative">
      {isNavigating && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
          <div className="flex items-center gap-3 bg-card border shadow-lg rounded-lg px-6 py-4">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm font-medium">Cargando proceso...</span>
          </div>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Proceso</TableHead>
            <TableHead>Tipo de Proceso</TableHead>
            <TableHead>Identificación</TableHead>
            <TableHead>Sub-procesos</TableHead>
            <TableHead>Progreso</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Inicio</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedAffiliations.map((affiliation) => {
            const progress = calculateProgress(affiliation)
            const globalStatus = getAffiliationGlobalStatus(affiliation.subProcesses)
            const statusConfig = {
              label: AffiliationGlobalStatusLabels[globalStatus],
              className: globalStatusClassName[globalStatus],
            }
            const isCompany = affiliation.client?.clientType === ClientType.EMPRESA
            const uniqueEmployees = isCompany ? getUniqueEmployees(affiliation) : []
            const trimmedQuery = searchQuery.trim()
            const matchedEmployees = trimmedQuery
              ? uniqueEmployees.filter((e) => matchesEmployee(e, trimmedQuery))
              : []
            const showMatchedList = trimmedQuery.length > 0 && matchedEmployees.length > 0
            const showCountBadge = !showMatchedList && uniqueEmployees.length > 0

            return (
              <TableRow key={affiliation.id}>
                <TableCell className="max-w-[240px]">
                  <div
                    className="cursor-pointer"
                    onClick={() => startTransition(() => router.push(`/dashboard/affiliations/${affiliation.id}`))}
                  >
                    <span className="font-mono text-sm font-bold hover:underline hover:text-primary">{affiliation.affiliationNumber}</span>
                    <div
                      className="text-sm text-muted-foreground truncate"
                      title={affiliation.client?.fullName}
                    >
                      {affiliation.client?.fullName}
                    </div>
                  </div>
                  {showMatchedList && (
                    <div className="mt-1.5 space-y-0.5">
                      {matchedEmployees.slice(0, 3).map((emp) => (
                        <div
                          key={emp.id}
                          className="flex items-center gap-1 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 truncate"
                          title={`${emp.fullName}${emp.identificationNumber ? ` · CC ${emp.identificationNumber}` : ''}`}
                        >
                          <Users className="h-3 w-3 shrink-0" />
                          <span className="truncate">{emp.fullName}</span>
                          {emp.identificationNumber && (
                            <span className="text-amber-700 shrink-0">· {emp.identificationNumber}</span>
                          )}
                        </div>
                      ))}
                      {matchedEmployees.length > 3 && (
                        <EmployeeListPopover
                          employees={uniqueEmployees}
                          highlightQuery={trimmedQuery}
                          triggerLabel={`+${matchedEmployees.length - 3} más`}
                        />
                      )}
                    </div>
                  )}
                  {showCountBadge && (
                    <div className="mt-1.5">
                      <EmployeeListPopover
                        employees={uniqueEmployees}
                        highlightQuery={trimmedQuery}
                        triggerLabel={`Empleados: ${uniqueEmployees.length}`}
                      />
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="text-sm max-w-[180px]">
                    {affiliation.processType ? (
                      affiliation.processType === AffiliationProcessType.OTRO && affiliation.processTypeOther
                        ? <span>{affiliation.processTypeOther}</span>
                        : <span>{AffiliationProcessTypeLabels[affiliation.processType]}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    <div className="text-muted-foreground">{affiliation.client?.identificationType}</div>
                    <div>{affiliation.client?.identificationNumber}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {(() => {
                      const sps = affiliation.subProcesses || []
                      // Group sub-processes by type and count
                      const typeCounts = sps.reduce<Record<string, number>>((acc, sp) => {
                        acc[sp.type] = (acc[sp.type] || 0) + 1
                        return acc
                      }, {})
                      return Object.entries(typeCounts).map(([type, count]) => (
                        <div key={type} className="flex items-center gap-0.5">
                          <TypeBadge type={type as any} className="text-xs" />
                          {count > 1 && (
                            <span className="text-[10px] text-muted-foreground font-medium">({count})</span>
                          )}
                        </div>
                      ))
                    })()}
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
                  {affiliation.startDate
                    ? format(new Date(affiliation.startDate), "d MMM yyyy", { locale: es })
                    : <span className="text-muted-foreground">—</span>}
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
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => startTransition(() => router.push(`/dashboard/affiliations/${affiliation.id}`))}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Ver Detalles
                      </DropdownMenuItem>
                      {affiliation.status === 'ACTIVE' && (
                        <DropdownMenuItem
                          className="cursor-pointer"
                          onClick={() => setEditingAffiliation(affiliation)}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                      )}
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
                      <DropdownMenuItem
                        onClick={() => setDeleteAffiliationId(affiliation.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      {/* Pagination */}
      {affiliations.length > PAGE_SIZE && (
        <div className="flex items-center justify-between border-t px-4 py-3">
          <p className="text-sm text-muted-foreground">
            {(safeCurrentPage - 1) * PAGE_SIZE + 1}-{Math.min(safeCurrentPage * PAGE_SIZE, affiliations.length)} de {affiliations.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safeCurrentPage <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <span className="text-sm text-muted-foreground">
              {safeCurrentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage >= totalPages}
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>

      {editingAffiliation && (
        <AffiliationEditDialog
          affiliationId={editingAffiliation.id}
          currentProcessType={editingAffiliation.processType}
          currentProcessTypeOther={editingAffiliation.processTypeOther}
          currentStartDate={editingAffiliation.startDate}
          currentNote={editingAffiliation.note}
          open={!!editingAffiliation}
          onOpenChange={(open) => { if (!open) setEditingAffiliation(null) }}
        />
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteAffiliationId} onOpenChange={(open) => !open && setDeleteAffiliationId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Proceso</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar este proceso? El proceso será marcado como eliminado y no aparecerá en las listas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingAffiliation}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAffiliation}
              disabled={isDeletingAffiliation}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isDeletingAffiliation ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
