'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import type { ClientDocument } from '@/lib/types/client.types'
import { generateUploadUrl, confirmUpload, deleteDocument } from '@/lib/actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Upload, FileText, Image as ImageIcon, FileType, X, Download, Loader2, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface ClientDocumentsGalleryProps {
  clientId: string
  initialDocuments: ClientDocument[]
}

interface UploadProgress {
  fileName: string
  progress: number
}

export function ClientDocumentsGallery({
  clientId,
  initialDocuments,
}: ClientDocumentsGalleryProps) {
  const [documents, setDocuments] = useState<ClientDocument[]>(initialDocuments)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([])
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null)
  const [isDeletingDoc, setIsDeletingDoc] = useState(false)

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return

    setIsUploading(true)
    const uploadProgressArray: UploadProgress[] = acceptedFiles.map((file) => ({
      fileName: file.name,
      progress: 0,
    }))
    setUploadProgress(uploadProgressArray)

    try {
      for (let i = 0; i < acceptedFiles.length; i++) {
        const file = acceptedFiles[i]

        // Update progress
        setUploadProgress((prev) =>
          prev.map((p, idx) => (idx === i ? { ...p, progress: 10 } : p))
        )

        // Step 1: Generate presigned URL
        const urlResult = await generateUploadUrl(
          clientId,
          file.name,
          file.type,
          file.size
        )

        if (!urlResult.success || !urlResult.data) {
          toast.error(`Error al subir ${file.name}: ${urlResult.error}`)
          continue
        }

        setUploadProgress((prev) =>
          prev.map((p, idx) => (idx === i ? { ...p, progress: 30 } : p))
        )

        // Step 2: Upload to S3 using presigned URL
        const uploadResponse = await fetch(urlResult.data.uploadUrl, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type,
          },
        })

        if (!uploadResponse.ok) {
          toast.error(`Error al subir ${file.name} a S3`)
          continue
        }

        setUploadProgress((prev) =>
          prev.map((p, idx) => (idx === i ? { ...p, progress: 70 } : p))
        )

        // Step 3: Confirm upload and save metadata
        const confirmResult = await confirmUpload(
          clientId,
          file.name,
          file.type,
          file.size,
          urlResult.data.s3Key
        )

        if (confirmResult.success && confirmResult.data) {
          setDocuments((prev) => [confirmResult.data!, ...prev])
          toast.success(`${file.name} subido exitosamente`)
        } else {
          toast.error(`Error al confirmar subida de ${file.name}`)
        }

        setUploadProgress((prev) =>
          prev.map((p, idx) => (idx === i ? { ...p, progress: 100 } : p))
        )
      }
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Error inesperado al subir archivos')
    } finally {
      setIsUploading(false)
      setTimeout(() => setUploadProgress([]), 1000)
    }
  }, [clientId])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
    },
    maxSize: 10485760, // 10MB
    disabled: isUploading,
  })

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

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('image')) return <ImageIcon className="h-5 w-5" />
    if (fileType.includes('pdf')) return <FileType className="h-5 w-5" />
    return <FileText className="h-5 w-5" />
  }

  const getFileTypeBadge = (fileType: string) => {
    if (fileType.includes('image')) return 'Imagen'
    if (fileType.includes('pdf')) return 'PDF'
    if (fileType.includes('word') || fileType.includes('document')) return 'Documento'
    return 'Archivo'
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Documentos del Cliente</CardTitle>
          <CardDescription>
            Sube y gestiona documentos relacionados con este cliente (imágenes, PDFs, DOCX)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Upload Area */}
          <div
            {...getRootProps()}
            className={`
              flex flex-col items-center justify-center py-12 px-6
              border-2 border-dashed rounded-lg cursor-pointer
              transition-colors
              ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
              ${isUploading ? 'cursor-not-allowed opacity-50' : ''}
            `}
          >
            <input {...getInputProps()} />
            <Upload className="h-12 w-12 text-muted-foreground mb-4" />
            {isDragActive ? (
              <p className="text-sm text-primary font-medium">Suelta los archivos aquí...</p>
            ) : (
              <>
                <p className="text-sm text-foreground font-medium mb-1">
                  Arrastra archivos aquí o haz clic para seleccionar
                </p>
                <p className="text-xs text-muted-foreground mb-2">
                  Imágenes, PDFs y documentos DOCX (máx. 10MB por archivo)
                </p>
              </>
            )}
          </div>

          {/* Upload Progress */}
          {uploadProgress.length > 0 && (
            <div className="space-y-3">
              {uploadProgress.map((progress, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate max-w-[70%]">{progress.fileName}</span>
                    <span className="text-muted-foreground">{progress.progress}%</span>
                  </div>
                  <Progress value={progress.progress} />
                </div>
              ))}
            </div>
          )}

          {/* Documents Grid */}
          {documents.length > 0 ? (
            <div>
              <h3 className="font-semibold text-sm mb-3">
                Documentos ({documents.length})
              </h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="group relative flex flex-col gap-2 p-4 rounded-lg border bg-card hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-muted-foreground">
                        {getFileIcon(doc.fileType)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{doc.fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          {(doc.fileSize / 1024).toFixed(2)} KB
                        </p>
                        <Badge variant="secondary" className="mt-1 text-xs">
                          {getFileTypeBadge(doc.fileType)}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => {
                          setDeletingDocId(doc.id)
                          setDeleteDialogOpen(true)
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
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
                        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
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
                        <a href={doc.fileUrl} download={doc.fileName}>
                          <Download className="mr-2 h-3 w-3" />
                          Descargar
                        </a>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No hay documentos para este cliente
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El documento será eliminado permanentemente
              de S3 y de la base de datos.
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
    </>
  )
}
