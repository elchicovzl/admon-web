/**
 * Send Affiliation Email Client Component
 * Full page form for composing and sending affiliation completion emails
 */

'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { toast } from 'sonner'
import {
  Send,
  Loader2,
  Paperclip,
  Eye,
  PenLine,
  X,
  Plus,
  AlertTriangle,
  FileText,
  FileImage,
  Hash,
  User,
  Mail,
} from 'lucide-react'
import {
  sendAffiliationEmailSchema,
  type SendAffiliationEmailInput,
} from '@/lib/validations/send-affiliation-email.schema'
import {
  sendAffiliationWithEmail,
  previewAffiliationEmail,
} from '@/lib/actions/affiliation.actions'
import type { EmailComposeData, EmailComposeDocument } from '@/lib/types/affiliation.types'

interface SendAffiliationEmailClientProps {
  affiliationId: string
  emailData: EmailComposeData
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

const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024 // 25MB

export function SendAffiliationEmailClient({
  affiliationId,
  emailData,
}: SendAffiliationEmailClientProps) {
  const router = useRouter()
  const [isSending, setIsSending] = useState(false)
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(
    new Set(emailData.documents.map((d) => d.id))
  )
  const [previewHtml, setPreviewHtml] = useState<string>('')
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [ccInput, setCcInput] = useState('')
  const [ccEmails, setCcEmails] = useState<string[]>([])

  const form = useForm<SendAffiliationEmailInput>({
    resolver: zodResolver(sendAffiliationEmailSchema),
    defaultValues: {
      affiliationId,
      to: emailData.to,
      cc: [],
      subject: emailData.subject,
      emailBody: emailData.emailBody,
      selectedDocumentIds: emailData.documents.map((d) => d.id),
    },
  })

  // Calculate total attachment size
  const totalAttachmentSize = emailData.documents
    .filter((doc) => selectedDocIds.has(doc.id))
    .reduce((sum, doc) => sum + doc.fileSize, 0)
  const exceedsLimit = totalAttachmentSize > MAX_ATTACHMENT_SIZE

  // Toggle document selection
  const toggleDocument = useCallback(
    (docId: string) => {
      setSelectedDocIds((prev) => {
        const next = new Set(prev)
        if (next.has(docId)) {
          next.delete(docId)
        } else {
          next.add(docId)
        }
        form.setValue('selectedDocumentIds', Array.from(next))
        return next
      })
    },
    [form]
  )

  const toggleAllDocuments = useCallback(() => {
    if (selectedDocIds.size === emailData.documents.length) {
      setSelectedDocIds(new Set())
      form.setValue('selectedDocumentIds', [])
    } else {
      const allIds = new Set(emailData.documents.map((d) => d.id))
      setSelectedDocIds(allIds)
      form.setValue('selectedDocumentIds', Array.from(allIds))
    }
  }, [selectedDocIds.size, emailData.documents, form])

  // CC email management
  const addCcEmail = useCallback(() => {
    const email = ccInput.trim()
    if (!email) return

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      toast.error('Email CC inválido')
      return
    }

    if (ccEmails.includes(email)) {
      toast.error('Este email ya fue agregado')
      return
    }

    const newCc = [...ccEmails, email]
    setCcEmails(newCc)
    form.setValue('cc', newCc)
    setCcInput('')
  }, [ccInput, ccEmails, form])

  const removeCcEmail = useCallback(
    (email: string) => {
      const newCc = ccEmails.filter((e) => e !== email)
      setCcEmails(newCc)
      form.setValue('cc', newCc)
    },
    [ccEmails, form]
  )

