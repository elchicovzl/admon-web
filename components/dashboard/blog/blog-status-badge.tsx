'use client'

import { Badge } from '@/components/ui/badge'
import { BlogPostStatus } from '@prisma/client'

const statusConfig: Record<BlogPostStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  DRAFT: { label: 'Borrador', variant: 'secondary' },
  PUBLISHED: { label: 'Publicado', variant: 'default' },
  ARCHIVED: { label: 'Archivado', variant: 'outline' },
}

interface BlogStatusBadgeProps {
  status: BlogPostStatus
}

export function BlogStatusBadge({ status }: BlogStatusBadgeProps) {
  const config = statusConfig[status]
  return <Badge variant={config.variant}>{config.label}</Badge>
}
