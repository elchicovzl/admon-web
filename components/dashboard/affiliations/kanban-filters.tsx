/**
 * Kanban Filters Component
 * Filters for the Kanban board view
 */

'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Search, X, UserCheck } from 'lucide-react'
import { AffiliationSubProcessType } from '@prisma/client'
import { SubProcessTypeLabels } from '@/lib/types/affiliation.types'
import type { SafeUser } from '@/lib/types/auth.types'

export interface KanbanFilters {
  searchQuery: string
  selectedTypes: AffiliationSubProcessType[]
  selectedManagerId: string | null
  showOnlyMyProcesses: boolean
}

interface KanbanFiltersProps {
  filters: KanbanFilters
  managers: SafeUser[]
  currentUserId?: string
  onFiltersChange: (filters: KanbanFilters) => void
}

export function KanbanFilters({
  filters,
  managers,
  currentUserId,
  onFiltersChange,
}: KanbanFiltersProps) {
  const handleSearchChange = (value: string) => {
    onFiltersChange({ ...filters, searchQuery: value })
  }

  const handleTypeToggle = (type: AffiliationSubProcessType) => {
    const newTypes = filters.selectedTypes.includes(type)
      ? filters.selectedTypes.filter((t) => t !== type)
      : [...filters.selectedTypes, type]
    onFiltersChange({ ...filters, selectedTypes: newTypes })
  }

  const handleManagerChange = (value: string) => {
    onFiltersChange({
      ...filters,
      selectedManagerId: value === 'all' ? null : value,
      showOnlyMyProcesses: false, // Reset "my processes" filter
    })
  }

  const handleMyProcessesToggle = () => {
    onFiltersChange({
      ...filters,
      showOnlyMyProcesses: !filters.showOnlyMyProcesses,
      selectedManagerId: null, // Reset manager filter
    })
  }

  const handleClearFilters = () => {
    onFiltersChange({
      searchQuery: '',
      selectedTypes: [],
      selectedManagerId: null,
      showOnlyMyProcesses: false,
    })
  }

  const hasActiveFilters =
    filters.searchQuery ||
    filters.selectedTypes.length > 0 ||
    filters.selectedManagerId ||
    filters.showOnlyMyProcesses

  const processTypes = Object.values(AffiliationSubProcessType)

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Search by Client Name */}
          <div className="space-y-2">
            <Label htmlFor="search">Buscar Cliente</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Nombre del cliente..."
                value={filters.searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {/* Filter by Process Type */}
          <div className="space-y-2">
            <Label>Tipo de Proceso</Label>
            <div className="flex flex-wrap gap-2">
              {processTypes.map((type) => {
                const isSelected = filters.selectedTypes.includes(type)
                return (
                  <Badge
                    key={type}
                    variant={isSelected ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => handleTypeToggle(type)}
                  >
                    {SubProcessTypeLabels[type]}
                  </Badge>
                )
              })}
            </div>
          </div>

          {/* Filter by Manager */}
          <div className="space-y-2">
            <Label htmlFor="manager">Manager Asignado</Label>
            <Select
              value={filters.selectedManagerId || 'all'}
              onValueChange={handleManagerChange}
              disabled={filters.showOnlyMyProcesses}
            >
              <SelectTrigger id="manager">
                <SelectValue placeholder="Todos los managers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los managers</SelectItem>
                {managers.map((manager) => (
                  <SelectItem key={manager.id} value={manager.id}>
                    {manager.name || manager.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quick Filters & Clear */}
          <div className="space-y-2">
            <Label>Acciones Rápidas</Label>
            <div className="flex flex-col gap-2">
              {currentUserId && (
                <Button
                  variant={filters.showOnlyMyProcesses ? 'default' : 'outline'}
                  size="sm"
                  onClick={handleMyProcessesToggle}
                  className="w-full justify-start"
                >
                  <UserCheck className="mr-2 h-4 w-4" />
                  Mis Procesos
                </Button>
              )}
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  className="w-full justify-start text-muted-foreground"
                >
                  <X className="mr-2 h-4 w-4" />
                  Limpiar Filtros
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
