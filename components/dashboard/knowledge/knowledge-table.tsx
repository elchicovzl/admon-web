'use client'

import type { KnowledgeDocumentStatus } from '@prisma/client'
import { Loader2, RefreshCw, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { KnowledgeDocumentItem } from '@/lib/types/knowledge.types'
import { KNOWLEDGE_STATUS_LABEL, formatFileSize, isIndexing } from '@/lib/knowledge/status'

const STATUS_VARIANT: Record<KnowledgeDocumentStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  PENDING: 'secondary',
  PROCESSING: 'secondary',
  READY: 'default',
  FAILED: 'destructive',
}

const dateFormat = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Bogota',
})

interface KnowledgeTableProps {
  items: KnowledgeDocumentItem[]
  pendingId: string | null
  /** True when this document's chunks were made with another embedding model (S-KB-8). */
  isStale: (item: KnowledgeDocumentItem) => boolean
  onReindex: (item: KnowledgeDocumentItem) => void
  onDelete: (item: KnowledgeDocumentItem) => void
}

export function KnowledgeTable({ items, pendingId, isStale, onReindex, onDelete }: KnowledgeTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Documento</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="hidden md:table-cell">Fragmentos</TableHead>
          <TableHead className="hidden lg:table-cell">Subido</TableHead>
          <TableHead className="w-0" aria-label="Acciones" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => {
          const indexing = isIndexing(item.status)
          const busy = pendingId === item.id
          return (
            <TableRow key={item.id}>
              <TableCell>
                <div className="font-medium">{item.title}</div>
                <div className="text-xs text-muted-foreground">
                  {item.fileName} · {formatFileSize(item.sizeBytes)}
                </div>
                {item.status === 'FAILED' && item.error && <p className="mt-1 text-xs text-destructive">{item.error}</p>}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center gap-1">
                  <Badge variant={STATUS_VARIANT[item.status]}>
                    {indexing && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
                    {KNOWLEDGE_STATUS_LABEL[item.status]}
                  </Badge>
                  {item.status === 'READY' && isStale(item) && <Badge variant="outline">Reindexar</Badge>}
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell">{item.status === 'READY' ? item.chunkCount : '—'}</TableCell>
              <TableCell className="hidden whitespace-nowrap text-muted-foreground lg:table-cell">
                {dateFormat.format(new Date(item.createdAt))}
                {item.uploadedByName && <div className="text-xs">{item.uploadedByName}</div>}
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy || indexing}
                    onClick={() => onReindex(item)}
                    title={indexing ? 'Ya se está indexando' : 'Volver a indexar'}
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span className="hidden sm:inline">Reindexar</span>
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => onDelete(item)}
                    aria-label={`Eliminar ${item.title}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
