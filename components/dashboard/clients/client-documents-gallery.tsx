'use client'

import { useState, useRef } from 'react'
import { FilePond, registerPlugin } from 'react-filepond'
import type { FilePondFile } from 'filepond'
import { DocumentCategory } from '@prisma/client'
import type { ClientDocument } from '@/lib/types/client.types'
import { deleteDocument } from '@/lib/actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
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
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FileText, Image as ImageIcon, FileType, X, Download, Loader2, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

// Import FilePond styles
import 'filepond/dist/filepond.min.css'
import 'filepond-plugin-image-preview/dist/filepond-plugin-image-preview.css'

// Import FilePond plugins
import FilePondPluginImagePreview from 'filepond-plugin-image-preview'
import FilePondPluginFileValidateType from 'filepond-plugin-file-validate-type'
import FilePondPluginFileValidateSize from 'filepond-plugin-file-validate-size'
import FilePondPluginPdfPreview from 'filepond-plugin-pdf-preview'

// Register plugins
registerPlugin(
  FilePondPluginImagePreview,
  FilePondPluginFileValidateType,
  FilePondPluginFileValidateSize,
  FilePondPluginPdfPreview
)

interface ClientDocumentsGalleryProps {
  clientId: string
  initialDocuments: ClientDocument[]
}

const CATEGORY_LABELS = {
  [DocumentCategory.GENERAL]: 'General',
  [DocumentCategory.ARL]: 'ARL',
  [DocumentCategory.EPS]: 'EPS',
  [DocumentCategory.AFP]: 'AFP',
  [DocumentCategory.OTROS]: 'Otros',
}

const CATEGORY_DESCRIPTIONS = {
  [DocumentCategory.GENERAL]: 'Documentos generales del cliente',
  [DocumentCategory.ARL]: 'Documentos de procesos ARL',
  [DocumentCategory.EPS]: 'Documentos de afiliación EPS',
  [DocumentCategory.AFP]: 'Documentos de AFP',
  [DocumentCategory.OTROS]: 'Otros documentos de procesos',
}

