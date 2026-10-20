'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FileText, Loader2 } from 'lucide-react'
import { getMediaUrl, type MediaUrl } from '@/lib/actions/whatsapp.actions'
import type { MessageType } from '@prisma/client'
import type { ThreadMedia } from '@/lib/types/whatsapp.types'
import { mediaKind, messageTypeLabel } from '@/lib/whatsapp/inbox'

/** True once the element has been on screen, so presigned URLs are only requested for what is seen. */
function useSeen<T extends Element>() {
  const ref = useRef<T | null>(null)
  const [seen, setSeen] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node || seen) return
    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true)
      return
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setSeen(true)
        observer.disconnect()
      }
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [seen])

  return { ref, seen }
}

const UNAVAILABLE: Record<string, string> = {
  FAILED: 'No se pudo descargar el archivo',
  TOO_LARGE: 'Archivo demasiado grande',
  UNSUPPORTED: 'Tipo de archivo no compatible',
}

interface MessageMediaProps {
  messageId: string
  type: MessageType
  media: ThreadMedia
}

/**
 * Attachment inside a bubble. Files are only reachable through the `getMediaUrl` action
 * (10 min presigned URL); the storage key never reaches the browser.
 */
export function MessageMedia({ messageId, type, media }: MessageMediaProps) {
  const { ref, seen } = useSeen<HTMLDivElement>()
  const [url, setUrl] = useState<MediaUrl | null>(null)
  const [failed, setFailed] = useState(false)
  const retried = useRef(false)

  const kind = mediaKind(type, media.mimeType)
  const stored = media.status === 'STORED'

  const load = useCallback(async () => {
    const result = await getMediaUrl({ messageId })
    if (result.success && result.data) {
      setUrl(result.data)
      setFailed(false)
    } else {
      setFailed(true)
    }
  }, [messageId])

  useEffect(() => {
    if (seen && stored && !url && !failed) void load()
  }, [seen, stored, url, failed, load])

  // An expired URL fails to render: ask for a fresh one once.
  const onRenderError = () => {
    if (retried.current) return setFailed(true)
    retried.current = true
    void load()
  }

  const label = media.fileName ?? messageTypeLabel(type)
  let body: React.ReactNode

  if (media.status === 'PENDING') {
    body = (
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Descargando archivo…
      </span>
    )
  } else if (!stored) {
    body = <span className="text-xs italic text-muted-foreground">{UNAVAILABLE[media.status] ?? 'Archivo no disponible'}</span>
  } else if (failed) {
    body = <span className="text-xs italic text-muted-foreground">No se pudo cargar el archivo</span>
  } else if (!url) {
    body = <span className="block h-24 w-40 animate-pulse rounded-md bg-muted" aria-hidden />
  } else if (kind === 'image') {
    body = (
      <a href={url.url} target="_blank" rel="noopener noreferrer">
        {/* Presigned, short-lived URL: next/image optimization does not apply. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url.url}
          alt={label}
          loading="lazy"
          onError={onRenderError}
          className="max-h-64 max-w-full rounded-md object-cover"
        />
      </a>
    )
  } else if (kind === 'audio') {
    body = <audio controls preload="none" src={url.url} onError={onRenderError} className="h-10 w-full max-w-64" />
  } else {
    body = (
      <a
        href={url.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 text-sm underline underline-offset-2"
      >
        <FileText className="h-4 w-4 shrink-0" />
        <span className="truncate">{label}</span>
      </a>
    )
  }

  return (
    <div ref={ref} className="space-y-1">
      {body}
      {kind === 'audio' && <Transcript media={media} />}
    </div>
  )
}

function Transcript({ media }: { media: ThreadMedia }) {
  if (media.transcriptStatus === 'DONE' && media.transcript) {
    return <p className="text-xs italic text-muted-foreground">“{media.transcript}”</p>
  }
  if (media.transcriptStatus === 'FAILED') {
    return <p className="text-xs italic text-muted-foreground">Transcripción fallida</p>
  }
  if (media.transcriptStatus === 'PENDING') {
    return <p className="text-xs italic text-muted-foreground">Transcribiendo…</p>
  }
  return null
}
