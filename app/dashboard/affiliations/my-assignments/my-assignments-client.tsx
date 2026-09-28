'use client'

import { useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { type ColumnDef, type ColumnPinningState, type Row } from '@tanstack/react-table'
import { format, differenceInCalendarDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StatusBadge, TypeBadge } from '@/components/dashboard/affiliations/status-badge'
import { ServerDataTable } from '@/components/dashboard/data-table/server-data-table'
import { useDebouncedUrlParam, useTableUrlParams } from '@/components/dashboard/data-table/use-table-url-params'
import {
  AffiliationProcessTypeLabels,
  SubProcessStatusLabels,
  SubProcessTypeLabels,
} from '@/lib/types/affiliation.types'
import type {
  AffiliationSubProcessWithRelations,
  MyAssignmentsPage,
  MyAssignmentsSortBy,
} from '@/lib/types/affiliation.types'
import {
  AffiliationProcessType,
  AffiliationSubProcessType,
} from '@prisma/client'
import { CheckCircle2, Circle } from 'lucide-react'

const STORAGE_KEY = 'my-assignments-table-v2'
const SORTABLE_COLUMNS: Set<string> = new Set([
  'startDate',
  'company',
  'employee',
  'subProcess',
  'status',
])
const SORT_COLUMN_MAP: Record<string, MyAssignmentsSortBy> = {
  startDate: 'startDate',
  company: 'company',
  employee: 'employee',
  subProcess: 'subProcess',
  status: 'status',
}
const DEFAULT_COLUMN_PINNING: ColumnPinningState = { left: ['process'], right: [] }

type Row_ = AffiliationSubProcessWithRelations

interface MyAssignmentsClientProps {
  initialPage: MyAssignmentsPage
  currentUserId?: string
  currentUserRole?: string
}

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return '—'
  try {
    return format(new Date(d), 'd MMM yyyy', { locale: es })
  } catch {
    return '—'
  }
}

function daysSince(d: Date | string | null | undefined) {
  if (!d) return null
  try {
    return Math.max(0, differenceInCalendarDays(new Date(), new Date(d)))
  } catch {
    return null
  }
}

function disabilityDays(start: Date | string | null | undefined, end: Date | string | null | undefined) {
  if (!start || !end) return null
  try {
    return Math.max(1, differenceInCalendarDays(new Date(end), new Date(start)) + 1)
  } catch {
    return null
  }
}

function CheckCell({ value }: { value: boolean }) {
  return value ? (
    <CheckCircle2 className="h-4 w-4 text-green-600" />
  ) : (
    <Circle className="h-4 w-4 text-muted-foreground/50" />
  )
}

