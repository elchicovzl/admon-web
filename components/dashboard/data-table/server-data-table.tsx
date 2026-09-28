'use client'

import { type ReactNode, useEffect, useState } from 'react'
import {
  type ColumnDef,
  type ColumnOrderState,
  type ColumnPinningState,
  type Row,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PaginatedResult } from '@/lib/types/pagination.types'
import { ColumnVisibilityMenu } from './column-visibility-menu'
import { SortableTableHead } from './sortable-table-head'
import { TablePaginationFooter } from './table-pagination-footer'
import type { UpdateUrlFn } from './use-table-url-params'

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200]
const DEFAULT_COLUMN_PINNING: ColumnPinningState = { left: [], right: [] }

interface PersistedTableState {
  columnOrder?: ColumnOrderState
  columnPinning?: ColumnPinningState
  columnVisibility?: VisibilityState
  pageSize?: number
}

function loadPersisted(storageKey: string): PersistedTableState {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(storageKey)
    return raw ? (JSON.parse(raw) as PersistedTableState) : {}
  } catch {
    return {}
  }
}

function savePersisted(storageKey: string, state: PersistedTableState) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(state))
  } catch {
    // ignore
  }
}

export interface ServerDataTableProps<TData> {
  columns: ColumnDef<TData>[]
  result: PaginatedResult<TData>
  /** localStorage key for column order/pinning/visibility/pageSize prefs. */
  storageKey: string
  updateUrl: UpdateUrlFn
  isPending: boolean
  sortBy?: string
  sortDir: 'asc' | 'desc'
  /** Column ids that support sorting. */
  sortableColumns: ReadonlySet<string>
  /** Column id -> `sortBy` URL value. */
  sortColumnMap: Record<string, string>
  title: ReactNode
  description?: ReactNode
  /** View-specific filter controls (inputs, selects, etc.). */
  toolbar?: ReactNode
  activeFilterCount?: number
  onClearFilters?: () => void
  emptyMessage: ReactNode
  /** Shown instead of `emptyMessage` when `activeFilterCount > 0`. */
  emptyFilteredMessage?: ReactNode
  pageSizeOptions?: number[]
  defaultColumnPinning?: ColumnPinningState
  onRowClick?: (row: Row<TData>) => void
  getRowClassName?: (row: Row<TData>) => string
}

export function ServerDataTable<TData>({
  columns,
  result,
  storageKey,
  updateUrl,
  isPending,
  sortBy,
  sortDir,
  sortableColumns,
  sortColumnMap,
  title,
  description,
  toolbar,
  activeFilterCount = 0,
  onClearFilters,
  emptyMessage,
  emptyFilteredMessage,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  defaultColumnPinning = DEFAULT_COLUMN_PINNING,
  onRowClick,
  getRowClassName,
}: ServerDataTableProps<TData>) {
  const { data, total, page, pageSize, totalPages } = result

  // Persisted column UI state
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([])
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>(defaultColumnPinning)
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const persisted = loadPersisted(storageKey)
    if (persisted.columnOrder?.length) setColumnOrder(persisted.columnOrder)
    if (persisted.columnPinning) setColumnPinning(persisted.columnPinning)
    if (persisted.columnVisibility) setColumnVisibility(persisted.columnVisibility)
    setHydrated(true)
  }, [storageKey])

  useEffect(() => {
    if (!hydrated) return
    const prev = loadPersisted(storageKey)
    savePersisted(storageKey, { ...prev, columnOrder, columnPinning, columnVisibility })
  }, [storageKey, columnOrder, columnPinning, columnVisibility, hydrated])

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

  // Apply persisted pageSize on first mount if the URL doesn't have one
  useEffect(() => {
    if (!hydrated) return
    const persisted = loadPersisted(storageKey)
    if (persisted.pageSize && persisted.pageSize !== pageSize) {
      updateUrl({ pageSize: String(persisted.pageSize) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated])

  function handleSort(columnId: string) {
    if (!sortableColumns.has(columnId)) return
    const mapped = sortColumnMap[columnId]
    if (sortBy === mapped) {
      // Toggle direction; on second click going asc -> desc -> off
      if (sortDir === 'desc') updateUrl({ sortBy: mapped, sortDir: 'asc' })
      else updateUrl({ sortBy: undefined, sortDir: undefined })
    } else {
      updateUrl({ sortBy: mapped, sortDir: 'desc' })
    }
  }

  function resetTablePrefs() {
    setColumnOrder(columns.map((c) => c.id as string))
    setColumnPinning(defaultColumnPinning)
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
    const prev = loadPersisted(storageKey)
    savePersisted(storageKey, { ...prev, pageSize: size })
    updateUrl({ pageSize: String(size) })
  }

  const hasActiveFilters = activeFilterCount > 0
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
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          <div className="flex items-center gap-2">
            <ColumnVisibilityMenu table={table} onReset={resetTablePrefs} />
          </div>
        </div>

        {/* FILTERS */}
        <div className="flex flex-wrap gap-2 pt-4">
          {toolbar}
          {hasActiveFilters && onClearFilters && (
            <Button variant="ghost" size="sm" onClick={onClearFilters} className="h-9">
              <X className="mr-1 h-4 w-4" />
              Limpiar ({activeFilterCount})
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
                    const sortable = sortableColumns.has(header.column.id)
                    const mapped = sortColumnMap[header.column.id]
                    const isActiveSort = sortable && sortBy === mapped
                    return (
                      <SortableTableHead
                        key={header.id}
                        header={header}
                        sortable={sortable}
                        isActiveSort={isActiveSort}
                        sortDir={sortDir}
                        onSort={handleSort}
                      />
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={table.getAllLeafColumns().length} className="h-32 text-center text-muted-foreground">
                    {hasActiveFilters ? emptyFilteredMessage ?? emptyMessage : emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className={cn(onRowClick && 'cursor-pointer hover:bg-muted/40', getRowClassName?.(row))}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
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

        <TablePaginationFooter
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          pageSizeOptions={pageSizeOptions}
          isPending={isPending}
          onPageChange={changePage}
          onPageSizeChange={changePageSize}
        />
      </CardContent>
    </Card>
  )
}
