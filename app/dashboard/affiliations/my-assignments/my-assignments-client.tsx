'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  ColumnDef,
  ColumnOrderState,
  ColumnPinningState,
  flexRender,
  getCoreRowModel,
  Row,
  useReactTable,
  VisibilityState,
} from '@tanstack/react-table'
import { format, differenceInCalendarDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CheckCircle2,
  Circle,
  Loader2,
  MoreHorizontal,
  Pin,
  PinOff,
  Settings2,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { StatusBadge, TypeBadge } from '@/components/dashboard/affiliations/status-badge'
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

const STORAGE_KEY = 'my-assignments-table-v2'
const DEFAULT_PAGE_SIZE = 25
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200]
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

type Row_ = AffiliationSubProcessWithRelations

interface MyAssignmentsClientProps {
  initialPage: MyAssignmentsPage
  currentUserId?: string
  currentUserRole?: string
}

interface PersistedState {
  columnOrder?: ColumnOrderState
  columnPinning?: ColumnPinningState
  columnVisibility?: VisibilityState
  pageSize?: number
}

function loadPersisted(): PersistedState {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PersistedState) : {}
  } catch {
    return {}
  }
}

function savePersisted(state: PersistedState) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore
  }
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
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const data = initialPage.data
  const total = initialPage.total
  const page = initialPage.page
  const pageSize = initialPage.pageSize
  const totalPages = initialPage.totalPages

  // URL-driven filter/sort values
  const company = searchParams.get('company') ?? ''
  const employee = searchParams.get('employee') ?? ''
  const processType = searchParams.get('processType') ?? '__all__'
  const subProcess = searchParams.get('subProcess') ?? '__all__'
  const status = searchParams.get('status') ?? '__all__'
  const sortBy = searchParams.get('sortBy') ?? ''
  const sortDir = (searchParams.get('sortDir') as 'asc' | 'desc' | null) ?? 'desc'

  // Local input state for debounced text filters
  const [companyInput, setCompanyInput] = useState(company)
  const [employeeInput, setEmployeeInput] = useState(employee)

  // Sync input state with URL when URL changes externally
  useEffect(() => setCompanyInput(company), [company])
  useEffect(() => setEmployeeInput(employee), [employee])

  // Persisted column UI state
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([])
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>({ left: ['process'], right: [] })
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const persisted = loadPersisted()
    if (persisted.columnOrder?.length) setColumnOrder(persisted.columnOrder)
    if (persisted.columnPinning) setColumnPinning(persisted.columnPinning)
    if (persisted.columnVisibility) setColumnVisibility(persisted.columnVisibility)
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    const prev = loadPersisted()
    savePersisted({ ...prev, columnOrder, columnPinning, columnVisibility })
  }, [columnOrder, columnPinning, columnVisibility, hydrated])

  // URL update helper. Resets page to 1 unless explicitly preserved.
  const updateUrl = useCallback(
    (patch: Record<string, string | undefined>, opts: { keepPage?: boolean } = {}) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === '' || v === '__all__') params.delete(k)
        else params.set(k, v)
      }
      if (!opts.keepPage) params.delete('page')
      const qs = params.toString()
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
      })
    },
    [pathname, router, searchParams]
  )

  // Debounce text filter writes to URL (350ms)
  const debouncedCompanyRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const debouncedEmployeeRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (companyInput === company) return
    if (debouncedCompanyRef.current) clearTimeout(debouncedCompanyRef.current)
    debouncedCompanyRef.current = setTimeout(() => updateUrl({ company: companyInput || undefined }), 350)
    return () => {
      if (debouncedCompanyRef.current) clearTimeout(debouncedCompanyRef.current)
    }
  }, [companyInput, company, updateUrl])
  useEffect(() => {
    if (employeeInput === employee) return
    if (debouncedEmployeeRef.current) clearTimeout(debouncedEmployeeRef.current)
    debouncedEmployeeRef.current = setTimeout(() => updateUrl({ employee: employeeInput || undefined }), 350)
    return () => {
      if (debouncedEmployeeRef.current) clearTimeout(debouncedEmployeeRef.current)
    }
  }, [employeeInput, employee, updateUrl])

  // Row navigation
  const navigateToRow = useCallback(
    (row: Row<Row_>) => {
      startTransition(() =>
        router.push(`/dashboard/affiliations/${row.original.affiliationId}/subprocess/${row.original.id}`)
      )
    },
    [router]
  )

  // Sort handler
  const handleSort = useCallback(
    (columnId: string) => {
      if (!SORTABLE_COLUMNS.has(columnId)) return
      const mapped = SORT_COLUMN_MAP[columnId]
      if (sortBy === mapped) {
        // Toggle direction; on second click going asc -> desc -> off
        if (sortDir === 'desc') updateUrl({ sortBy: mapped, sortDir: 'asc' })
        else updateUrl({ sortBy: undefined, sortDir: undefined })
      } else {
        updateUrl({ sortBy: mapped, sortDir: 'desc' })
      }
    },
    [sortBy, sortDir, updateUrl]
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

  const table = useReactTable({
    data,
    columns,
    state: {
      columnOrder,
      columnPinning,
      columnVisibility,
    },
    onColumnOrderChange: setColumnOrder,
    onColumnPinningChange: setColumnPinning,
    onColumnVisibilityChange: setColumnVisibility,
    manualPagination: true,
    manualFiltering: true,
    manualSorting: true,
    pageCount: totalPages,
    rowCount: total,
    getCoreRowModel: getCoreRowModel(),
  })

  // Initialize column order if empty
  useEffect(() => {
    if (columnOrder.length === 0 && hydrated) {
      setColumnOrder(columns.map((c) => c.id as string))
    }
  }, [hydrated, columnOrder.length, columns])

  function clearAllFilters() {
    updateUrl({
      company: undefined,
      employee: undefined,
      processType: undefined,
      subProcess: undefined,
      status: undefined,
    })
  }

  function resetTablePrefs() {
    setColumnOrder(columns.map((c) => c.id as string))
    setColumnPinning({ left: ['process'], right: [] })
    setColumnVisibility({})
  }

  function changePage(next: number) {
    const target = Math.min(totalPages, Math.max(1, next))
    if (target === page) return
    updateUrl({ page: String(target) }, { keepPage: true })
  }

  function changePageSize(next: string) {
    const size = parseInt(next, 10)
    if (Number.isNaN(size)) return
    const prev = loadPersisted()
    savePersisted({ ...prev, pageSize: size })
    updateUrl({ pageSize: String(size) })
  }

  const activeFilters =
    (company ? 1 : 0) +
    (employee ? 1 : 0) +
    (processType !== '__all__' ? 1 : 0) +
    (subProcess !== '__all__' ? 1 : 0) +
    (status !== '__all__' ? 1 : 0)

  // Apply persisted pageSize on first mount if URL doesn't have one
  useEffect(() => {
    if (!hydrated) return
    if (searchParams.get('pageSize')) return
    const persisted = loadPersisted()
    if (persisted.pageSize && persisted.pageSize !== pageSize) {
      updateUrl({ pageSize: String(persisted.pageSize) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated])

  const startRow = total === 0 ? 0 : (page - 1) * pageSize + 1
  const endRow = Math.min(page * pageSize, total)

  return (
    <Card className="relative w-full max-w-full overflow-hidden">
      {isPending && (
        <div className="absolute top-2 right-2 z-30 flex items-center gap-2 bg-card border shadow rounded-md px-3 py-1.5">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          <span className="text-xs font-medium">Cargando...</span>
        </div>
      )}

      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle>Tus Sub-procesos Asignados</CardTitle>
            <CardDescription>
              Vista tipo Excel — pineá columnas, scroll horizontal, filtros y paginación
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
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
                    className="capitalize"
                  >
                    {typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={resetTablePrefs}>Restaurar predeterminado</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* FILTERS */}
        <div className="flex flex-wrap gap-2 pt-4">
          <Input
            placeholder="Buscar empresa..."
            value={companyInput}
            onChange={(e) => setCompanyInput(e.target.value)}
            className="h-9 w-[200px]"
          />
          <Input
            placeholder="Buscar empleado..."
            value={employeeInput}
            onChange={(e) => setEmployeeInput(e.target.value)}
            className="h-9 w-[200px]"
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
          {activeFilters > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-9">
              <X className="mr-1 h-4 w-4" />
              Limpiar ({activeFilters})
            </Button>
          )}
          <Badge variant="secondary" className="ml-auto self-center">
            {total === 0 ? 'Sin resultados' : `${startRow}-${endRow} de ${total}`}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="overflow-hidden pt-4">
        <div className="rounded-md border overflow-x-auto relative w-full max-w-full mt-4">
          <Table style={{ minWidth: table.getTotalSize(), width: 'max-content' }}>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id}>
                  {hg.headers.map((header) => {
                    const isPinned = header.column.getIsPinned()
                    const sortable = SORTABLE_COLUMNS.has(header.column.id)
                    const mapped = SORT_COLUMN_MAP[header.column.id]
                    const activeSort = sortable && sortBy === mapped
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
                          'whitespace-nowrap text-xs font-semibold bg-muted/60 group',
                          isPinned === 'left' && 'shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]'
                        )}
                      >
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => sortable && handleSort(header.column.id)}
                            className={cn(
                              'flex items-center gap-1 truncate',
                              sortable && 'cursor-pointer hover:text-primary',
                              !sortable && 'cursor-default'
                            )}
                            disabled={!sortable}
                          >
                            <span className="truncate">{flexRender(header.column.columnDef.header, header.getContext())}</span>
                            {activeSort && (
                              sortDir === 'asc' ? (
                                <ArrowUp className="h-3 w-3" />
                              ) : (
                                <ArrowDown className="h-3 w-3" />
                              )
                            )}
                          </button>
                          {header.column.getCanPin() && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 opacity-0 group-hover:opacity-100 transition ml-auto"
                                >
                                  <MoreHorizontal className="h-3 w-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                {!isPinned ? (
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
              {table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={table.getAllLeafColumns().length} className="h-32 text-center text-muted-foreground">
                    {activeFilters > 0
                      ? 'No hay resultados para los filtros aplicados'
                      : 'No hay sub-procesos asignados'}
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => navigateToRow(row)}
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
                            isPinned === 'left' && 'bg-background shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]'
                          )}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* PAGINATION */}
        <div className="flex items-center justify-between flex-wrap gap-3 pt-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Filas por página</span>
            <Select value={String(pageSize)} onValueChange={changePageSize}>
              <SelectTrigger className="h-8 w-[80px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Página {page} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => changePage(1)}
              disabled={page <= 1 || isPending}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => changePage(page - 1)}
              disabled={page <= 1 || isPending}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => changePage(page + 1)}
              disabled={page >= totalPages || isPending}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => changePage(totalPages)}
              disabled={page >= totalPages || isPending}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
