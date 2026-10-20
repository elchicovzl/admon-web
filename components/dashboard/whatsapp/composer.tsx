'use client'

import { useRef, useState } from 'react'
import { Loader2, Paperclip, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ATTACHMENT_ACCEPT, CAPTION_MAX_LENGTH, validateAttachment } from '@/lib/whatsapp/attachments'
import { REPLY_TEXT_MAX_LENGTH, type ComposerMode } from '@/lib/whatsapp/composer'
import type { TemplateKey, TemplateOption } from '@/lib/whatsapp/templates'
import { TemplatePicker } from './template-picker'

export interface ComposerHandlers {
  sending: boolean
  templates: TemplateOption[]
  /** Each resolves true when the message was queued, so the composer can clear itself. */
  onSendText: (text: string) => Promise<boolean>
  onSendTemplate: (key: TemplateKey, params: string[]) => Promise<boolean>
  onSendAttachment: (file: File, caption: string) => Promise<boolean>
}

interface ComposerProps extends ComposerHandlers {
  /** Null until the clock is available (first render): the composer stays disabled. */
  mode: ComposerMode | null
  displayName: string
}

/**
 * Reply box (WI-6). Inside the 24 h window: free text and one attachment (image or PDF). Outside
 * it: free text is disabled and only approved templates are offered. A CLOSED conversation is
 * locked. The server enforces the same rules, so this is guidance, not the guard.
 */
export function Composer({ mode, displayName, sending, templates, onSendText, onSendTemplate, onSendAttachment }: ComposerProps) {
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement | null>(null)

  if (!mode) {
    return (
      <footer className="border-t p-3">
        <Textarea disabled rows={1} placeholder="Cargando…" aria-label="Escribir mensaje" className="min-h-9 resize-none" />
      </footer>
    )
  }

  if (mode.mode === 'LOCKED') {
    return (
      <footer className="border-t p-3">
        <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">{mode.reason}</p>
      </footer>
    )
  }

  if (mode.mode === 'TEMPLATE_ONLY') {
    return (
      <footer className="space-y-2 border-t p-3">
        <p className="text-xs text-amber-600 dark:text-amber-400">
          La ventana de 24 horas está cerrada: no se puede escribir texto libre. Envíe una plantilla aprobada.
        </p>
        <TemplatePicker templates={templates} displayName={displayName} sending={sending} onSend={onSendTemplate} />
      </footer>
    )
  }

  const pickFile = (candidate: File | undefined) => {
    if (!candidate) return
    const checked = validateAttachment({ mimeType: candidate.type, sizeBytes: candidate.size, fileName: candidate.name })
    if (!checked.ok) {
      setFile(null)
      setFileError(checked.error)
      return
    }
    setFileError(null)
    setFile(candidate)
  }

  const clearFile = () => {
    setFile(null)
    setFileError(null)
    if (input.current) input.current.value = ''
  }

  const trimmed = text.trim()
  const canSend = !sending && (file !== null || trimmed.length > 0)

  const submit = async () => {
    if (!canSend) return
    const sent = file ? await onSendAttachment(file, trimmed) : await onSendText(trimmed)
    if (sent) {
      setText('')
      clearFile()
    }
  }

  return (
    <footer className="space-y-2 border-t p-3">
      {file && (
        <div className="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-2 text-sm">
          <span className="truncate">
            <Paperclip className="mr-1 inline h-4 w-4" aria-hidden />
            {file.name}
          </span>
          <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={clearFile} disabled={sending} aria-label="Quitar adjunto">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      {fileError && <p className="text-xs text-destructive">{fileError}</p>}

      <div className="flex items-end gap-2">
        <input
          ref={input}
          type="file"
          accept={ATTACHMENT_ACCEPT}
          className="hidden"
          onChange={(event) => pickFile(event.target.files?.[0])}
        />
        <Button type="button" size="icon" variant="outline" disabled={sending} onClick={() => input.current?.click()} aria-label="Adjuntar imagen o PDF">
          <Paperclip className="h-4 w-4" />
        </Button>
        <Textarea
          value={text}
          rows={1}
          maxLength={file ? CAPTION_MAX_LENGTH : REPLY_TEXT_MAX_LENGTH}
          disabled={sending}
          placeholder={file ? 'Texto del archivo (opcional)' : 'Escriba un mensaje'}
          aria-label="Escribir mensaje"
          className="max-h-40 min-h-9 resize-none"
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends; Shift+Enter adds a line. Ignore Enter while an IME composition is open.
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault()
              void submit()
            }
          }}
        />
        <Button type="button" size="icon" disabled={!canSend} onClick={() => void submit()} aria-label="Enviar">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </footer>
  )
}
