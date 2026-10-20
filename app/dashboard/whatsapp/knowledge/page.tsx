import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { ArrowLeft } from 'lucide-react'

import { KnowledgeContainer } from '@/components/dashboard/knowledge/knowledge-container'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getKnowledgeHealth, listKnowledgeDocuments } from '@/lib/actions/knowledge.actions'
import { embeddingModelKey } from '@/lib/ai/providers'
import { getAiConfig } from '@/lib/config/runtime-config'

export const metadata: Metadata = {
  title: 'Base de conocimiento | Dashboard',
}

// Access is enforced by app/dashboard/whatsapp/layout.tsx and, again, by every action and the upload route.
async function Knowledge() {
  const [list, health] = await Promise.all([listKnowledgeDocuments(), getKnowledgeHealth()])

  if (!list.success || !list.data) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {list.error ?? 'No se pudo cargar la base de conocimiento.'}
      </div>
    )
  }

  const config = getAiConfig()
  return (
    <KnowledgeContainer
      initialItems={list.data}
      initialHealth={health.success ? (health.data ?? null) : null}
      currentEmbeddingModel={embeddingModelKey(config)}
      maxUploadBytes={config.kbUploadMaxBytes}
    />
  )
}

function KnowledgeSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-28" />
      <Skeleton className="h-64" />
    </div>
  )
}

export default function KnowledgePage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Base de conocimiento</h1>
          <p className="text-muted-foreground">Documentos con los que el asistente de WhatsApp responde.</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/whatsapp">
            <ArrowLeft className="h-4 w-4" />
            Volver a la bandeja
          </Link>
        </Button>
      </div>

      <Suspense fallback={<KnowledgeSkeleton />}>
        <Knowledge />
      </Suspense>
    </div>
  )
}
