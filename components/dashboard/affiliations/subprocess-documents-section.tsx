/**
 * SubProcess Documents Section Component
 * Manages documents for a sub-process
 */

'use client'

import { useState, useRef } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { FileText, Trash2, Download, Upload, ExternalLink, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { deleteDocument } from '@/lib/actions/affiliation.actions'
import { AffiliationDocumentCategory } from '@prisma/client'
import type { SafeAffiliationDocument } from '@/lib/types/affiliation.types'
import { DocumentCategoryLabels } from '@/lib/types/affiliation.types'

interface SubProcessDocumentsSectionProps {
  subProcessId: string
  documents: SafeAffiliationDocument[]
  currentUserId?: string
  currentUserRole?: string
  onDocumentUploaded?: (document: SafeAffiliationDocument) => void
  onDocumentDeleted?: (documentId: string) => void
}

export function SubProcessDocumentsSection({
  subProcessId,
  documents,
  currentUserId,
  currentUserRole,
  onDocumentUploaded,
  onDocumentDeleted,
}: SubProcessDocumentsSectionProps) {
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [documentToDelete, setDocumentToDelete] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<AffiliationDocumentCategory>(AffiliationDocumentCategory.GENERAL)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFileUpload(file: File) {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('subProcessId', subProcessId)
      formData.append('category', selectedCategory)

      const response = await fetch('/api/affiliations/upload', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (result.success && result.data) {
        toast.success('Documento subido exitosamente')
        onDocumentUploaded?.(result.data)
      } else {
        toast.error(result.error || 'Error al subir documento')
      }
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Error al subir documento')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 10485760) {
        toast.error('El archivo excede el límite de 10MB')
        return
      }
      handleFileUpload(file)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) {
      if (file.size > 10485760) {
        toast.error('El archivo excede el límite de 10MB')
        return
      }
      handleFileUpload(file)
    }
  }

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
          {/* Upload Area */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Select
                value={selectedCategory}
                onValueChange={(v) => setSelectedCategory(v as AffiliationDocumentCategory)}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DocumentCategoryLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => !uploading && fileInputRef.current?.click()}
            >
              {uploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Subiendo documento...</p>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-1">
                    Arrastra archivos aquí o haz clic para subir
                  </p>
                  <p className="text-xs text-muted-foreground">Máximo 10MB por archivo</p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileChange}
                disabled={uploading}
              />
            </div>
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
                        href={`/api/affiliations/documents/${document.id}`}
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
                        href={`/api/affiliations/documents/${document.id}`}
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