  const handleCcKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault()
        addCcEmail()
      }
    },
    [addCcEmail]
  )

  // Load preview
  const loadPreview = useCallback(async () => {
    setIsLoadingPreview(true)

    const result = await previewAffiliationEmail({
      emailBody: form.getValues('emailBody'),
      hasAttachments: selectedDocIds.size > 0,
    })

    if (result.success && result.data) {
      setPreviewHtml(result.data)
    } else {
      toast.error('Error al generar vista previa')
    }
    setIsLoadingPreview(false)
  }, [form, selectedDocIds.size])

  // Submit handler
  const onSubmit = async (data: SendAffiliationEmailInput) => {
    if (exceedsLimit) {
      toast.error('El tamaño de los adjuntos excede el límite de 25MB')
      return
    }

    setIsSending(true)
    try {
      const result = await sendAffiliationWithEmail({
        ...data,
        selectedDocumentIds: Array.from(selectedDocIds),
      })

      if (result.success) {
        toast.success(result.message || 'Afiliación enviada exitosamente')
        router.push('/dashboard/affiliations/archived')
      } else {
        toast.error(result.error || 'Error al enviar la afiliación')
      }
    } catch (error) {
      console.error('Error sending affiliation:', error)
      toast.error('Error inesperado al enviar la afiliación')
    } finally {
      setIsSending(false)
    }
  }

  // Group documents by sub-process
  const groupedDocuments: Record<string, EmailComposeDocument[]> = {}
  for (const doc of emailData.documents) {
    if (!groupedDocuments[doc.subProcessLabel]) {
      groupedDocuments[doc.subProcessLabel] = []
    }
    groupedDocuments[doc.subProcessLabel].push(doc)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - Info + Attachments */}
          <div className="space-y-6">
            {/* Affiliation Summary */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Resumen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{emailData.affiliationNumber}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{emailData.clientName}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{emailData.to}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Tipo: </span>
                  <span>{emailData.processTypeLabel}</span>
                </div>
                <div className="pt-2">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Sub-procesos:</p>
                  <div className="flex flex-wrap gap-1">
                    {emailData.subProcesses.map((sp) => (
                      <Badge key={sp.id} variant="secondary" className="text-xs">
                        {sp.label}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Attachments */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Paperclip className="h-4 w-4" />
                    Adjuntos
                  </CardTitle>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={toggleAllDocuments}
                  >
                    {selectedDocIds.size === emailData.documents.length
                      ? 'Deseleccionar'
                      : 'Seleccionar todo'}
                  </Button>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">
                    {selectedDocIds.size} sel. · {formatFileSize(totalAttachmentSize)}
                  </span>
                  {exceedsLimit && (
                    <Badge variant="destructive" className="gap-1 text-xs">
                      <AlertTriangle className="h-3 w-3" />
                      +25MB
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {emailData.documents.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">Sin documentos</p>
                ) : (
                  <ScrollArea className="max-h-[400px]">
                    <div className="space-y-4">
                      {Object.entries(groupedDocuments).map(([label, docs]) => (
                        <div key={label}>
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                            {label}
                          </h4>
                          <div className="space-y-1">
                            {docs.map((doc) => (
                              <label
                                key={doc.id}
                                className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer"
                              >
                                <Checkbox
                                  checked={selectedDocIds.has(doc.id)}
                                  onCheckedChange={() => toggleDocument(doc.id)}
                                />
                                {getFileIcon(doc.fileType)}
                                <span className="text-sm flex-1 truncate">{doc.fileName}</span>
                                <span className="text-xs text-muted-foreground shrink-0">
                                  {formatFileSize(doc.fileSize)}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right column - Compose/Preview */}
          <div className="lg:col-span-2">
            <Card className="h-full flex flex-col">
              <Tabs defaultValue="compose" className="flex-1 flex flex-col">
                <CardHeader className="pb-3">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="compose" className="gap-2">
                      <PenLine className="h-4 w-4" />
                      Componer
                    </TabsTrigger>
                    <TabsTrigger value="preview" className="gap-2" onClick={loadPreview}>
                      <Eye className="h-4 w-4" />
                      Vista Previa
                    </TabsTrigger>
                  </TabsList>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col">
                  <TabsContent value="compose" className="flex-1 mt-0 space-y-4">
                    {/* To field */}
                    <FormField
                      control={form.control}
                      name="to"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Para</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="correo@ejemplo.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* CC field */}
                    <div className="space-y-2">
                      <Label>CC</Label>
                      {ccEmails.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {ccEmails.map((email) => (
                            <Badge key={email} variant="secondary" className="gap-1 pr-1">
                              {email}
                              <button
                                type="button"
                                onClick={() => removeCcEmail(email)}
                                className="hover:bg-muted rounded-full p-0.5"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Input
                          type="email"
                          placeholder="Agregar email CC y presione Enter..."
                          value={ccInput}
                          onChange={(e) => setCcInput(e.target.value)}
                          onKeyDown={handleCcKeyDown}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={addCcEmail}
                          disabled={!ccInput.trim()}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Subject */}
                    <FormField
                      control={form.control}
                      name="subject"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Asunto</FormLabel>
                          <FormControl>
                            <Input placeholder="Asunto del correo" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Email body - main content */}
                    <FormField
                      control={form.control}
                      name="emailBody"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel>Cuerpo del correo</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Contenido del correo..."
                              className="min-h-[400px] font-mono text-sm"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TabsContent>

                  <TabsContent value="preview" className="flex-1 mt-0">
                    {isLoadingPreview ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-muted-foreground">
                          Generando vista previa...
                        </span>
                      </div>
                    ) : previewHtml ? (
                      <iframe
                        srcDoc={previewHtml}
                        className="w-full h-[500px] border rounded-lg"
                        title="Vista previa del correo"
                        sandbox="allow-same-origin"
                      />
                    ) : (
                      <div className="flex items-center justify-center py-12 text-muted-foreground">
                        Haga clic en &quot;Vista Previa&quot; para ver el correo
                      </div>
                    )}
                  </TabsContent>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-4 border-t mt-4">
                    <p className="text-xs text-muted-foreground">
                      Enviar archivará la afiliación permanentemente
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => router.back()}
                        disabled={isSending}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        disabled={isSending || exceedsLimit}
                        className="gap-2 bg-green-600 hover:bg-green-700"
                      >
                        {isSending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Enviando...
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4" />
                            Enviar Afiliación
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Tabs>
            </Card>
          </div>
        </div>
      </form>
    </Form>
  )
}