export function MyAssignmentsClient({ initialPage }: MyAssignmentsClientProps) {
  const router = useRouter()
  const { searchParams, updateUrl, isPending, startTransition } = useTableUrlParams()

  // URL-driven filter/sort values
  const q = searchParams.get('q') ?? ''
  const processType = searchParams.get('processType') ?? '__all__'
  const subProcess = searchParams.get('subProcess') ?? '__all__'
  const status = searchParams.get('status') ?? '__all__'
  const sortBy = searchParams.get('sortBy') ?? ''
  const sortDir = (searchParams.get('sortDir') as 'asc' | 'desc' | null) ?? 'desc'

  const [qInput, setQInput] = useDebouncedUrlParam('q', updateUrl, q)

  // Row navigation
  const navigateToRow = useCallback(
    (row: Row<Row_>) => {
      startTransition(() =>
        router.push(`/dashboard/affiliations/${row.original.affiliationId}/subprocess/${row.original.id}`)
      )
    },
    [router, startTransition]
  )

  const columns = useMemo<ColumnDef<Row_>[]>(
    () => [
      {
        id: 'process',
        header: 'Proceso',
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            #{row.original.affiliation?.affiliationNumber ?? '—'}
          </span>
        ),
        size: 110,
      },
      {
        id: 'startDate',
        header: 'Fecha Inicio',
        cell: ({ row }) => <span className="text-xs">{fmtDate(row.original.affiliation?.startDate)}</span>,
        size: 120,
      },
      {
        id: 'processType',
        header: 'Tipo de Proceso',
        cell: ({ row }) => {
          const pt = row.original.affiliation?.processType
          const other = row.original.affiliation?.processTypeOther
          const label = pt ? AffiliationProcessTypeLabels[pt as AffiliationProcessType] : other ?? '—'
          return <span className="text-xs">{label}</span>
        },
        size: 200,
      },
      {
        id: 'company',
        header: 'Empresa',
        cell: ({ row }) => (
          <span
            className="text-sm font-medium truncate block max-w-[220px]"
            title={row.original.affiliation?.client?.fullName}
          >
            {row.original.affiliation?.client?.fullName ?? '—'}
          </span>
        ),
        size: 220,
      },
      {
        id: 'employee',
        header: 'Empleado',
        cell: ({ row }) => (
          <span className="text-sm truncate block max-w-[200px]" title={row.original.employee?.fullName ?? undefined}>
            {row.original.employee?.fullName ?? <span className="text-muted-foreground italic">—</span>}
          </span>
        ),
        size: 200,
      },
      {
        id: 'subProcess',
        header: 'Sub-proceso',
        cell: ({ row }) => <TypeBadge type={row.original.type} className="text-xs" />,
        size: 130,
      },
      {
        id: 'status',
        header: 'Estado',
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
        size: 140,
      },
      {
        id: 'daysOpen',
        header: 'Días en proceso',
        cell: ({ row }) => {
          const d = daysSince(row.original.affiliation?.startDate ?? row.original.createdAt)
          return <span className="text-xs">{d ?? '—'}</span>
        },
        size: 110,
      },
      {
        id: 'disStart',
        header: 'Inicio incap.',
        cell: ({ row }) =>
          row.original.type === AffiliationSubProcessType.INCAPACIDADES ? (
            <span className="text-xs">{fmtDate(row.original.disabilityStartDate)}</span>
          ) : (
            <span className="text-xs text-muted-foreground/40">—</span>
          ),
        size: 120,
      },
      {
        id: 'disEnd',
        header: 'Fin incap.',
        cell: ({ row }) =>
          row.original.type === AffiliationSubProcessType.INCAPACIDADES ? (
            <span className="text-xs">{fmtDate(row.original.disabilityEndDate)}</span>
          ) : (
            <span className="text-xs text-muted-foreground/40">—</span>
          ),
        size: 120,
      },
      {
        id: 'disDays',
        header: 'Días incap.',
        cell: ({ row }) => {
          if (row.original.type !== AffiliationSubProcessType.INCAPACIDADES) {
            return <span className="text-xs text-muted-foreground/40">—</span>
          }
          const d = disabilityDays(row.original.disabilityStartDate, row.original.disabilityEndDate)
          return <span className="text-xs">{d ?? '—'}</span>
        },
        size: 100,
      },
      {
        id: 'bankRegistry',
        header: 'Reg. Banco',
        cell: ({ row }) =>
          row.original.type === AffiliationSubProcessType.INCAPACIDADES ? (
            <CheckCell value={row.original.bankRegistry} />
          ) : (
            <span className="text-xs text-muted-foreground/40">—</span>
          ),
        size: 110,
      },
      {
        id: 'transcription',
        header: 'Transcripción',
        cell: ({ row }) =>
          row.original.type === AffiliationSubProcessType.INCAPACIDADES ? (
            <CheckCell value={row.original.transcription} />
          ) : (
            <span className="text-xs text-muted-foreground/40">—</span>
          ),
        size: 120,
      },
      {
        id: 'collection',
        header: 'Cobro',
        cell: ({ row }) =>
          row.original.type === AffiliationSubProcessType.INCAPACIDADES ? (
            <CheckCell value={row.original.collection} />
          ) : (
            <span className="text-xs text-muted-foreground/40">—</span>
          ),
        size: 90,
      },
    ],
    []
  )

  function clearAllFilters() {
    updateUrl({
      q: undefined,
      processType: undefined,
      subProcess: undefined,
      status: undefined,
    })
  }

  const activeFilters =
    (q ? 1 : 0) +
    (processType !== '__all__' ? 1 : 0) +
    (subProcess !== '__all__' ? 1 : 0) +
    (status !== '__all__' ? 1 : 0)

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
      title="Tus Sub-procesos Asignados"
      description="Vista tipo Excel — pineá columnas, scroll horizontal, filtros y paginación"
      activeFilterCount={activeFilters}
      onClearFilters={clearAllFilters}
      emptyMessage="No hay sub-procesos asignados"
      emptyFilteredMessage="No hay resultados para los filtros aplicados"
      onRowClick={navigateToRow}
      toolbar={
        <>
          <Input
            placeholder="Buscar por nombre o identificación..."
            title="Busca por nombre o identificación (NIT, RUT, cédula) de la empresa, el independiente o el empleado"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            className="h-9 w-full sm:w-[320px]"
          />
          <Select value={processType} onValueChange={(v) => updateUrl({ processType: v })}>
            <SelectTrigger className="h-9 w-[200px]">
              <SelectValue placeholder="Tipo de proceso" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos los tipos</SelectItem>
              {Object.entries(AffiliationProcessTypeLabels).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={subProcess} onValueChange={(v) => updateUrl({ subProcess: v })}>
            <SelectTrigger className="h-9 w-[170px]">
              <SelectValue placeholder="Sub-proceso" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos los sub-procesos</SelectItem>
              {Object.entries(SubProcessTypeLabels).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => updateUrl({ status: v })}>
            <SelectTrigger className="h-9 w-[170px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos los estados</SelectItem>
              {Object.entries(SubProcessStatusLabels).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      }
    />
  )
}
