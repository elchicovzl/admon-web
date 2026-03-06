/**
 * Sent Email Viewer Component
 * Displays details of a sent affiliation email
 */

'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Mail, Loader2, Paperclip, FileText, FileImage } from 'lucide-react'
import { getSentEmailsByAffiliationId } from '@/lib/actions/affiliation.actions'
import type { SentEmailData } from '@/lib/types/affiliation.types'

interface SentEmailViewerProps {
  affiliationId: string
  trigger?: React.ReactNode
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileIcon(fileType: string) {
  if (fileType.startsWith('image/')) return <FileImage className="h-4 w-4 text-blue-500" />
  return <FileText className="h-4 w-4 text-orange-500" />
}

export function SentEmailViewer({ affiliationId, trigger }: SentEmailViewerProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [emails, setEmails] = useState<SentEmailData[]>([])

  useEffect(() => {
    if (open && emails.length === 0) {
      setIsLoading(true)
      getSentEmailsByAffiliationId(affiliationId).then((result) => {
        if (result.success && result.data) {
          setEmails(result.data)
        }
        setIsLoading(false)
      })
    }
  }, [open, affiliationId, emails.length])

  useEffect(() => {
    if (!open) {
      setEmails([])
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Mail className="h-4 w-4" />
            Ver Email
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:w-[90vw] sm:max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Correo Enviado</DialogTitle>
          <DialogDescription>
            Detalle del correo enviado al cliente
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Cargando...</span>
          </div>
        ) : emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Mail className="h-10 w-10 mb-3" />
            <p>No se encontraron correos enviados para esta afiliación</p>
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="space-y-6">
              {emails.map((email) => (
                <div key={email.id} className="space-y-4">
                  {/* Email metadata */}
                  <div className="space-y-2 border rounded-lg p-4 bg-muted/30">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium w-20">Para:</span>
                      <span>{email.toEmail}</span>
                    </div>
                    {email.ccEmails.length > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium w-20">CC:</span>
                        <div className="flex flex-wrap gap-1">
                          {email.ccEmails.map((cc) => (
                            <Badge key={cc} variant="secondary" className="text-xs">
                              {cc}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium w-20">Asunto:</span>
                      <span>{email.subject}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium w-20">Enviado:</span>
                      <span>
                        {format(new Date(email.sentAt), "d 'de' MMMM 'de' yyyy 'a las' HH:mm", {
                          locale: es,
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium w-20">Por:</span>
                      <span>
                        {email.sentBy.name || 'Sin nombre'} ({email.sentBy.email})
                      </span>
                    </div>
                  </div>

                  {/* Attachments */}
                  {email.attachments.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <Paperclip className="h-4 w-4" />
                        Documentos adjuntos ({email.attachments.length})
                      </h4>
                      <div className="border rounded-lg p-3 space-y-1">
                        {email.attachments.map((att, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 text-sm py-1"
                          >
                            {getFileIcon(att.fileType)}
                            <span className="flex-1 truncate">{att.fileName}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatFileSize(att.fileSize)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Email body preview */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Contenido del correo</h4>
                    <iframe
                      srcDoc={email.htmlBody}
                      className="w-full h-[420px] border rounded-lg"
                      title="Contenido del correo"
                      sandbox="allow-same-origin"
                    />
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}