export function ClientDocumentsGallery({
  clientId,
  initialDocuments,
}: ClientDocumentsGalleryProps) {
  const [documents, setDocuments] = useState<ClientDocument[]>(initialDocuments)
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory>(DocumentCategory.GENERAL)
  const [activeTab, setActiveTab] = useState<string>('GENERAL')
  const [files, setFiles] = useState<FilePondFile[]>([])
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null)
  const [isDeletingDoc, setIsDeletingDoc] = useState(false)
  const pondRef = useRef<FilePond>(null)

  const handleProcessFile = async (
    fieldName: string,
    file: File,
    metadata: Record<string, unknown>,
    load: (p: string | Record<string, unknown>) => void,
    error: (errorText: string) => void,
    progress: (computable: boolean, loaded: number, total: number) => void,
    abort: () => void
  ) => {
    const controller = new AbortController()

    try {
      progress(true, 0, 100)

      // Create FormData
      const formData = new FormData()
      formData.append('file', file)
      formData.append('clientId', clientId)
      formData.append('category', selectedCategory)

      progress(true, 30, 100)

      // Upload to API endpoint
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      })

      progress(true, 70, 100)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Error al subir archivo' }))
        error(errorData.error || 'Error al subir archivo')
        return
      }

      const result = await response.json()

      if (result.success && result.data) {
        setDocuments((prev) => [result.data, ...prev])
        toast.success(result.message || `${file.name} subido exitosamente`)
        progress(true, 100, 100)
        load(result.data.id)
      } else {
        error(result.error || 'Error al procesar archivo')
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        console.log('Upload aborted')
      } else {
        console.error('Upload error:', err)
        error('Error inesperado al subir archivo')
      }
    }

    // Return abort controller
    return {
      abort: () => {
        controller.abort()
        abort()
      },
    }
  }

  const handleDeleteDocument = async (docId: string) => {
    setIsDeletingDoc(true)

    try {
      const result = await deleteDocument(docId)

      if (result.success) {
        toast.success(result.message || 'Documento eliminado exitosamente')
        setDocuments((prev) => prev.filter((d) => d.id !== docId))
        setDeleteDialogOpen(false)
        setDeletingDocId(null)
      } else {
        toast.error(result.error || 'Error al eliminar documento')
      }
    } catch (error) {
      console.error('Delete document error:', error)
      toast.error('Error inesperado al eliminar documento')
    } finally {
      setIsDeletingDoc(false)
    }
  }

  const getFileIcon = (fileType: string, size: 'sm' | 'lg' = 'sm') => {
    const sizeClass = size === 'lg' ? 'h-16 w-16' : 'h-5 w-5'
    if (fileType.includes('image')) return <ImageIcon className={sizeClass} />
    if (fileType.includes('pdf')) return <FileType className={sizeClass} />
    return <FileText className={sizeClass} />
  }

  const getFileTypeBadge = (fileType: string) => {
    if (fileType.includes('image')) return 'Imagen'
    if (fileType.includes('pdf')) return 'PDF'
    if (fileType.includes('word') || fileType.includes('document')) return 'Documento'
    if (fileType.includes('excel') || fileType.includes('spreadsheet')) return 'Excel'
    return 'Archivo'
  }

  const filteredDocuments = documents.filter((doc) => doc.category === activeTab)

  const documentsByCategory = Object.values(DocumentCategory).reduce((acc, category) => {
    acc[category] = documents.filter((doc) => doc.category === category).length
    return acc
  }, {} as Record<DocumentCategory, number>)

  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle>Documentos del Cliente</CardTitle>
          <CardDescription>
            Gestiona documentos organizados por categorías (General, ARL, EPS, AFP, Otros)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Upload Section */}
          <div className="space-y-4">
            <div className="flex items-end gap-4">
              <div className="flex-1 space-y-2">
                <Label htmlFor="category">Categoría del Documento</Label>
                <Select
                  value={selectedCategory}
                  onValueChange={(value) => setSelectedCategory(value as DocumentCategory)}
                >
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Selecciona una categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {CATEGORY_DESCRIPTIONS[selectedCategory]}
                </p>
              </div>
            </div>

            {/* FilePond Upload Area */}
            <div className="filepond-wrapper">
              <FilePond
                ref={pondRef}
                files={files}
                onupdatefiles={setFiles}
                allowMultiple={true}
                maxFiles={10}
                server={{
                  process: handleProcessFile as never,
                }}
                name="files"
                labelIdle='Arrastra archivos aquí o <span class="filepond--label-action">Examinar</span>'
                labelFileProcessing="Subiendo"
                labelFileProcessingComplete="Subida completa"
                labelFileProcessingAborted="Subida cancelada"
                labelFileProcessingError="Error en la subida"
                labelTapToCancel="toca para cancelar"
                labelTapToRetry="toca para reintentar"
                labelTapToUndo="toca para deshacer"
                acceptedFileTypes={[
                  'image/*',
                  'application/pdf',
                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                  'application/msword',
                  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                  'application/vnd.ms-excel',
                ]}
                maxFileSize="10MB"
                credits={false}
              />
            </div>
          </div>

          {/* Documents Tabs by Category */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <TabsTrigger key={value} value={value} className="relative">
                  {label}
                  {documentsByCategory[value as DocumentCategory] > 0 && (
                    <Badge
                      variant="secondary"
                      className="ml-2 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center"
                    >
                      {documentsByCategory[value as DocumentCategory]}
                    </Badge>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            {Object.values(DocumentCategory).map((category) => (
              <TabsContent key={category} value={category} className="mt-6">
                {filteredDocuments.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredDocuments.map((doc) => (
                      <div
                        key={doc.id}
                        className="group relative flex flex-col gap-2 rounded-lg border bg-card hover:shadow-md transition-shadow overflow-hidden"
                      >
                        {/* Preview Section */}
                        {doc.fileType.includes('image') ? (
                          <div className="relative w-full h-48 bg-muted">
                            <img
                              src={`/api/documents/${doc.id}`}
                              alt={doc.fileName}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute top-2 right-2 h-8 w-8 bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => {
                                setDeletingDocId(doc.id)
                                setDeleteDialogOpen(true)
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="relative w-full h-32 bg-muted flex flex-col items-center justify-center gap-2">
                            <div className="text-muted-foreground">
                              {getFileIcon(doc.fileType, 'lg')}
                            </div>
                            <p className="text-xs font-medium text-muted-foreground uppercase">
                              {getFileTypeBadge(doc.fileType)}
                            </p>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute top-2 right-2 h-8 w-8 bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => {
                                setDeletingDocId(doc.id)
                                setDeleteDialogOpen(true)
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        )}

                        {/* Info Section */}
                        <div className="p-4 pt-2 flex flex-col gap-2">
                          <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate" title={doc.fileName}>
                                {doc.fileName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {(doc.fileSize / 1024).toFixed(2)} KB
                              </p>
                              <Badge variant="secondary" className="mt-1 text-xs">
                                {getFileTypeBadge(doc.fileType)}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>
                              {format(new Date(doc.createdAt), 'd MMM yyyy', { locale: es })}
                            </span>
                            {doc.uploadedBy && (
                              <span>• {doc.uploadedBy.name || doc.uploadedBy.email}</span>
                            )}
                          </div>
                          <div className="flex gap-2 mt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              asChild
                            >
                              <a href={`/api/documents/${doc.id}`} target="_blank" rel="noopener noreferrer">
                                <Eye className="mr-2 h-3 w-3" />
                                Ver
                              </a>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              asChild
                            >
                              <a href={`/api/documents/${doc.id}`} download={doc.fileName}>
                                <Download className="mr-2 h-3 w-3" />
                                Descargar
                              </a>
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No hay documentos en esta categoría</p>
                    <p className="text-sm mt-2">
                      Selecciona &quot;{CATEGORY_LABELS[category]}&quot; en el selector y sube archivos
                    </p>
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El documento será eliminado permanentemente
              de R2 y de la base de datos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingDoc}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingDocId && handleDeleteDocument(deletingDocId)}
              disabled={isDeletingDoc}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingDoc && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Custom FilePond Styles */}
      <style jsx global>{`
        .filepond-wrapper .filepond--root {
          font-family: inherit;
        }

        .filepond-wrapper .filepond--panel-root {
          background-color: transparent;
        }

        .filepond-wrapper .filepond--drop-label {
          min-height: 12rem;
        }

        .filepond-wrapper .filepond--credits {
          display: none;
        }
      `}</style>
    </div>
  )
}
