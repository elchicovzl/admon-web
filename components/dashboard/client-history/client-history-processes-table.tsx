'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ColumnDef,
  ColumnPinningState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { format, differenceInCalendarDays } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  AffiliationProcessType,
  AffiliationSubProcessType,
  AffiliationStatus,
  AffiliationSubProcessStatus,
} from '@prisma/client'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Circle,
  FileText,
  MoreHorizontal,
  Pin,
  PinOff,
  Settings2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { StatusBadge, TypeBadge } from '@/components/dashboard/affiliations/status-badge'
import { AffiliationProcessTypeLabels, AffiliationStatusLabels } from '@/lib/types/affiliation.types'
import type { HistoryAffiliation } from '@/lib/types/client-history.types'

const STORAGE_KEY = 'client-history-processes-table-v1'

interface ProcessRow {
  subProcessId: string
  affiliationId: string
  affiliationNumber: string
  processType: AffiliationProcessType | null
  processTypeOther: string | null
  startDate: Date | null
  affiliationStatus: AffiliationStatus
  type: AffiliationSubProcessType
  status: AffiliationSubProcessStatus
  createdAt: Date
  assignedTo: string | null
  employee: string | null
  disabilityStartDate: Date | null
  disabilityEndDate: Date | null
  bankRegistry: boolean
  transcription: boolean
  collection: boolean
  docsCount: number
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

function disabilityDays(
  start: Date | string | null | undefined,
  end: Date | string | null | undefined
) {
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

function flattenRows(affiliations: HistoryAffiliation[]): ProcessRow[] {
  return affiliations.flatMap((aff) =>
    aff.subProcesses.map((sp) => ({
      subProcessId: sp.id,
      affiliationId: aff.id,
      affiliationNumber: aff.affiliationNumber,
      processType: aff.processType,
      processTypeOther: aff.processTypeOther,
      startDate: aff.startDate,
      affiliationStatus: aff.status,
      type: sp.type,
      status: sp.status,
      createdAt: sp.createdAt,
      assignedTo: sp.assignedTo?.name || sp.assignedTo?.email || null,
      employee: sp.employee?.fullName || null,
      disabilityStartDate: sp.disabilityStartDate,
      disabilityEndDate: sp.disabilityEndDate,
      bankRegistry: sp.bankRegistry,
      transcription: sp.transcription,
      collection: sp.collection,
      docsCount: sp.documents.length,
    }))
  )
}

interface ClientHistoryProcessesTableProps {
  affiliations: HistoryAffiliation[]
}

export function ClientHistoryProcessesTable({
  affiliations,
}: ClientHistoryProcessesTableProps) {
  const router = useRouter()
  const data = useMemo(() => flattenRows(affiliations), [affiliations])

  const [sorting, setSorting] = useState<SortingState>([])
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>({
    left: ['process'],
    right: [],
  })
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [hydrated, setHydrated] = useState(false)

  // Restore persisted column prefs
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as {
          columnPinning?: ColumnPinningState
          columnVisibility?: VisibilityState
        }
        if (parsed.columnPinning) setColumnPinning(parsed.columnPinning)
        if (parsed.columnVisibility) setColumnVisibility(parsed.columnVisibility)
      }
    } catch {
      // ignore
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ columnPinning, columnVisibility })
      )
    } catch {
      // ignore
    }
  }, [columnPinning, columnVisibility, hydrated])

  const columns = useMemo<ColumnDef<ProcessRow>[]>(
    () => [
      {
        id: 'process',
        header: 'Proceso',
        accessorFn: (r) => r.affiliationNumber,
        cell: ({ row }) => (
          <span className="font-mono text-xs">#{row.original.affiliationNumber}</span>
        ),
        size: 110,
      },
      {
        id: 'startDate',
        header: 'Fecha Inicio',
        accessorFn: (r) => (r.startDate ? new Date(r.startDate).getTime() : 0),
        cell: ({ row }) => <span className="text-xs">{fmtDate(row.original.startDate)}</span>,
        size: 120,
      },
      {
        id: 'processType',
        header: 'Tipo de Proceso',
        accessorFn: (r) =>
          r.processType ? AffiliationProcessTypeLabels[r.processType] : r.processTypeOther ?? '',
        cell: ({ row }) => {
          const { processType, processTypeOther } = row.original
          const label = processType
            ? AffiliationProcessTypeLabels[processType]
            : processTypeOther ?? '—'
          return <span className="text-xs">{label}</span>
        },
        size: 210,
      },
      {
        id: 'affiliationStatus',
        header: 'Estado Proceso',
        accessorFn: (r) => r.affiliationStatus,
        cell: ({ row }) => (
          <Badge variant="secondary" className="text-xs">
            {AffiliationStatusLabels[row.original.affiliationStatus]}
          </Badge>
        ),
        size: 130,
      },
      {
        id: 'subProcess',
        header: 'Sub-proceso',
        accessorFn: (r) => r.type,
        cell: ({ row }) => <TypeBadge type={row.original.type} className="text-xs" />,
        size: 130,
      },
      {
        id: 'status',
        header: 'Estado',
        accessorFn: (r) => r.status,
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
        size: 150,
      },
      {
        id: 'employee',
        header: 'Empleado',
        accessorFn: (r) => r.employee ?? '',
        cell: ({ row }) => (
          <span className="block max-w-[200px] truncate text-sm" title={row.original.employee ?? undefined}>
            {row.original.employee ?? <span className="italic text-muted-foreground">—</span>}
          </span>
        ),
        size: 190,
      },
      {
        id: 'assignedTo',
        header: 'Asignado a',
        accessorFn: (r) => r.assignedTo ?? '',
        cell: ({ row }) => (
          <span className="block max-w-[180px] truncate text-sm" title={row.original.assignedTo ?? undefined}>
            {row.original.assignedTo ?? <span className="italic text-muted-foreground">—</span>}
          </span>
        ),
        size: 180,
      },
      {
        id: 'daysOpen',
        header: 'Días en proceso',
        accessorFn: (r) => daysSince(r.startDate ?? r.createdAt) ?? 0,
        cell: ({ row }) => {
          const d = daysSince(row.original.startDate ?? row.original.createdAt)
          return <span className="text-xs">{d ?? '—'}</span>
        },
        size: 120,
      },
      {
        id: 'docs',
        header: 'Documentos',
        accessorFn: (r) => r.docsCount,
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1 text-xs">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            {row.original.docsCount}
          </span>
        ),
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

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnPinning, columnVisibility },
    onSortingChange: setSorting,
    onColumnPinningChange: setColumnPinning,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  function resetTablePrefs() {
    setColumnPinning({ left: ['process'], right: [] })
    setColumnVisibility({})
    setSorting([])
  }

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
        Este cliente no tiene procesos registrados.
      </div>
    )
  }

  return (
    <div className="w-full max-w-full space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Badge variant="secondary">
          {data.length} sub-proceso{data.length === 1 ? '' : 's'} · {affiliations.length} proceso
          {affiliations.length === 1 ? '' : 's'}
        </Badge>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Settings2 className="mr-2 h-4 w-4" />
              Columnas
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Mostrar columnas</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table.getAllLeafColumns().map((col) => (
              <DropdownMenuCheckboxItem
                key={col.id}
                checked={col.getIsVisible()}
                onCheckedChange={(v) => col.toggleVisibility(!!v)}
              >
                {typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={resetTablePrefs}>Restaurar predeterminado</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="relative mt-2 w-full max-w-full overflow-x-auto rounded-md border">
        <Table style={{ minWidth: table.getTotalSize(), width: 'max-content' }}>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => {
                  const isPinned = header.column.getIsPinned()
                  const canSort = header.column.getCanSort()
                  const sortDir = header.column.getIsSorted()
                  return (
                    <TableHead
                      key={header.id}
                      style={{
                        width: header.getSize(),
                        ...(isPinned === 'left' && {
                          position: 'sticky',
                          left: header.column.getStart('left'),
                          zIndex: 20,
                        }),
                      }}
                      className={cn(
                        'group whitespace-nowrap bg-muted/60 text-xs font-semibold',
                        isPinned === 'left' && 'shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]'
                      )}
                    >
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn(
                            'flex items-center gap-1 truncate',
                            canSort ? 'cursor-pointer hover:text-primary' : 'cursor-default'
                          )}
                          disabled={!canSort}
                        >
                          <span className="truncate">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </span>
                          {sortDir === 'asc' && <ArrowUp className="h-3 w-3" />}
                          {sortDir === 'desc' && <ArrowDown className="h-3 w-3" />}
                        </button>
                        {header.column.getCanPin() && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="ml-auto h-5 w-5 opacity-0 transition group-hover:opacity-100"
                              >
                                <MoreHorizontal className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                              {isPinned !== 'left' ? (
                                <DropdownMenuItem onClick={() => header.column.pin('left')}>
                                  <Pin className="mr-2 h-4 w-4" />
                                  Pinear a la izquierda
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => header.column.pin(false)}>
                                  <PinOff className="mr-2 h-4 w-4" />
                                  Quitar pin
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => header.column.toggleVisibility(false)}>
                                Ocultar columna
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className="cursor-pointer hover:bg-muted/40"
                onClick={() =>
                  router.push(
                    `/dashboard/affiliations/${row.original.affiliationId}/subprocess/${row.original.subProcessId}`
                  )
                }
              >
                {row.getVisibleCells().map((cell) => {
                  const isPinned = cell.column.getIsPinned()
                  return (
                    <TableCell
                      key={cell.id}
                      style={{
                        width: cell.column.getSize(),
                        ...(isPinned === 'left' && {
                          position: 'sticky',
                          left: cell.column.getStart('left'),
                          zIndex: 10,
                        }),
                      }}
                      className={cn(
                        'whitespace-nowrap',
                        isPinned === 'left' &&
                          'bg-background shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]'
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
