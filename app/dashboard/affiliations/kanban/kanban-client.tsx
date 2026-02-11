/**
 * Kanban Client Component
 * Main Kanban board for affiliations sub-processes
 */

'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { KanbanColumn } from '@/components/dashboard/affiliations/kanban-column'
import { KanbanFilters, type KanbanFilters as KanbanFiltersType } from '@/components/dashboard/affiliations/kanban-filters'
import { SubProcessKanbanCard } from '@/components/dashboard/affiliations/subprocess-kanban-card'
import {
  DndContext,
  DragOverlay,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { AffiliationSubProcessStatus } from '@prisma/client'
import type { SubProcessKanbanItem } from '@/lib/types/affiliation.types'
import type { SafeUser } from '@/lib/types/auth.types'
import { updateSubProcessStatus } from '@/lib/actions/affiliation.actions'
import { toast } from 'sonner'

interface KanbanClientProps {
  initialSubProcesses: SubProcessKanbanItem[]
  managers: SafeUser[]
  currentUserId?: string
  currentUserRole?: string
}

export function KanbanClient({
  initialSubProcesses,
  managers,
  currentUserId,
  currentUserRole,
}: KanbanClientProps) {
  const [subProcesses, setSubProcesses] = useState<SubProcessKanbanItem[]>(initialSubProcesses)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [filters, setFilters] = useState<KanbanFiltersType>({
    searchQuery: '',
    selectedTypes: [],
    selectedManagerId: null,
    showOnlyMyProcesses: false,
  })

  // Configure drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts
      },
    }),
    useSensor(KeyboardSensor)
  )

  // Filter sub-processes based on active filters
  const filteredSubProcesses = useMemo(() => {
    return subProcesses.filter((sp) => {
      // Filter by search query (client name)
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase()
        if (!sp.client.fullName.toLowerCase().includes(query)) {
          return false
        }
      }

      // Filter by process type
      if (filters.selectedTypes.length > 0) {
        if (!filters.selectedTypes.includes(sp.type)) {
          return false
        }
      }

      // Filter by manager
      if (filters.selectedManagerId) {
        if (sp.assignedTo?.id !== filters.selectedManagerId) {
          return false
        }
      }

      // Filter "My Processes"
      if (filters.showOnlyMyProcesses && currentUserId) {
        if (sp.assignedTo?.id !== currentUserId) {
          return false
        }
      }

      return true
    })
  }, [subProcesses, filters, currentUserId])

  // Group filtered sub-processes by status
  const groupedByStatus = useMemo(() => {
    const groups: Record<AffiliationSubProcessStatus, SubProcessKanbanItem[]> = {
      NOT_STARTED: [],
      IN_PROGRESS: [],
      IN_REVIEW: [],
      COMPLETED: [],
      RETURNED: [],
    }

    filteredSubProcesses.forEach((sp) => {
      // Only add sub-processes with valid kanban statuses (exclude PENDING_SUPPORT)
      if (groups[sp.status]) {
        groups[sp.status].push(sp)
      }
    })

    // Sort each group by creation date (oldest first for priority)
    Object.keys(groups).forEach((status) => {
      groups[status as AffiliationSubProcessStatus].sort((a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
    })

    return groups
  }, [filteredSubProcesses])

  // Handle optimistic updates when a sub-process is updated
  const handleSubProcessUpdated = (subProcessId: string, updates: Partial<SubProcessKanbanItem>) => {
    setSubProcesses((prev) =>
      prev.map((sp) => (sp.id === subProcessId ? { ...sp, ...updates } : sp))
    )
  }

  // Find sub-process by ID
  const findSubProcess = (id: string) => {
    return subProcesses.find((sp) => sp.id === id)
  }

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  // Handle drag end - update status when dropped in different column
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const activeSubProcess = findSubProcess(active.id as string)
    if (!activeSubProcess) return

    // Extract the status from the droppable container ID
    // Container IDs are in format "column-STATUS"
    const overColumnId = over.id as string

    // If dropped on a card instead of a column, get the column from card's data
    let newStatus: AffiliationSubProcessStatus
    if (overColumnId.startsWith('column-')) {
      newStatus = overColumnId.replace('column-', '') as AffiliationSubProcessStatus
    } else {
      // Dropped on a card, get the status from the card's current status
      const overCard = findSubProcess(overColumnId)
      if (!overCard) return
      newStatus = overCard.status
    }

    // If dropped in same column, do nothing
    if (activeSubProcess.status === newStatus) return

    // Store original status for potential rollback
    const originalStatus = activeSubProcess.status

    // Optimistic update
    handleSubProcessUpdated(activeSubProcess.id, { status: newStatus })

    // Call server action
    try {
      const result = await updateSubProcessStatus({
        subProcessId: activeSubProcess.id,
        status: newStatus,
      })

      if (!result.success) {
        // Rollback on error
        handleSubProcessUpdated(activeSubProcess.id, { status: originalStatus })
        toast.error(result.error || 'Error al actualizar el estado')
      } else {
        toast.success('Estado actualizado exitosamente')
      }
    } catch (error) {
      // Rollback on exception
      handleSubProcessUpdated(activeSubProcess.id, { status: originalStatus })
      toast.error('Error al actualizar el estado')
      console.error('Error updating status:', error)
    }
  }

  // Define visible statuses explicitly - PENDING_SUPPORT is intentionally excluded from kanban view
  const statuses: AffiliationSubProcessStatus[] = [
    AffiliationSubProcessStatus.NOT_STARTED,
    AffiliationSubProcessStatus.IN_PROGRESS,
    AffiliationSubProcessStatus.IN_REVIEW,
    AffiliationSubProcessStatus.COMPLETED,
    AffiliationSubProcessStatus.RETURNED,
  ]

  const activeSubProcess = activeId ? findSubProcess(activeId) : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={rectIntersection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <CardTitle>Vista Kanban de Afiliaciones</CardTitle>
            <CardDescription>
              Visualiza todos los sub-procesos organizados por estado. Arrastra las tarjetas para cambiar el estado.{' '}
              {filteredSubProcesses.length !== subProcesses.length && (
                <span className="font-medium text-foreground">
                  Mostrando {filteredSubProcesses.length} de {subProcesses.length} sub-procesos
                </span>
              )}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Filters */}
        <KanbanFilters
          filters={filters}
          managers={managers}
          currentUserId={currentUserId}
          onFiltersChange={setFilters}
        />

        {/* Kanban Board */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {statuses.map((status) => (
            <div key={status} className="min-h-[500px]">
              <KanbanColumn
                status={status}
                subProcesses={groupedByStatus[status]}
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
                onSubProcessUpdated={handleSubProcessUpdated}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Drag Overlay - shows preview of dragged item */}
      <DragOverlay>
        {activeSubProcess ? (
          <SubProcessKanbanCard
            subProcess={activeSubProcess}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
            compact={true}
            clientName={activeSubProcess.client.fullName}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
