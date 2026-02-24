'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ClientType, IdentificationType } from '@prisma/client'
import type { SafeClient } from '@/lib/types/client.types'
import { toggleClientStatus } from '@/lib/actions'
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
import { MoreHorizontal, Eye, Edit, Ban, CheckCircle, FileText } from 'lucide-react'
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

export function ClientsTable({ clients, onEditClient }: ClientsTableProps) {
  const router = useRouter()
  const [isTogglingStatus, setIsTogglingStatus] = useState(false)

  const handleToggleStatus = useCallback(async (client: SafeClient) => {
    setIsTogglingStatus(true)

    try {
      const result = await toggleClientStatus(client.id, !client.isActive)

      if (result.success) {
        toast.success(result.message || 'Status actualizado exitosamente')
        // Server Action already calls revalidatePath
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

  const handleViewDetails = useCallback((client: SafeClient) => {
    router.push(`/dashboard/clients/${client.id}`)
  }, [router])

  return (
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
          {clients.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground">
                No hay clientes registrados
              </TableCell>
            </TableRow>
          ) : (
            clients.map((client) => (
              <TableRow key={client.id}>
                <TableCell
                  className="font-medium cursor-pointer hover:text-primary hover:underline transition-colors"
                  onClick={() => handleViewDetails(client)}
                >
                  {client.fullName}
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
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
