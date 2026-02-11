/**
 * Kanban Column Component
 * Displays a column of sub-processes for a specific status
 */

'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SubProcessKanbanCard } from './subprocess-kanban-card'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { AffiliationSubProcessStatus } from '@prisma/client'
import type { SubProcessKanbanItem } from '@/lib/types/affiliation.types'
import { SubProcessStatusLabels, SubProcessStatusColors } from '@/lib/types/affiliation.types'
import { cn } from '@/lib/utils'

interface DraggableCardProps {
  subProcess: SubProcessKanbanItem
  currentUserId?: string
  currentUserRole?: string
  onSubProcessUpdated?: (subProcessId: string, updates: Partial<SubProcessKanbanItem>) => void
}

function DraggableCard({
  subProcess,
  currentUserId,
  currentUserRole,
  onSubProcessUpdated,
}: DraggableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: subProcess.id,
    data: {
      subProcess,
      currentStatus: subProcess.status,
    },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <SubProcessKanbanCard
        subProcess={subProcess}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        onSubProcessUpdated={onSubProcessUpdated}
        compact={true}
        clientName={subProcess.client.fullName}
      />
    </div>
  )
}

interface KanbanColumnProps {
  status: AffiliationSubProcessStatus
  subProcesses: SubProcessKanbanItem[]
  currentUserId?: string
  currentUserRole?: string
  onSubProcessUpdated?: (subProcessId: string, updates: Partial<SubProcessKanbanItem>) => void
}

export function KanbanColumn({
  status,
  subProcesses,
  currentUserId,
  currentUserRole,
  onSubProcessUpdated,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${status}`,
    data: {
      columnStatus: status,
    },
  })

  const colors = SubProcessStatusColors[status]
  const label = SubProcessStatusLabels[status]
  const safeSubProcesses = subProcesses || []
  const count = safeSubProcesses.length

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col h-full rounded-lg transition-all',
        isOver && 'ring-2 ring-primary ring-offset-2 bg-accent/50'
      )}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b">
        <h3 className="font-semibold text-sm">{label}</h3>
        <Badge
          variant="outline"
          className={`${colors.bg} ${colors.text} ${colors.border}`}
        >
          {count}
        </Badge>
      </div>

      {/* Cards Container with Scroll */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-2">
        <SortableContext
          items={safeSubProcesses.map((sp) => sp.id)}
          strategy={verticalListSortingStrategy}
        >
          {safeSubProcesses.length === 0 ? (
            <Card className="p-4 text-center text-xs text-muted-foreground border-dashed">
              {isOver ? 'Suelta aquí' : 'No hay sub-procesos'}
            </Card>
          ) : (
            safeSubProcesses.map((subProcess) => (
              <DraggableCard
                key={subProcess.id}
                subProcess={subProcess}
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
                onSubProcessUpdated={onSubProcessUpdated}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  )
}
