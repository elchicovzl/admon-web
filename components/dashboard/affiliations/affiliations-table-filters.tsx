/**
 * Affiliations Table Filters Component
 * Inline filter bar for the affiliations list view
 */

'use client'

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
import { Search, X } from 'lucide-react'
import {
  AffiliationProcessType,
  AffiliationSubProcessType,
} from '@prisma/client'
import {
  AffiliationProcessTypeLabels,
  AffiliationGlobalStatusLabels,
  SubProcessTypeLabels,
  type AffiliationGlobalStatus,
} from '@/lib/types/affiliation.types'

export interface AffiliationTableFilters {
  searchQuery: string
  selectedProcessType: AffiliationProcessType | null
  selectedSubProcessTypes: AffiliationSubProcessType[]
  selectedStatus: AffiliationGlobalStatus | null
}

interface AffiliationTableFiltersProps {
  filters: AffiliationTableFilters
  onFiltersChange: (filters: AffiliationTableFilters) => void
}

export function AffiliationTableFiltersBar({
  filters,
  onFiltersChange,
}: AffiliationTableFiltersProps) {
  const hasActiveFilters =
    filters.searchQuery ||
    filters.selectedProcessType ||
    filters.selectedSubProcessTypes.length > 0 ||
    filters.selectedStatus

  const handleClearFilters = () => {
    onFiltersChange({
      searchQuery: '',
      selectedProcessType: null,
      selectedSubProcessTypes: [],
      selectedStatus: null,
    })
  }

  const handleSubProcessTypeToggle = (type: AffiliationSubProcessType) => {
    const newTypes = filters.selectedSubProcessTypes.includes(type)
      ? filters.selectedSubProcessTypes.filter((t) => t !== type)
      : [...filters.selectedSubProcessTypes, type]
    onFiltersChange({ ...filters, selectedSubProcessTypes: newTypes })
  }

  const processTypes = Object.values(AffiliationProcessType)
  const subProcessTypes = Object.values(AffiliationSubProcessType)
  const globalStatuses: AffiliationGlobalStatus[] = ['not_started', 'in_progress', 'completed']

  return (
    <div className="space-y-3">
      {/* Main filter row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por proceso, empresa, empleado o identificación..."
            value={filters.searchQuery}
            onChange={(e) =>
              onFiltersChange({ ...filters, searchQuery: e.target.value })
            }
            className="pl-8"
          />
        </div>

        {/* Process Type select */}
        <Select
          value={filters.selectedProcessType || 'all'}
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              selectedProcessType: value === 'all' ? null : (value as AffiliationProcessType),
            })
          }
        >
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="Tipo de Proceso" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {processTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {AffiliationProcessTypeLabels[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status select */}
        <Select
          value={filters.selectedStatus || 'all'}
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              selectedStatus: value === 'all' ? null : (value as AffiliationGlobalStatus),
            })
          }
        >
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {globalStatuses.map((status) => (
              <SelectItem key={status} value={status}>
                {AffiliationGlobalStatusLabels[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Clear filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="shrink-0 text-muted-foreground"
          >
            <X className="mr-1 h-4 w-4" />
            Limpiar
          </Button>
        )}
      </div>

      {/* Sub-process type badges */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Sub-procesos:</span>
        {subProcessTypes.map((type) => {
          const isSelected = filters.selectedSubProcessTypes.includes(type)
          return (
            <Badge
              key={type}
              variant={isSelected ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => handleSubProcessTypeToggle(type)}
            >
              {SubProcessTypeLabels[type]}
            </Badge>
          )
        })}
      </div>
    </div>
  )
}
