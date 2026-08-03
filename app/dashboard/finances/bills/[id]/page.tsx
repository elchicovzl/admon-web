/**
 * Purchase Invoice Detail — `/dashboard/finances/bills/[id]`.
 *
 * Same structure as the sales invoice detail: back link outside Suspense so
 * there is always a way out while the document streams in.
 *
 * Differences vs the sales side:
 *   - Counterparty is a PROVIDER, not a client
 *   - No DIAN events timeline (those belong to electronic SALES invoices)
 *   - Totals are framed as a liability ("Por pagar", not "Saldo a cobrar")
 */

import { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getCachedBill, getCachedCompany } from '@/lib/alegra/cache'
import { BillDetailHeader } from '@/components/dashboard/finances/bill-detail/header'
import { BillTotalsCard } from '@/components/dashboard/finances/bill-detail/totals-card'
import { BillDetailSkeleton } from '@/components/dashboard/finances/bill-detail/skeleton'
import { ClientCard } from '@/components/dashboard/finances/shared/client-card'
import { ItemsTable } from '@/components/dashboard/finances/shared/items-table'
import { PaymentsCard } from '@/components/dashboard/finances/invoice-detail/payments-card'

export const metadata: Metadata = {
  title: 'Factura de compra | Finanzas',
  description: 'Detalle de factura de proveedor — Alegra',
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function BillDetailPage({ params }: PageProps) {
  const { id } = await params

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="gap-1 text-muted-foreground">
        <Link href="/dashboard/finances/bills">
          <ArrowLeft className="h-4 w-4" />
          Volver al listado
        </Link>
      </Button>

      <Suspense fallback={<BillDetailSkeleton />}>
        <BillDetailAsync id={id} />
      </Suspense>
    </div>
  )
}

async function BillDetailAsync({ id }: { id: string }) {
  const [bill, company] = await Promise.all([getCachedBill(id), getCachedCompany()])

  // Defensive: should never happen (empty id is rejected by the client).
  if (!bill?.id) {
    notFound()
  }

  const currencyCode = company.currency.code

  // Alegra nests bill line items under `purchases.items` on some accounts and
  // returns a flat `items` array on others. Accept both rather than showing an
  // empty table because of a shape difference.
  const items = bill.items ?? bill.purchases?.items ?? []

  return (
    <div className="space-y-6">
      <BillDetailHeader bill={bill} />

      <div className="grid gap-4 md:grid-cols-2">
        {bill.provider ? (
          <ClientCard client={bill.provider} title="Proveedor" />
        ) : (
          <div className="hidden md:block" aria-hidden />
        )}
        <BillTotalsCard bill={bill} currencyCode={currencyCode} />
      </div>

      {items.length > 0 && <ItemsTable items={items} currencyCode={currencyCode} />}

      {bill.payments && bill.payments.length > 0 && (
        <PaymentsCard
          payments={bill.payments}
          total={bill.total}
          totalPaid={bill.totalPaid}
          currencyCode={currencyCode}
        />
      )}
    </div>
  )
}
