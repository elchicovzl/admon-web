'use client'

/**
 * Error boundary for /dashboard/finances/invoices/[id] (detail page).
 *
 * Classification + UI messages live in `@/lib/alegra/error-ui`.
 *
 * NOTE: this boundary uniquely handles `not_found` (404 when the invoice
 * ID doesn't exist in Alegra). The shared `classifyAlegraError` already
 * covers this case via the message-substring fallback, so no extra logic
 * is needed here.
 */

import { FinancesErrorShell } from '@/lib/alegra/error-ui'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function InvoiceDetailError({ error, reset }: ErrorProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Detalle de factura</h1>
        <p className="text-muted-foreground">Información de la factura emitida en Alegra</p>
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
