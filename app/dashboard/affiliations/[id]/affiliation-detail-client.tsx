/**
 * Affiliation Detail Client Component
 * Client-side logic for affiliation detail page
 */

'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
import { ChevronDown, ChevronUp, Mail, Phone, FileText, Key, ExternalLink, Users, Plus, Eye, Trash2, Loader2 } from 'lucide-react'
import { AffiliationSubProcessType } from '@prisma/client'
import { StatusBadge, TypeBadge } from '@/components/dashboard/affiliations/status-badge'
import { AddSubProcessDialog } from '@/components/dashboard/affiliations/add-subprocess-dialog'
import { ClientCredentialsQuickView } from '@/components/dashboard/affiliations/client-credentials-quick-view'
import { deleteSubProcess } from '@/lib/actions/affiliation.actions'
import { toast } from 'sonner'
import type { AffiliationWithRelations, AffiliationSubProcessWithRelations } from '@/lib/types/affiliation.types'
import { useDashboardStore } from '@/lib/stores/use-dashboard-store'

interface AffiliationDetailClientProps {
  affiliation: AffiliationWithRelations
  currentUserId?: string
  currentUserRole?: string
}

export function AffiliationDetailClient({
  affiliation,
  currentUserId,
  currentUserRole,
}: AffiliationDetailClientProps) {
  const router = useRouter()
  const [isNavigating, startTransition] = useTransition()
  const setBreadcrumbLabels = useDashboardStore((s) => s.setBreadcrumbLabels)

  useEffect(() => {
    setBreadcrumbLabels({ [affiliation.id]: `#${affiliation.affiliationNumber}` })
    return () => setBreadcrumbLabels({})
  }, [affiliation.id, affiliation.affiliationNumber, setBreadcrumbLabels])

  const [clientInfoOpen, setClientInfoOpen] = useState(false)
  const [credentialsModalOpen, setCredentialsModalOpen] = useState(false)
  const [addSubProcessOpen, setAddSubProcessOpen] = useState(false)
  const [deleteSubProcessId, setDeleteSubProcessId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [subProcesses, setSubProcesses] = useState<AffiliationSubProcessWithRelations[]>(
    affiliation.subProcesses || []
  )

  async function handleDeleteSubProcess() {
    if (!deleteSubProcessId) return
    setIsDeleting(true)
    try {
      const result = await deleteSubProcess(deleteSubProcessId)
      if (result.success) {
        toast.success(result.message || 'Sub-proceso eliminado')
        setSubProcesses((prev) => prev.filter((sp) => sp.id !== deleteSubProcessId))
      } else {
        toast.error(result.error || 'Error al eliminar')
      }
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Error al eliminar el sub-proceso')
    } finally {
      setIsDeleting(false)
      setDeleteSubProcessId(null)
    }
  }

  function openSubProcessDetail(subProcess: AffiliationSubProcessWithRelations) {
    startTransition(() => {
      router.push(`/dashboard/affiliations/${affiliation.id}/subprocess/${subProcess.id}`)
    })
  }

  const client = affiliation.client

  // Check if any sub-processes have employees (EMPRESA affiliation)
  const hasEmployeeSubProcesses = subProcesses.some((sp) => sp.employeeId)

  // Group sub-processes by type for EMPRESA view
  const subProcessesByType = subProcesses.reduce<Record<string, AffiliationSubProcessWithRelations[]>>((acc, sp) => {
    if (!acc[sp.type]) acc[sp.type] = []
    acc[sp.type].push(sp)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {/* Client Information (Collapsible) */}
      <Collapsible open={clientInfoOpen} onOpenChange={setClientInfoOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Información del Cliente</CardTitle>
                  <CardDescription>
                    Datos de contacto y detalles del cliente
                  </CardDescription>
                </div>
                <Button variant="ghost" size="icon">
                  {clientInfoOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground mb-1">Nombre Completo</p>
                  <p className="font-medium">{client?.fullName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Identificación</p>
                  <p className="font-medium">
                    {client?.identificationType} {client?.identificationNumber}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Tipo de Cliente</p>
                  <Badge variant="outline">{client?.clientType}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground text-xs">Email</p>
                    <p className="font-medium">{client?.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground text-xs">Teléfono</p>
                    <p className="font-medium">{client?.phone}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" asChild>
                  <Link
                    href={`/dashboard/clients/${client?.id}`}
                    target="_blank"
                    className="flex items-center gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    Ver Perfil Completo
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCredentialsModalOpen(true)}
                >
                  <Key className="mr-2 h-4 w-4" />
                  Ver Credenciales
                </Button>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Sub-Processes - Compact Cards */}
      <div className="space-y-4 relative">
        {isNavigating && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
            <div className="flex items-center gap-3 bg-card border shadow-lg rounded-lg px-6 py-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm font-medium">Cargando sub-proceso...</span>
            </div>
          </div>
        )}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold">Sub-procesos</h2>
            <p className="text-muted-foreground">
              Haz clic en &quot;Ver Detalles Completos&quot; para gestionar documentos y observaciones
            </p>
          </div>
          {affiliation.status === 'ACTIVE' && (
            <Button onClick={() => setAddSubProcessOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Agregar Sub-procesos
            </Button>
          )}
        </div>

        {subProcesses.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <p>No hay sub-procesos configurados para esta afiliación</p>
            </CardContent>
          </Card>
        ) : hasEmployeeSubProcesses ? (
          // Grouped tables by type for EMPRESA clients with employees
          <div className="space-y-6">
            {Object.entries(subProcessesByType).map(([type, sps]) => (
              <div key={type} className="space-y-2">
                <div className="flex items-center gap-2">
                  <TypeBadge type={type as AffiliationSubProcessType} />
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {sps.length} empleado{sps.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Empleado</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Manager</TableHead>
                        <TableHead className="text-center">Docs</TableHead>
                        <TableHead className="text-right">Acción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sps.map((sp) => (
                        <TableRow key={sp.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openSubProcessDetail(sp)}>
                          <TableCell className="font-medium">{sp.employee?.fullName || '—'}</TableCell>
                          <TableCell><StatusBadge status={sp.status} className="text-xs" /></TableCell>
                          <TableCell>
                            {sp.assignedTo ? (
                              <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={sp.assignedTo.image ? `/api/avatar/${sp.assignedTo.id}` : undefined} />
                                  <AvatarFallback className="text-[10px]">
                                    {(sp.assignedTo.name || sp.assignedTo.email).substring(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm">{sp.assignedTo.name || sp.assignedTo.email}</span>
                              </div>
                            ) : <span className="text-sm text-muted-foreground italic">Sin asignar</span>}
                          </TableCell>
                          <TableCell className="text-center text-sm text-muted-foreground">{sp.documents?.length || 0}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={(e) => { e.stopPropagation(); setDeleteSubProcessId(sp.id) }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Table for individual/independent clients
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead className="text-center">Docs</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subProcesses.map((sp) => (
                  <TableRow key={sp.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openSubProcessDetail(sp)}>
                    <TableCell><TypeBadge type={sp.type} className="text-xs" /></TableCell>
                    <TableCell><StatusBadge status={sp.status} className="text-xs" /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {sp.assignedTo ? (sp.assignedTo.name || sp.assignedTo.email) : <span className="italic">Sin asignar</span>}
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">{sp.documents?.length || 0}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Affiliation Metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Información de la Afiliación</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Creada por:</span>
            <span className="font-medium">
              {affiliation.createdBy?.name || affiliation.createdBy?.email}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fecha de creación:</span>
            <span className="font-medium">
              {format(new Date(affiliation.createdAt), "d 'de' MMMM 'de' yyyy", {
                locale: es,
              })}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Estado:</span>
            {affiliation.isActive ? (
              <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                Activa
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-300">
                Inactiva
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Credentials Quick View Modal */}
      {client && (
        <ClientCredentialsQuickView
          open={credentialsModalOpen}
          onOpenChange={setCredentialsModalOpen}
          clientId={client.id}
          clientName={client.fullName}
        />
      )}

      {/* Add Sub-Process Dialog */}
      {client && (
        <AddSubProcessDialog
          open={addSubProcessOpen}
          onOpenChange={setAddSubProcessOpen}
          affiliationId={affiliation.id}
          clientId={client.id}
          clientType={client.clientType}
          currentUserId={currentUserId}
          existingSubProcesses={subProcesses.map((sp) => ({
            type: sp.type,
            employeeId: sp.employeeId,
          }))}
          onSubProcessesAdded={(created) => {
            // Add new sub-processes to local state (cast since they lack full relations)
            setSubProcesses((prev) => [
              ...prev,
              ...created.map((sp) => ({ ...sp, documents: [], observations: [], statusLogs: [] })),
            ])
          }}
        />
      )}

      {/* Delete Sub-Process Confirmation */}
      <AlertDialog open={!!deleteSubProcessId} onOpenChange={(open) => !open && setDeleteSubProcessId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Sub-proceso</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el sub-proceso y todos sus documentos y observaciones. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSubProcess}
              disabled={isDeleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isDeleting ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
