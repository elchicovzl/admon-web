/**
 * Estimate Detail Page — `/dashboard/finances/estimates/[id]`.
 *
 * Structure:
 *   - Back link (renders immediately, no data needed)
 *   - <Suspense> wrapping the entire detail (header + body)
 *
 * The back link being outside the Suspense means users always have a way
 * out, even while the estimate is loading (which can take 1-2s against
 * Alegra's API). The skeleton mimics the full layout.
 *
 * Differences vs the invoice detail page:
 *   - NO PaymentsCard / RetentionsCard / DianEventsTimeline — estimates
 *     don't have payments, retentions, or DIAN events
 *   - Totals card is simplified (only the total — no balance / paid / retentions)
 *   - Header shows the seller + anotation + observations (not status)
 */

import { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getCachedCompany, getCachedEstimate } from '@/lib/alegra/cache'
import { EstimateDetailHeader } from '@/components/dashboard/finances/estimate-detail/header'
import { ClientCard } from '@/components/dashboard/finances/shared/client-card'
import { EstimateTotalsCard } from '@/components/dashboard/finances/estimate-detail/totals-card'
import { ItemsTable } from '@/components/dashboard/finances/shared/items-table'
import { EstimateDetailSkeleton } from '@/components/dashboard/finances/estimate-detail/skeleton'

export const metadata: Metadata = {
  title: 'Cotización | Finanzas',
  description: 'Detalle de cotización — Alegra',
}

// 'dynamic = force-dynamic' is inherited from app/dashboard/finances/layout.tsx.

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EstimateDetailPage({ params }: PageProps) {
  const { id } = await params

  return (
    <div className="space-y-6">
      {/* Back link — always visible, no data dependency */}
      <Button asChild variant="ghost" size="sm" className="gap-1 text-muted-foreground">
        <Link href="/dashboard/finances/estimates">
          <ArrowLeft className="h-4 w-4" />
          Volver al listado
        </Link>
      </Button>

      {/* Body — streamed via Suspense */}
      <Suspense fallback={<EstimateDetailSkeleton />}>
        <EstimateDetailAsync id={id} />
      </Suspense>
    </div>
  )
}

async function EstimateDetailAsync({ id }: { id: string }) {
  const [estimate, company] = await Promise.all([
    getCachedEstimate(id),
    getCachedCompany(),
  ])

  // Defensive: should never happen (empty id is rejected by the client).
  if (!estimate?.id) {
    notFound()
  }

  const currencyCode = company.currency.code

  return (
    <div className="space-y-6">
      <EstimateDetailHeader estimate={estimate} />

      {/* Client + totals */}
      <div className="grid gap-4 md:grid-cols-2">
        <ClientCard client={estimate.client} />
        <EstimateTotalsCard estimate={estimate} currencyCode={currencyCode} />
      </div>

      {/* Items (if any) */}
      {estimate.items && estimate.items.length > 0 && (
        <ItemsTable items={estimate.items} currencyCode={currencyCode} />
      )}
    </div>
  )
}