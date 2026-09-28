'use client'

import type { Table as ReactTableInstance } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Settings2 } from 'lucide-react'

interface ColumnVisibilityMenuProps<TData> {
  table: ReactTableInstance<TData>
  onReset: () => void
}

export function ColumnVisibilityMenu<TData>({ table, onReset }: ColumnVisibilityMenuProps<TData>) {
  return (
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
        <DropdownMenuItem onClick={onReset}>Restaurar predeterminado</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
