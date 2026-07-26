/**
 * Invoice Detail Page — `/dashboard/finances/invoices/[id]`.
 *
 * Structure:
 *   - Back link (renders immediately, no data needed)
 *   - <Suspense> wrapping the entire detail (header + body)
 *
 * The back link being outside the Suspense means users always have a way
 * out, even while the invoice is loading (which can take 1-2s against
 * Alegra's API). The skeleton mimics the full layout.
 */

import { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getCachedCompany, getCachedInvoice } from '@/lib/alegra/cache'
import { DetailHeader } from '@/components/dashboard/finances/invoice-detail/header'
import { ClientCard } from '@/components/dashboard/finances/shared/client-card'
import { TotalsCard } from '@/components/dashboard/finances/invoice-detail/totals-card'
import { ItemsTable } from '@/components/dashboard/finances/shared/items-table'
import { PaymentsCard } from '@/components/dashboard/finances/invoice-detail/payments-card'
import { RetentionsCard } from '@/components/dashboard/finances/invoice-detail/retentions-card'
import { DianEventsTimeline } from '@/components/dashboard/finances/invoice-detail/dian-events-timeline'
import { InvoiceDetailSkeleton } from '@/components/dashboard/finances/invoice-detail/skeleton'

export const metadata: Metadata = {
  title: 'Factura | Finanzas',
  description: 'Detalle de factura — Alegra',
}

// 'dynamic = force-dynamic' is inherited from app/dashboard/finances/layout.tsx.

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function InvoiceDetailPage({ params }: PageProps) {
  const { id } = await params

  return (
    <div className="space-y-6">
      {/* Back link — always visible, no data dependency */}
      <Button asChild variant="ghost" size="sm" className="gap-1 text-muted-foreground">
        <Link href="/dashboard/finances/invoices">
          <ArrowLeft className="h-4 w-4" />
          Volver al listado
        </Link>
      </Button>

      {/* Body — streamed via Suspense */}
      <Suspense fallback={<InvoiceDetailSkeleton />}>
        <InvoiceDetailAsync id={id} />
      </Suspense>
    </div>
  )
}

async function InvoiceDetailAsync({ id }: { id: string }) {
  const [invoice, company] = await Promise.all([
    getCachedInvoice(id),
    getCachedCompany(),
  ])

  // Defensive: should never happen (empty id is rejected by the client).
  if (!invoice?.id) {
    notFound()
  }

  const currencyCode = company.currency.code

  return (
    <div className="space-y-6">
      <DetailHeader invoice={invoice} />

      {/* Client + totals */}
      <div className="grid gap-4 md:grid-cols-2">
        <ClientCard client={invoice.client} />
        <TotalsCard invoice={invoice} currencyCode={currencyCode} />
      </div>

      {/* Items (if any) */}
      {invoice.items && invoice.items.length > 0 && (
        <ItemsTable items={invoice.items} currencyCode={currencyCode} />
      )}

      {/* Payments + Retentions — side by side on wide screens */}
      <div className="grid gap-4 md:grid-cols-2">
        <PaymentsCard
          payments={invoice.payments ?? []}
          total={invoice.total}
          totalPaid={invoice.totalPaid}
          currencyCode={currencyCode}
        />
        {invoice.retentions && invoice.retentions.length > 0 ? (
          <RetentionsCard retentions={invoice.retentions} currencyCode={currencyCode} />
        ) : (
          // Empty placeholder to keep the grid balanced
          <div className="hidden md:block" aria-hidden />
        )}
      </div>

      {/* DIAN events timeline (only if events exist) */}
      {invoice.events && invoice.events.length > 0 && (
        <DianEventsTimeline events={invoice.events} />
      )}
    </div>
  )
}
