'use client'

/**
 * Error boundary for /dashboard/finances/payments.
 * Classification + UI messages live in `@/lib/alegra/error-classifier`.
 */

import { FinancesErrorShell } from '@/lib/alegra/error-ui'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function PaymentsListError({ error, reset }: ErrorProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pagos</h1>
        <p className="text-muted-foreground">Cobros y pagos registrados — Alegra</p>
      </div>
      <FinancesErrorShell
        error={error}
        reset={reset}
        surface="Listado de pagos"
        homeHref="/dashboard/finances/payments"
        resourceLabel="pago"
      />
    </div>
  )
}
