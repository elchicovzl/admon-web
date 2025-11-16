/**
 * Status Badge Component
 * Reusable badge for displaying status and types with colors
 */

import { Badge } from '@/components/ui/badge'
import { AffiliationSubProcessStatus, AffiliationSubProcessType } from '@prisma/client'
import { SubProcessStatusLabels, SubProcessStatusColors, SubProcessTypeLabels, SubProcessTypeColors } from '@/lib/types/affiliation.types'
import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: AffiliationSubProcessStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const colors = SubProcessStatusColors[status]
  const label = SubProcessStatusLabels[status]

  return (
    <Badge
      variant="outline"
      className={cn(
        colors.bg,
        colors.text,
        colors.border,
        'font-medium',
        className
      )}
    >
      {label}
    </Badge>
  )
}

interface TypeBadgeProps {
  type: AffiliationSubProcessType
  className?: string
}

export function TypeBadge({ type, className }: TypeBadgeProps) {
  const colors = SubProcessTypeColors[type]
  const label = SubProcessTypeLabels[type]

  return (
    <Badge
      variant="outline"
      className={cn(
        colors.bg,
        colors.text,
        colors.border,
        'font-semibold',
        className
      )}
    >
      {label}
    </Badge>
  )
}
