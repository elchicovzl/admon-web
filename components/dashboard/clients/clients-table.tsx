'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ClientType, IdentificationType } from '@prisma/client'
import type { SafeClient } from '@/lib/types/client.types'
import { toggleClientStatus, deleteClient } from '@/lib/actions'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
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
import { MoreHorizontal, Eye, Edit, Ban, CheckCircle, Trash2, Building2, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

// Pure helper functions moved outside component for better performance
const getIdentificationTypeLabel = (type: IdentificationType) => {
  const labels: Record<IdentificationType, string> = {
    CEDULA: 'Cédula (CC)',
    TARJETA_IDENTIDAD: 'Tarjeta Identidad (TI)',
    REGISTRO_CIVIL: 'Registro Civil (RC)',
    CEDULA_EXTRANJERIA: 'Cédula Extranjería (CE)',
    PASAPORTE: 'Pasaporte (PA)',
    PPT: 'PPT',
    PEP: 'PEP',
    NUIP: 'NUIP',
    SALVOCONDUCTO: 'Salvoconducto',
    NIT: 'NIT',
  }
  return labels[type]
}

const getClientTypeLabel = (type: ClientType) => {
  const labels = {
    EMPLEADO: 'Empleado',
    EMPRESA: 'Empresa',
    INDEPENDIENTE: 'Independiente',
  }
  return labels[type]
}

const getClientTypeBadgeVariant = (type: ClientType) => {
  const variants = {
    EMPLEADO: 'default',
    EMPRESA: 'secondary',
    INDEPENDIENTE: 'outline',
  }
  return variants[type] as 'default' | 'secondary' | 'outline'
}

interface ClientsTableProps {
  clients: SafeClient[]
  onEditClient?: (client: SafeClient) => void
}

const PAGE_SIZE = 50

export function ClientsTable({ clients, onEditClient }: ClientsTableProps) {
  const router = useRouter()
  const [isTogglingStatus, setIsTogglingStatus] = useState(false)
  const [deleteClientId, setDeleteClientId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [page, setPage] = useState(1)

  const filteredClients = useMemo(() => {
    let result = clients

    // Filter by type
    if (typeFilter !== 'all') {
      result = result.filter((c) => c.clientType === typeFilter)
    }

    // Filter by search term
    if (search.trim()) {
      const term = search.toLowerCase().trim()
      result = result.filter((c) =>
        c.fullName.toLowerCase().includes(term) ||
        c.identificationNumber.toLowerCase().includes(term) ||
        c.email.toLowerCase().includes(term)
      )
    }

    return result
  }, [clients, search, typeFilter])

  const totalPages = Math.ceil(filteredClients.length / PAGE_SIZE)
  const paginatedClients = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filteredClients.slice(start, start + PAGE_SIZE)
  }, [filteredClients, page])

  // Reset page when filters change
  const hasActiveFilters = search.trim() !== '' || typeFilter !== 'all'

  function clearFilters() {
    setSearch('')
    setTypeFilter('all')
    setPage(1)
  }

  function handleSearchChange(value: string) {
    setSearch(value)
    setPage(1)
  }

  function handleTypeFilterChange(value: string) {
    setTypeFilter(value)
    setPage(1)
  }

  const handleToggleStatus = useCallback(async (client: SafeClient) => {
    setIsTogglingStatus(true)

    try {
      const result = await toggleClientStatus(client.id, !client.isActive)

      if (result.success) {
        toast.success(result.message || 'Status actualizado exitosamente')
      } else {
        toast.error(result.error || 'Error al cambiar status')
      }
    } catch (error) {
      console.error('Toggle status error:', error)
      toast.error('Error inesperado al cambiar status')
    } finally {
      setIsTogglingStatus(false)
    }
  }, [])

  const handleDeleteClient = useCallback(async () => {
    if (!deleteClientId) return
    setIsDeleting(true)
    try {
      const result = await deleteClient(deleteClientId)
      if (result.success) {
        toast.success(result.message || 'Cliente eliminado exitosamente')
      } else {
        toast.error(result.error || 'Error al eliminar cliente')
      }
    } catch (error) {
      console.error('Delete client error:', error)
      toast.error('Error inesperado al eliminar cliente')
    } finally {
      setIsDeleting(false)
      setDeleteClientId(null)
    }
  }, [deleteClientId])

  const handleViewDetails = useCallback((client: SafeClient) => {
    router.push(`/dashboard/clients/${client.id}`)
  }, [router])

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, identificación o email..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={handleTypeFilterChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tipo de cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            <SelectItem value={ClientType.EMPLEADO}>Empleado</SelectItem>
            <SelectItem value={ClientType.EMPRESA}>Empresa</SelectItem>
            <SelectItem value={ClientType.INDEPENDIENTE}>Independiente</SelectItem>
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 px-2">
            <X className="h-4 w-4 mr-1" />
            Limpiar
          </Button>
        )}
      </div>

      {/* Results count */}
      {hasActiveFilters && (
        <p className="text-sm text-muted-foreground">
          {filteredClients.length} resultado{filteredClients.length !== 1 ? 's' : ''} de {clients.length} clientes
        </p>
      )}

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Identificación</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Fecha de Registro</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedClients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  {hasActiveFilters
                    ? 'No se encontraron clientes con los filtros aplicados'
                    : 'No hay clientes registrados'}
                </TableCell>
              </TableRow>
            ) : (
              paginatedClients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell
                    className="cursor-pointer hover:text-primary transition-colors"
                    onClick={() => handleViewDetails(client)}
                  >
                    <span className="font-medium hover:underline">{client.fullName}</span>
                    {client.company && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Building2 className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <span className="text-xs text-muted-foreground">{client.company.fullName}</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground">
                        {getIdentificationTypeLabel(client.identificationType)}
                      </span>
                      <span className="font-mono text-sm">{client.identificationNumber}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getClientTypeBadgeVariant(client.clientType)}>
                      {getClientTypeLabel(client.clientType)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{client.email}</TableCell>
                  <TableCell className="text-sm">{client.phone}</TableCell>
                  <TableCell>
                    <Badge variant={client.isActive ? 'default' : 'destructive'}>
                      {client.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(client.createdAt), "d 'de' MMMM, yyyy", {
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
                        <DropdownMenuItem onClick={() => handleViewDetails(client)}>
                          <Eye className="mr-2 h-4 w-4" />
                          Ver Detalles
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEditClient?.(client)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleToggleStatus(client)}
                          disabled={isTogglingStatus}
                        >
                          {client.isActive ? (
                            <>
                              <Ban className="mr-2 h-4 w-4" />
                              Desactivar
                            </>
                          ) : (
                            <>
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Activar
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeleteClientId(client.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Mostrando {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, filteredClients.length)} de {filteredClients.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Anterior
            </Button>
            <span className="text-sm text-muted-foreground">
              Página {page} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteClientId} onOpenChange={(open) => !open && setDeleteClientId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Cliente</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar este cliente? El cliente será marcado como eliminado y no aparecerá en las listas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteClient}
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
