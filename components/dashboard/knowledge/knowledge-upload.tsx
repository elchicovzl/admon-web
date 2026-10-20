'use client'

import { useRef, useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { KNOWLEDGE_TITLE_MAX_LENGTH } from '@/lib/validations/knowledge.schema'

const ACCEPT = '.pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown'
const UPLOAD_ERROR = 'No se pudo subir el documento'

interface KnowledgeUploadProps {
  maxBytes: number
  onUploaded: () => void
}

/** Upload form (KB-2). The server re-checks type, size and content; this only spares a round trip. */
export function KnowledgeUpload({ maxBytes, onUploaded }: KnowledgeUploadProps) {
  const fileInput = useRef<HTMLInputElement | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [uploading, setUploading] = useState(false)
  const maxMb = Math.floor(maxBytes / (1024 * 1024))

  const reset = () => {
    setFile(null)
    setTitle('')
    if (fileInput.current) fileInput.current.value = ''
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!file) return
    if (file.size > maxBytes) {
      toast.error(`El archivo supera el máximo de ${maxMb} MB.`)
      return
    }
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      if (title.trim()) form.append('title', title.trim())
      const response = await fetch('/api/whatsapp/knowledge', { method: 'POST', body: form })
      // A proxy error page (413, 502) is not JSON.
      const result = (await response.json().catch(() => null)) as
        | { success: boolean; data?: { queued: boolean }; error?: string }
        | null
      if (!result?.success) {
        toast.error(result?.error ?? UPLOAD_ERROR)
        return
      }
      toast.success(result.data?.queued ? 'Documento subido. Se está indexando.' : 'Documento subido, pero no se pudo programar la indexación.')
      reset()
      onUploaded()
    } catch {
      toast.error(UPLOAD_ERROR)
    } finally {
      setUploading(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <div className="space-y-2">
        <Label htmlFor="kb-file">Archivo</Label>
        <Input
          id="kb-file"
          ref={fileInput}
          type="file"
          accept={ACCEPT}
          disabled={uploading}
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        <p className="text-xs text-muted-foreground">PDF con texto, DOCX, TXT o MD. Máximo {maxMb} MB.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="kb-title">Título (opcional)</Label>
        <Input
          id="kb-title"
          value={title}
          maxLength={KNOWLEDGE_TITLE_MAX_LENGTH}
          disabled={uploading}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Por defecto, el nombre del archivo"
        />
        <p className="text-xs text-muted-foreground sm:invisible">&nbsp;</p>
      </div>
      <div className="sm:pb-6">
        <Button type="submit" disabled={!file || uploading} className="w-full sm:w-auto">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Subir
        </Button>
      </div>
    </form>
  )
}
