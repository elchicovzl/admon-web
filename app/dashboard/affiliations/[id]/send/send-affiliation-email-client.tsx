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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  FlaskConical,
  GripVertical,
} from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  sendAffiliationEmailSchema,
  type SendAffiliationEmailInput,
} from '@/lib/validations/send-affiliation-email.schema'
import {
  sendAffiliationWithEmail,
  previewAffiliationEmail,
  sendTestAffiliationEmail,
  reorderAffiliationDocuments,
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

function SortableDocRow({
  doc,
  checked,
  onToggle,
  disabled,
}: {
  doc: EmailComposeDocument
  checked: boolean
  onToggle: () => void
  disabled: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: doc.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-2 rounded-md border bg-background hover:bg-muted/60 ${
        isDragging ? 'border-primary shadow-sm' : 'border-transparent'
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        disabled={disabled}
        aria-label="Reordenar documento"
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 touch-none"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Checkbox checked={checked} onCheckedChange={onToggle} />
      {getFileIcon(doc.fileType)}
      <span className="text-sm flex-1 truncate" title={doc.fileName}>
        {doc.fileName}
      </span>
      <Badge variant="outline" className="text-[10px] shrink-0">
        {doc.subProcessLabel}
      </Badge>
      <span className="text-xs text-muted-foreground shrink-0">
        {formatFileSize(doc.fileSize)}
      </span>
    </div>
  )
}

const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024 // 25MB

export function SendAffiliationEmailClient({
  affiliationId,
  emailData,
}: SendAffiliationEmailClientProps) {
  const router = useRouter()
  const [isSending, setIsSending] = useState(false)
  const [isSendingTest, setIsSendingTest] = useState(false)
  const [testEmailOpen, setTestEmailOpen] = useState(false)
  const [testEmailTo, setTestEmailTo] = useState('')
  // Ordered list of all documents (drives display order)
  const [orderedDocs, setOrderedDocs] = useState<EmailComposeDocument[]>(emailData.documents)
  // Which docs are selected (independent from order)
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(
    new Set(emailData.documents.map((d) => d.id))
  )
  const [isReordering, setIsReordering] = useState(false)
  const [previewHtml, setPreviewHtml] = useState<string>('')
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [ccInput, setCcInput] = useState('')
  const [ccEmails, setCcEmails] = useState<string[]>([])

  // Selected document IDs in current display order
  const selectedIdsInOrder = orderedDocs
    .filter((d) => selectedDocIds.has(d.id))
    .map((d) => d.id)

  const form = useForm<SendAffiliationEmailInput>({
    resolver: zodResolver(sendAffiliationEmailSchema),
    defaultValues: {
      affiliationId,
      to: emailData.to,
      cc: [],
      subject: emailData.subject,
      emailBody: emailData.emailBody,
      emailNotes: '',
      selectedDocumentIds: emailData.documents.map((d) => d.id),
    },
  })

  // Calculate total attachment size
  const totalAttachmentSize = orderedDocs
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
        const orderedSelected = orderedDocs
          .filter((d) => next.has(d.id))
          .map((d) => d.id)
        form.setValue('selectedDocumentIds', orderedSelected)
        return next
      })
    },
    [form, orderedDocs]
  )

  const toggleAllDocuments = useCallback(() => {
    if (selectedDocIds.size === orderedDocs.length) {
      setSelectedDocIds(new Set())
      form.setValue('selectedDocumentIds', [])
    } else {
      const allIds = orderedDocs.map((d) => d.id)
      setSelectedDocIds(new Set(allIds))
      form.setValue('selectedDocumentIds', allIds)
    }
  }, [selectedDocIds.size, orderedDocs, form])

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = orderedDocs.findIndex((d) => d.id === active.id)
      const newIndex = orderedDocs.findIndex((d) => d.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      const previousOrder = orderedDocs
      const nextOrder = arrayMove(orderedDocs, oldIndex, newIndex)

      // Optimistic update
      setOrderedDocs(nextOrder)
      const newSelectedIds = nextOrder.filter((d) => selectedDocIds.has(d.id)).map((d) => d.id)
      form.setValue('selectedDocumentIds', newSelectedIds)

      setIsReordering(true)
      try {
        const result = await reorderAffiliationDocuments({
          affiliationId,
          orderedDocumentIds: nextOrder.map((d) => d.id),
        })
        if (!result.success) {
          // Rollback
          setOrderedDocs(previousOrder)
          const rolledBack = previousOrder.filter((d) => selectedDocIds.has(d.id)).map((d) => d.id)
          form.setValue('selectedDocumentIds', rolledBack)
          toast.error(result.error || 'Error al guardar el orden de documentos')
        }
      } catch (error) {
        setOrderedDocs(previousOrder)
        const rolledBack = previousOrder.filter((d) => selectedDocIds.has(d.id)).map((d) => d.id)
        form.setValue('selectedDocumentIds', rolledBack)
        console.error('Reorder error:', error)
        toast.error('Error al guardar el orden de documentos')
      } finally {
        setIsReordering(false)
      }
    },
    [orderedDocs, selectedDocIds, affiliationId, form]
  )

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
      emailNotes: form.getValues('emailNotes'),
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
        selectedDocumentIds: orderedDocs
          .filter((d) => selectedDocIds.has(d.id))
          .map((d) => d.id),
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

  // Send test email
  const handleSendTest = async () => {
    const subject = form.getValues('subject')
    const emailBody = form.getValues('emailBody')
    const emailNotes = form.getValues('emailNotes')

    if (!testEmailTo || !subject || !emailBody) {
      toast.error('Completa el asunto y cuerpo antes de enviar una prueba')
      return
    }

    setIsSendingTest(true)
    try {
      const result = await sendTestAffiliationEmail({ to: testEmailTo, subject, emailBody, emailNotes })
      if (result.success) {
        toast.success(result.message || `Correo de prueba enviado a ${testEmailTo}`)
        setTestEmailOpen(false)
        setTestEmailTo('')
      } else {
        toast.error(result.error || 'Error al enviar el correo de prueba')
      }
    } catch (error) {
      console.error('Error sending test email:', error)
      toast.error('Error inesperado al enviar el correo de prueba')
    } finally {
      setIsSendingTest(false)
    }
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
                    {selectedDocIds.size === orderedDocs.length
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
                {orderedDocs.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">Sin documentos</p>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground mb-2">
                      Arrastrá con <GripVertical className="inline h-3 w-3 align-text-bottom" /> para reordenar. El orden se conserva al enviar.
                    </p>
                    <ScrollArea className="max-h-[400px]">
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                      >
                        <SortableContext
                          items={orderedDocs.map((d) => d.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="space-y-1">
                            {orderedDocs.map((doc) => (
                              <SortableDocRow
                                key={doc.id}
                                doc={doc}
                                checked={selectedDocIds.has(doc.id)}
                                onToggle={() => toggleDocument(doc.id)}
                                disabled={isReordering}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    </ScrollArea>
                  </>
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

                    {/* Notes (novedades) */}
                    <FormField
                      control={form.control}
                      name="emailNotes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Novedades (opcional)</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Ej: NOVEDAD DE RETIRO DE RAFAEL CANO 02/03"
                              className="min-h-[70px] text-sm"
                              {...field}
                              value={field.value ?? ''}
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground">
                            Se insertan al inicio del correo y quedan registradas en auditoría.
                          </p>
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
                        disabled={isSending || isSendingTest}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setTestEmailOpen(true)}
                        disabled={isSending || isSendingTest}
                        className="gap-2"
                      >
                        <FlaskConical className="h-4 w-4" />
                        Enviar Prueba
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            disabled={isSending || isSendingTest || exceedsLimit}
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
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Confirmar envío?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción archivará permanentemente la afiliación y enviará el correo al cliente. ¿Deseas continuar?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel disabled={isSending}>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => form.handleSubmit(onSubmit)()}
                              disabled={isSending}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              {isSending ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  Enviando...
                                </>
                              ) : (
                                'Confirmar envío'
                              )}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Tabs>
            </Card>
          </div>
        </div>
      </form>

      {/* Test email dialog */}
      <Dialog open={testEmailOpen} onOpenChange={(open) => { setTestEmailOpen(open); if (!open) setTestEmailTo('') }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar correo de prueba</DialogTitle>
            <DialogDescription>
              Ingresa el correo al que deseas enviar la prueba. No archivará la afiliación.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="test-email">Destinatario</Label>
            <Input
              id="test-email"
              type="email"
              placeholder="correo@ejemplo.com"
              value={testEmailTo}
              onChange={(e) => setTestEmailTo(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSendTest() } }}
              disabled={isSendingTest}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => { setTestEmailOpen(false); setTestEmailTo('') }}
              disabled={isSendingTest}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSendTest}
              disabled={isSendingTest || !testEmailTo.trim()}
              className="gap-2"
            >
              {isSendingTest ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <FlaskConical className="h-4 w-4" />
                  Enviar prueba
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Form>
  )
}
