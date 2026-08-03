'use client'

/**
 * Error boundary for /dashboard/finances/bills/[id] (detail page).
 * A 404 here is common — a bill id can be stale or belong to another account.
 */

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FinancesErrorShell } from '@/lib/alegra/error-ui'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function BillDetailError({ error, reset }: ErrorProps) {
  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="gap-1 text-muted-foreground">
        <Link href="/dashboard/finances/bills">
          <ArrowLeft className="h-4 w-4" />
          Volver al listado
        </Link>
      </Button>
      <FinancesErrorShell
        error={error}
        reset={reset}
        surface="Detalle de factura de compra"
        homeHref="/dashboard/finances/bills"
        resourceLabel="factura de compra"
      />
    </div>
  )
}
