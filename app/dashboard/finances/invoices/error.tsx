'use client'

/**
 * Error boundary for /dashboard/finances/invoices (list page).
 *
 * Classification + UI messages live in `@/lib/alegra/error-ui`.
 */

import { FinancesErrorShell } from '@/lib/alegra/error-ui'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function InvoicesListError({ error, reset }: ErrorProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Facturas de venta</h1>
        <p className="text-muted-foreground">Listado de facturas — Alegra</p>
      </div>
      <FinancesErrorShell
        error={error}
        reset={reset}
        surface="Listado de facturas"
        homeHref="/dashboard/finances/invoices"
      />
    </div>
  )
}
