'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ClientType, IdentificationType } from '@prisma/client'
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
import { ClipboardList, FileText, History } from 'lucide-react'
import type { ClientHistoryListItem } from '@/lib/types/client-history.types'

const identificationTypeLabels: Record<IdentificationType, string> = {
  CEDULA: 'CC',
  TARJETA_IDENTIDAD: 'TI',
  REGISTRO_CIVIL: 'RC',
  CEDULA_EXTRANJERIA: 'CE',
  PASAPORTE: 'PA',
  PPT: 'PPT',
  PEP: 'PEP',
  NUIP: 'NUIP',
  SALVOCONDUCTO: 'Salvoconducto',
  NIT: 'NIT',
}

const clientTypeLabels: Record<ClientType, string> = {
  EMPLEADO: 'Empleado',
  EMPRESA: 'Empresa',
  INDEPENDIENTE: 'Independiente',
}

interface ClientHistoryTableProps {
  clients: ClientHistoryListItem[]
}

export function ClientHistoryTable({ clients }: ClientHistoryTableProps) {
  if (clients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
        <History className="mb-3 h-10 w-10 text-muted-foreground" />
        <p className="font-medium">No hay clientes para mostrar</p>
        <p className="text-sm text-muted-foreground">
          Probá ajustando la búsqueda o el filtro de estado.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead className="text-center">Procesos</TableHead>
            <TableHead className="text-center">Archivos</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Registrado</TableHead>
            <TableHead className="w-24 text-right">Histórico</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((client) => (
            <TableRow
              key={client.id}
              className={client.isDeleted ? 'bg-destructive/5' : undefined}
            >
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{client.fullName}</span>
                  <span className="text-xs text-muted-foreground">
                    {identificationTypeLabels[client.identificationType]}{' '}
                    {client.identificationNumber}
                  </span>
                  {client.company && (
                    <span className="text-xs text-muted-foreground">
                      Empresa: {client.company.fullName}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{clientTypeLabels[client.clientType]}</Badge>
              </TableCell>
              <TableCell className="text-center">
                <span className="inline-flex items-center gap-1 text-sm">
                  <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
                  {client.affiliationsCount}
                </span>
              </TableCell>
              <TableCell className="text-center">
                <span className="inline-flex items-center gap-1 text-sm">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  {client.documentsCount}
                </span>
              </TableCell>
              <TableCell>
                {client.isDeleted ? (
                  <Badge variant="destructive">Eliminado</Badge>
                ) : client.isActive ? (
                  <Badge variant="default">Activo</Badge>
                ) : (
                  <Badge variant="secondary">Inactivo</Badge>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {format(new Date(client.createdAt), 'dd/MM/yyyy', { locale: es })}
              </TableCell>
              <TableCell className="text-right">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/dashboard/client-history/${client.id}`}>Ver</Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
