'use client'

import { flexRender, type Header } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TableHead } from '@/components/ui/table'
import { ArrowDown, ArrowUp, MoreHorizontal, Pin, PinOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SortableTableHeadProps<TData, TValue> {
  header: Header<TData, TValue>
  sortable: boolean
  isActiveSort: boolean
  sortDir: 'asc' | 'desc'
  onSort: (columnId: string) => void
}

export function SortableTableHead<TData, TValue>({
  header,
  sortable,
  isActiveSort,
  sortDir,
  onSort,
}: SortableTableHeadProps<TData, TValue>) {
  const isPinned = header.column.getIsPinned()

  return (
    <TableHead
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
          onClick={() => sortable && onSort(header.column.id)}
          className={cn(
            'flex items-center gap-1 truncate',
            sortable && 'cursor-pointer hover:text-primary',
            !sortable && 'cursor-default'
          )}
          disabled={!sortable}
        >
          <span className="truncate">{flexRender(header.column.columnDef.header, header.getContext())}</span>
          {isActiveSort &&
            (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
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
}
