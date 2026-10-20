import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { Users } from 'lucide-react'

import { InboxContainer } from '@/components/dashboard/whatsapp/inbox-container'
import { InboxSkeleton } from '@/components/dashboard/whatsapp/inbox-skeletons'
import { Button } from '@/components/ui/button'
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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">WhatsApp</h1>
          <p className="text-muted-foreground">
            Bandeja compartida de conversaciones con clientes.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/whatsapp/leads">
            <Users className="h-4 w-4" />
            Leads
          </Link>
        </Button>
      </div>

      <Suspense fallback={<InboxSkeleton />}>
        <Inbox />
      </Suspense>
    </div>
  )
}
