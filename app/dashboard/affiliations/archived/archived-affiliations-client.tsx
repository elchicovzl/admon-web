/**
 * Archived Affiliations Client Component
 * Displays archived affiliations on the shared server-driven data table
 * shell — server-side search, sorting and pagination via the URL.
 */

'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { ColumnDef, ColumnPinningState } from '@tanstack/react-table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Send, Eye } from 'lucide-react'
import { SentEmailViewer } from '@/components/dashboard/affiliations/sent-email-viewer'
import { TypeBadge } from '@/components/dashboard/affiliations/status-badge'
import { ServerDataTable } from '@/components/dashboard/data-table/server-data-table'
import { useDebouncedUrlParam, useTableUrlParams } from '@/components/dashboard/data-table/use-table-url-params'
import type {
  AffiliationWithRelations,
  ArchivedAffiliationsPage,
  ArchivedSortBy,
} from '@/lib/types/affiliation.types'

const STORAGE_KEY = 'archived-affiliations-table-v1'
const SORTABLE_COLUMNS: Set<string> = new Set(['process', 'client', 'sentAt', 'sentBy'])
const SORT_COLUMN_MAP: Record<string, ArchivedSortBy> = {
  process: 'affiliationNumber',
  client: 'client',
  sentAt: 'sentAt',
  sentBy: 'sentBy',
}
const DEFAULT_COLUMN_PINNING: ColumnPinningState = { left: ['process'], right: [] }

type Row_ = AffiliationWithRelations

interface ArchivedAffiliationsClientProps {
  initialPage: ArchivedAffiliationsPage
}

export function ArchivedAffiliationsClient({ initialPage }: ArchivedAffiliationsClientProps) {
  const { searchParams, updateUrl, isPending } = useTableUrlParams()

  // URL-driven filter/sort values
  const q = searchParams.get('q') ?? ''
  const sortBy = searchParams.get('sortBy') ?? ''
  const sortDir = (searchParams.get('sortDir') as 'asc' | 'desc' | null) ?? 'desc'

  const [qInput, setQInput] = useDebouncedUrlParam('q', updateUrl, q)

  const columns = useMemo<ColumnDef<Row_>[]>(
    () => [
      {
        id: 'process',
        header: 'Proceso',
        cell: ({ row }) => (
          <span className="font-mono text-xs font-semibold">{row.original.affiliationNumber}</span>
        ),
        size: 110,
      },
      {
        id: 'client',
        header: 'Cliente',
        cell: ({ row }) => (
          <span
            className="text-sm font-medium truncate block max-w-[220px]"
            title={row.original.client?.fullName}
          >
            {row.original.client?.fullName ?? 'Sin nombre'}
          </span>
        ),
        size: 220,
      },
      {
        id: 'identification',
        header: 'Identificación',
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.client?.identificationType} {row.original.client?.identificationNumber}
          </span>
        ),
        size: 160,
      },
      {
        id: 'sentAt',
        header: 'Fecha de Envío',
        cell: ({ row }) => {
          const sentAt = row.original.sentAt
          if (!sentAt) return <span className="text-xs text-muted-foreground">N/A</span>
          return (
            <div className="flex flex-col">
              <span className="text-xs font-medium">{format(new Date(sentAt), 'd MMM yyyy', { locale: es })}</span>
              <span className="text-[10px] text-muted-foreground">
                {format(new Date(sentAt), 'HH:mm', { locale: es })}
              </span>
            </div>
          )
        },
        size: 130,
      },
      {
        id: 'sentBy',
        header: 'Enviada Por',
        cell: ({ row }) => {
          const sentBy = row.original.sentBy
          if (!sentBy) return <span className="text-xs text-muted-foreground">N/A</span>
          return (
            <div className="flex flex-col">
              <span className="text-xs font-medium">{sentBy.name ?? 'Sin nombre'}</span>
              <span className="text-[10px] text-muted-foreground">{sentBy.email}</span>
            </div>
          )
        },
        size: 180,
      },
      {
        id: 'subProcesses',
        header: 'Sub-Procesos',
        cell: ({ row }) => {
          const subs = row.original.subProcesses
          if (!subs || subs.length === 0) {
            return <span className="text-xs text-muted-foreground">Sin sub-procesos</span>
          }
          return (
            <div className="flex flex-wrap gap-1">
              {subs.map((sp) => (
                <TypeBadge key={sp.id} type={sp.type} className="text-[10px]" />
              ))}
            </div>
          )
        },
        size: 220,
      },
      {
        id: 'actions',
        header: 'Acciones',
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-2">
            <SentEmailViewer affiliationId={row.original.id} />
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/affiliations/${row.original.id}/send?resend=1`}>
                <Send className="h-4 w-4 mr-1" />
                Reenviar
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/affiliations/${row.original.id}`}>
                <Eye className="h-4 w-4 mr-1" />
                Ver Detalles
              </Link>
            </Button>
          </div>
        ),
        size: 260,
      },
    ],
    []
  )

  function clearAllFilters() {
    updateUrl({ q: undefined })
  }

  const activeFilters = q ? 1 : 0

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
      title="Afiliaciones Archivadas"
      description="Vista tipo Excel — pineá columnas, scroll horizontal, filtros y paginación"
      activeFilterCount={activeFilters}
      onClearFilters={clearAllFilters}
      emptyMessage="No hay afiliaciones archivadas"
      emptyFilteredMessage="No hay resultados para tu búsqueda"
      toolbar={
        <Input
          placeholder="Buscar por proceso, nombre o identificación..."
          title="Busca por número de proceso, nombre o identificación (NIT, RUT, cédula) del cliente o del empleado"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          className="h-9 w-full sm:w-[320px]"
        />
      }
    />
  )
}
