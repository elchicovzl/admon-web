'use client'

import { useCallback, useState } from 'react'
import { AlertTriangle, BookOpen } from 'lucide-react'
import { toast } from 'sonner'
import { usePolling } from '@/components/dashboard/whatsapp/use-polling'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  deleteKnowledgeDocument,
  getKnowledgeHealth,
  listKnowledgeDocuments,
  reindexKnowledgeDocument,
} from '@/lib/actions/knowledge.actions'
import type { KnowledgeDocumentItem, KnowledgeHealth } from '@/lib/types/knowledge.types'
import { healthBanner, shouldPollDocuments } from '@/lib/knowledge/status'
import { KnowledgeTable } from './knowledge-table'
import { KnowledgeUpload } from './knowledge-upload'

const POLL_INTERVAL_MS = 4000

interface KnowledgeContainerProps {
  initialItems: KnowledgeDocumentItem[]
  initialHealth: KnowledgeHealth | null
  currentEmbeddingModel: string
  maxUploadBytes: number
}

/**
 * Knowledge page (KB-1): upload, list with status, re-index and delete. While a document is
 * queued or being indexed the list polls every 4 s (only with the tab visible) and stops once
 * everything is READY or FAILED.
 */
export function KnowledgeContainer({
  initialItems,
  initialHealth,
  currentEmbeddingModel,
  maxUploadBytes,
}: KnowledgeContainerProps) {
  const [items, setItems] = useState(initialItems)
  const [health, setHealth] = useState(initialHealth)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<KnowledgeDocumentItem | null>(null)

  const refresh = useCallback(async () => {
    const [list, status] = await Promise.all([listKnowledgeDocuments(), getKnowledgeHealth()])
    if (list.success && list.data) setItems(list.data)
    if (status.success && status.data) setHealth(status.data)
  }, [])

  usePolling(refresh, POLL_INTERVAL_MS, shouldPollDocuments(items))

  const reindex = async (item: KnowledgeDocumentItem) => {
    setPendingId(item.id)
    try {
      const result = await reindexKnowledgeDocument({ documentId: item.id })
      if (result.success) toast.success('Reindexación programada')
      else toast.error(result.error ?? 'No se pudo reindexar')
      await refresh()
    } finally {
      setPendingId(null)
    }
  }

  const confirmDelete = async () => {
    const item = deleting
    setDeleting(null)
    if (!item) return
    setPendingId(item.id)
    try {
      const result = await deleteKnowledgeDocument({ documentId: item.id })
      if (!result.success) {
        toast.error(result.error ?? 'No se pudo eliminar el documento')
        return
      }
      setItems((current) => current.filter((row) => row.id !== item.id))
      toast.success('Documento eliminado')
      await refresh()
    } finally {
      setPendingId(null)
    }
  }

  const banner = health ? healthBanner(health) : null

  return (
    <div className="space-y-4">
      {banner && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{banner.title}</AlertTitle>
          <AlertDescription>{banner.description}</AlertDescription>
        </Alert>
      )}

      <KnowledgeUpload maxBytes={maxUploadBytes} onUploaded={() => void refresh()} />

      <div className="rounded-lg border bg-card">
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center text-muted-foreground">
            <BookOpen className="h-8 w-8" aria-hidden />
            <p className="text-sm">Aún no hay documentos. Suba el primero para que el asistente pueda responder con él.</p>
          </div>
        ) : (
          <KnowledgeTable
            items={items}
            pendingId={pendingId}
            isStale={(item) => item.embeddingModel !== null && item.embeddingModel !== currentEmbeddingModel}
            onReindex={(item) => void reindex(item)}
            onDelete={setDeleting}
          />
        )}
      </div>

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar «{deleting?.title}»?</AlertDialogTitle>
            <AlertDialogDescription>
              El asistente dejará de usar este documento de inmediato. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDelete()}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
