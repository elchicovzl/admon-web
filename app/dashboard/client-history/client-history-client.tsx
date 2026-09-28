/**
 * Client History (Histórico) Client Component
 * Displays the client list on the shared server-driven data table shell —
 * server-side search, status filter, sorting and pagination via the URL.
 */

'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ClientType, IdentificationType } from '@prisma/client'
import type { ColumnDef, ColumnPinningState } from '@tanstack/react-table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ClipboardList, Eye, FileText } from 'lucide-react'
import { ServerDataTable } from '@/components/dashboard/data-table/server-data-table'
import { useDebouncedUrlParam, useTableUrlParams } from '@/components/dashboard/data-table/use-table-url-params'
import { formatEmployeeCompanies } from '@/lib/utils/employment'
import type {
  ClientHistoryListItem,
  ClientHistoryListPage,
  ClientHistorySortBy,
  ClientHistoryStatusFilter,
} from '@/lib/types/client-history.types'

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

const STORAGE_KEY = 'client-history-table-v1'
const SORTABLE_COLUMNS: Set<string> = new Set(['client', 'processes', 'files', 'createdAt'])
const SORT_COLUMN_MAP: Record<string, ClientHistorySortBy> = {
  client: 'fullName',
  processes: 'affiliationsCount',
  files: 'documentsCount',
  createdAt: 'createdAt',
}
const DEFAULT_COLUMN_PINNING: ColumnPinningState = { left: ['client'], right: [] }

type Row_ = ClientHistoryListItem

interface ClientHistoryClientProps {
  initialPage: ClientHistoryListPage
}

export function ClientHistoryClient({ initialPage }: ClientHistoryClientProps) {
  const { searchParams, updateUrl, isPending } = useTableUrlParams()

  // URL-driven filter/sort values
  const q = searchParams.get('q') ?? ''
  const status = (searchParams.get('status') as ClientHistoryStatusFilter | null) ?? 'all'
  const sortBy = searchParams.get('sortBy') ?? ''
  const sortDir = (searchParams.get('sortDir') as 'asc' | 'desc' | null) ?? 'desc'

  const [qInput, setQInput] = useDebouncedUrlParam('q', updateUrl, q)

  const columns = useMemo<ColumnDef<Row_>[]>(
    () => [
      {
        id: 'client',
        header: 'Cliente',
        cell: ({ row }) => {
          const client = row.original
          const companies = formatEmployeeCompanies(client.employmentsAsEmployee)
          return (
            <div className="flex flex-col">
              <span className="text-sm font-medium truncate block max-w-[220px]" title={client.fullName}>
                {client.fullName}
              </span>
              <span className="text-xs text-muted-foreground">
                {identificationTypeLabels[client.identificationType]} {client.identificationNumber}
              </span>
              {companies && (
                <span className="text-xs text-muted-foreground truncate block max-w-[220px]" title={companies}>
                  Empresa: {companies}
                </span>
              )}
            </div>
          )
        },
        size: 240,
      },
      {
        id: 'type',
        header: 'Tipo',
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.clientTypes.map((type) => (
              <Badge key={type} variant="outline">
                {clientTypeLabels[type]}
              </Badge>
            ))}
          </div>
        ),
        size: 180,
      },
      {
        id: 'processes',
        header: 'Procesos',
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1 text-sm">
            <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
            {row.original.affiliationsCount}
          </span>
        ),
        size: 100,
      },
      {
        id: 'files',
        header: 'Archivos',
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1 text-sm">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            {row.original.documentsCount}
          </span>
        ),
        size: 100,
      },
      {
        id: 'status',
        header: 'Estado',
        cell: ({ row }) => {
          const client = row.original
          if (client.isDeleted) return <Badge variant="destructive">Eliminado</Badge>
          if (client.isActive) return <Badge variant="default">Activo</Badge>
          return <Badge variant="secondary">Inactivo</Badge>
        },
        size: 120,
      },
      {
        id: 'createdAt',
        header: 'Registrado',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {format(new Date(row.original.createdAt), 'dd/MM/yyyy', { locale: es })}
          </span>
        ),
        size: 120,
      },
      {
        id: 'actions',
        header: 'Histórico',
        cell: ({ row }) => (
          <Button asChild variant="outline" size="sm">
            <Link href={`/dashboard/client-history/${row.original.id}`}>
              <Eye className="h-4 w-4 mr-1" />
              Ver
            </Link>
          </Button>
        ),
        size: 100,
      },
    ],
    []
  )

  function clearAllFilters() {
    updateUrl({ q: undefined, status: undefined })
  }

  const activeFilters = (q ? 1 : 0) + (status !== 'all' ? 1 : 0)

  return (
    <ServerDataTable
      columns={columns}
      result={initialPage}
      storageKey={STORAGE_KEY}
      updateUrl={updateUrl}
      isPending={isPending}
      sortBy={sortBy}
      sortDir={sortDir}
      sortableColumns={SORTABLE_COLUMNS}
      sortColumnMap={SORT_COLUMN_MAP}
      defaultColumnPinning={DEFAULT_COLUMN_PINNING}
      title="Clientes"
      description="Vista tipo Excel — pineá columnas, scroll horizontal, filtros y paginación"
      activeFilterCount={activeFilters}
      onClearFilters={clearAllFilters}
      emptyMessage="No hay clientes para mostrar"
      emptyFilteredMessage="No hay resultados para tu búsqueda"
      toolbar={
        <>
          <Input
            placeholder="Buscar por nombre, identificación, email o empresa..."
            title="Busca por nombre, identificación, email del cliente o nombre de la empresa"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            className="h-9 w-full sm:w-[320px]"
          />
          <Select
            value={status}
            onValueChange={(v) => updateUrl({ status: v === 'all' ? undefined : v })}
          >
            <SelectTrigger className="h-9 w-[170px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Activos</SelectItem>
              <SelectItem value="deleted">Eliminados</SelectItem>
            </SelectContent>
          </Select>
        </>
      }
    />
  )
}
