import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { LeadsContainer } from '@/components/dashboard/leads/leads-container'
import { Button } from '@/components/ui/button'
import { listLeads } from '@/lib/actions/lead.actions'

export const metadata: Metadata = {
  title: 'Leads de WhatsApp | Dashboard',
}

// Access is enforced by app/dashboard/whatsapp/layout.tsx and, again, by every action.
export default async function LeadsPage() {
  const result = await listLeads({})

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leads</h1>
          <p className="text-muted-foreground">Personas que escribieron por WhatsApp y aún no son clientes.</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/whatsapp">
            <ArrowLeft className="h-4 w-4" />
            Volver a la bandeja
          </Link>
        </Button>
      </div>

      {result.success && result.data ? (
        <LeadsContainer initial={result.data} />
      ) : (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {result.error ?? 'No se pudieron cargar los leads.'}
        </div>
      )}
    </div>
  )
}
