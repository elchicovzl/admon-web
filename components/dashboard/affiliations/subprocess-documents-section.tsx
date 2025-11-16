/**
 * SubProcess Documents Section Component
 * Manages documents for a sub-process
 */

'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { FileText, Trash2, Download, Upload, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { deleteDocument } from '@/lib/actions/affiliation.actions'
import type { SafeAffiliationDocument } from '@/lib/types/affiliation.types'
import { DocumentCategoryLabels } from '@/lib/types/affiliation.types'

interface SubProcessDocumentsSectionProps {
  subProcessId: string
  documents: SafeAffiliationDocument[]
  currentUserId?: string
  currentUserRole?: string
  onDocumentDeleted?: (documentId: string) => void
}

export function SubProcessDocumentsSection({
  subProcessId,
  documents,
  currentUserId,
  currentUserRole,
  onDocumentDeleted,
}: SubProcessDocumentsSectionProps) {
  const [loading, setLoading] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [documentToDelete, setDocumentToDelete] = useState<string | null>(null)

  async function handleDeleteDocument() {
    if (!documentToDelete) return

    setLoading(true)
    try {
      const result = await deleteDocument(documentToDelete)

      if (result.success) {
        toast.success('Documento eliminado exitosamente')
        onDocumentDeleted?.(documentToDelete)
        setDeleteDialogOpen(false)
        setDocumentToDelete(null)
      } else {
        toast.error(result.error || 'Error al eliminar documento')
      }
    } catch (error) {
      console.error('Error deleting document:', error)
      toast.error('Error al eliminar documento')
    } finally {
      setLoading(false)
    }
  }

  function openDeleteDialog(documentId: string) {
    setDocumentToDelete(documentId)
    setDeleteDialogOpen(true)
  }

  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  function getFileIcon(fileType: string) {
    if (fileType.includes('pdf')) return '📄'
    if (fileType.includes('image')) return '🖼️'
    if (fileType.includes('word') || fileType.includes('document')) return '📝'
    if (fileType.includes('excel') || fileType.includes('spreadsheet')) return '📊'
    return '📎'
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Documentos
              </CardTitle>
              <CardDescription>
                Soportes y certificados del sub-proceso
              </CardDescription>
            </div>
            <Badge variant="secondary">{documents.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Upload Button - TODO: Implement R2 upload */}
          <div className="border-2 border-dashed rounded-lg p-6 text-center">
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-3">
              Arrastra archivos aquí o haz clic para subir
            </p>
            <Button variant="outline" size="sm" disabled>
              <Upload className="mr-2 h-4 w-4" />
              Subir Documento
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Próximamente: Upload de documentos con R2
            </p>
          </div>

          {/* Documents List */}
          {documents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p className="text-sm">No hay documentos todavía</p>
              <p className="text-xs mt-1">Los documentos subidos aparecerán aquí</p>
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map((document) => (
                <div
                  key={document.id}
                  className="flex items-center justify-between gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="text-2xl">{getFileIcon(document.fileType)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{document.fileName}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-xs">
                          {DocumentCategoryLabels[document.category]}
                        </Badge>
                        <span>{formatFileSize(document.fileSize)}</span>
                        <span>
                          {format(new Date(document.createdAt), "d 'de' MMM yyyy", {
                            locale: es,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      asChild
                      className="h-8 w-8"
                    >
                      <a
                        href={document.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Ver documento"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      asChild
                      className="h-8 w-8"
                    >
                      <a
                        href={document.fileUrl}
                        download={document.fileName}
                        title="Descargar"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openDeleteDialog(document.id)}
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar documento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El documento será eliminado permanentemente del
              almacenamiento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDocument}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
