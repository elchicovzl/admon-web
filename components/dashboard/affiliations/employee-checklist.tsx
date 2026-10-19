'use client'

import { useMemo, useState } from 'react'
import { Check, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { filterEmployeesByQuery } from '@/lib/utils/employee-search'

export interface ChecklistEmployee {
  id: string
  fullName: string
  identificationType: string
  identificationNumber: string
}

interface EmployeeChecklistProps {
  employees: ChecklistEmployee[]
  selectedIds: string[]
  onToggle: (employeeId: string) => void
  /** Receives the ids currently visible (after filtering). */
  onToggleAll: (visibleIds: string[]) => void
}

export function EmployeeChecklist({
  employees,
  selectedIds,
  onToggle,
  onToggleAll,
}: EmployeeChecklistProps) {
  const [query, setQuery] = useState('')

  const visible = useMemo(
    () => filterEmployeesByQuery(employees, query),
    [employees, query]
  )
  const visibleIds = visible.map((e) => e.id)
  // Count only ids still in the list; a selection can outlive its employee
  const selectedCount = employees.filter((e) => selectedIds.includes(e.id)).length
  const allVisibleSelected =
    visible.length > 0 && visible.every((e) => selectedIds.includes(e.id))

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Seleccionar empleados</label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto py-1 px-2 text-xs"
          disabled={visible.length === 0}
          onClick={() => onToggleAll(visibleIds)}
        >
          {allVisibleSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}
        </Button>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            // Avoid submitting the surrounding form when pressing Enter
            if (e.key === 'Enter') e.preventDefault()
          }}
          placeholder="Buscar empleado por nombre o identificación…"
          className="h-8 pl-8 text-sm"
        />
      </div>
      <div className="max-h-40 overflow-y-auto rounded-md border p-2 space-y-1">
        {visible.length === 0 ? (
          <p className="px-2 py-3 text-center text-sm text-muted-foreground">
            Ningún empleado coincide
          </p>
        ) : (
          visible.map((employee) => {
            const isChecked = selectedIds.includes(employee.id)
            return (
              <div
                key={employee.id}
                className={cn(
                  'flex items-center space-x-2 rounded-sm px-2 py-1.5 cursor-pointer hover:bg-muted/50',
                  isChecked && 'bg-muted/30'
                )}
                onClick={() => onToggle(employee.id)}
              >
                <div
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border',
                    isChecked ? 'bg-primary border-primary' : 'border-input'
                  )}
                >
                  {isChecked && <Check className="h-3 w-3 text-primary-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{employee.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    {employee.identificationType} {employee.identificationNumber}
                  </p>
                </div>
              </div>
            )
          })
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {selectedCount} de {employees.length} seleccionados
      </p>
    </div>
  )
}
