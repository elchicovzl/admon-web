'use client'

/**
 * Error boundary for /dashboard/finances (home / KPIs).
 *
 * Classification + UI messages live in `@/lib/alegra/error-ui` so all
 * three finance error boundaries stay in sync.
 */

import { FinancesErrorShell } from '@/lib/alegra/error-ui'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function FinancesHomeError({ error, reset }: ErrorProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Finanzas</h1>
        <p className="text-muted-foreground">Resumen de facturación</p>
      </div>
      <FinancesErrorShell
        error={error}
        reset={reset}
        surface="Resumen"
        homeHref="/dashboard/finances"
      />
    </div>
  )
}
