import type { Metadata } from 'next'
import { Suspense } from 'react'

import { InboxContainer } from '@/components/dashboard/whatsapp/inbox-container'
import { InboxSkeleton } from '@/components/dashboard/whatsapp/inbox-skeletons'
import { listConversations } from '@/lib/actions/whatsapp.actions'
import { getTemplateOptions } from '@/lib/whatsapp/outbound'

export const metadata: Metadata = {
  title: 'WhatsApp | Dashboard',
}

// Access is enforced by app/dashboard/whatsapp/layout.tsx and, again, by every action.
async function Inbox() {
  const result = await listConversations({})

  if (!result.success || !result.data) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {result.error ?? 'No se pudo cargar la bandeja de WhatsApp.'}
      </div>
    )
  }

  return <InboxContainer initial={result.data} templates={getTemplateOptions()} />
}

export default function WhatsAppPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">WhatsApp</h1>
        <p className="text-muted-foreground">
          Bandeja compartida de conversaciones con clientes.
        </p>
      </div>

      <Suspense fallback={<InboxSkeleton />}>
        <Inbox />
      </Suspense>
    </div>
  )
}
