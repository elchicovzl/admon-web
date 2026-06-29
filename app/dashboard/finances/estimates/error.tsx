'use client'

/**
 * Error boundary for /dashboard/finances/estimates (list page).
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

export default function EstimatesListError({ error, reset }: ErrorProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cotizaciones</h1>
        <p className="text-muted-foreground">Listado de cotizaciones — Alegra</p>
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