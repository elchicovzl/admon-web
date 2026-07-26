'use client'

/**
 * Error boundary for /dashboard/finances/bills (list page).
 * Classification + UI messages live in `@/lib/alegra/error-classifier`.
 */

import { FinancesErrorShell } from '@/lib/alegra/error-ui'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function BillsListError({ error, reset }: ErrorProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Facturas de compra</h1>
        <p className="text-muted-foreground">Listado de facturas de proveedor — Alegra</p>
      </div>
      <FinancesErrorShell
        error={error}
        reset={reset}
        surface="Listado de facturas de compra"
        homeHref="/dashboard/finances/bills"
        resourceLabel="factura de compra"
      />
    </div>
  )
}
