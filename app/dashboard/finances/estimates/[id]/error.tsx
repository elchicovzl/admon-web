'use client'

/**
 * Error boundary for /dashboard/finances/estimates/[id] (detail page).
 *
 * Classification + UI messages live in `@/lib/alegra/error-classifier`.
 * The `resourceLabel="cotización"` parameter customizes the NOT_FOUND
 * message so it says "este cotización" instead of the generic
 * "este documento" default.
 */

import { FinancesErrorShell } from '@/lib/alegra/error-ui'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function EstimateDetailError({ error, reset }: ErrorProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Detalle de cotización</h1>
        <p className="text-muted-foreground">Información de la cotización emitida en Alegra</p>
      </div>
      <FinancesErrorShell
        error={error}
        reset={reset}
        surface="Listado de cotizaciones"
        homeHref="/dashboard/finances/estimates"
        resourceLabel="cotización"
      />
    </div>
  )
}