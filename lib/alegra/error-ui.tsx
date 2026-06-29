/**
 * Shared error → UI-message mapping for the /dashboard/finances boundaries.
 *
 * Centralized here so all 3 error.tsx files (home / list / detail) stay
 * in sync — the same error throws the same friendly message everywhere.
 *
 * Source of truth for classification is `error.digest` (which each
 * AlegraError constructor sets to its `code`). We fall back to substring-
 * matching on `error.message` ONLY when digest isn't useful — that path
 * works in dev (where Next.js preserves messages) but is intentionally
 * lossy in production (where Next.js masks messages), so the digest
 * branch is the reliable one.
 */

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

import {
  AuthError,
  RateLimitError,
  ValidationError,
} from '@/lib/alegra/errors'

/**
 * UI-facing classification of an error thrown by the Alegra integration.
 *
 * Distinct from `error.digest` (which is a code string like 'AUTH_ERROR')
 * — these `Category` values are for UI switching only.
 */
export type AlegraUiErrorCategory =
  | 'auth'           // 401, bad credentials
  | 'rate_limit'     // 429, retry later
  | 'not_found'      // 404 / invoice ID doesn't exist
  | 'validation'     // Zod / API shape drift
  | 'network'        // everything else (catch-all)

export interface AlegraUiError {
  category: AlegraUiErrorCategory
  title: string
  description: string
}

/**
 * Classify an arbitrary error into a UI-friendly {category, title, desc}.
 *
 * Order of preference (most reliable → least):
 *   1. `instanceof` checks on our typed errors (works in all environments)
 *   2. `error.digest` === 'CODE' string match (works in production — digest survives)
 *   3. Substring match on `error.message` (only works in dev — Next masks in prod)
 */
export function classifyAlegraError(err: unknown): AlegraUiError {
  const message = err instanceof Error ? err.message.toLowerCase() : ''

  // (1) Type-narrow — strongest signal, survives all boundaries.
  if (err instanceof AuthError) return AUTH
  if (err instanceof RateLimitError) return RATE_LIMIT
  if (err instanceof ValidationError) return VALIDATION

  // (2) Digest string — set by each AlegraError subclass constructor.
  const digest = err instanceof Error ? err.digest : undefined
  if (digest === 'AUTH_ERROR') return AUTH
  if (digest === 'RATE_LIMIT') return RATE_LIMIT
  if (digest === 'VALIDATION_ERROR') return VALIDATION

  // (3) Substring fallback (dev only). Order matters — most specific first.
  if (message.includes('not found') || message.includes('404')) return NOT_FOUND
  if (message.includes('credencial') || message.includes('auth') || message.includes('401')) return AUTH
  if (message.includes('rate limit') || message.includes('429')) return RATE_LIMIT
  if (message.includes('shape') || message.includes('validation') || message.includes('zod') || message.includes('inesperado')) return VALIDATION

  // Generic catch-all.
  return NETWORK
}

// -----------------------------------------------------------------------------
// Messages — one source of truth. Update these once, all 3 boundaries see it.
// -----------------------------------------------------------------------------

const AUTH: AlegraUiError = {
  category: 'auth',
  title: 'Credenciales de Alegra inválidas',
  description: 'El token guardado en las variables de entorno no funciona. Contactá al administrador.',
}

const RATE_LIMIT: AlegraUiError = {
  category: 'rate_limit',
  title: 'Alegra saturado',
  description: 'La API recibió muchas requests. Vuelve a intentar en un minuto.',
}

const NOT_FOUND: AlegraUiError = {
  category: 'not_found',
  title: 'Factura no encontrada',
  description: 'Alegra no devolvió datos para esta factura. Verificá el ID o que la factura aún exista.',
}

const VALIDATION: AlegraUiError = {
  category: 'validation',
  title: 'Alegra cambió su API',
  description: 'La respuesta de Alegra no coincide con lo esperado. Reportá al equipo de desarrollo.',
}

const NETWORK: AlegraUiError = {
  category: 'network',
  title: 'Error de conexión con Alegra',
  description: 'No se pudieron obtener los datos financieros. Verificá la conectividad y volvé a intentar.',
}

// -----------------------------------------------------------------------------
// Boundary-facing component
// -----------------------------------------------------------------------------

/**
 * Reusable error UI shell for the finances module.
 * Call from any error.tsx: return <FinancesErrorShell error={error} reset={reset} surface="Resumen" homeHref="..." />
 *
 * @param surface Human label for what page broke — shown in the heading
 *               ("Resumen", "Listado de facturas", "Detalle de factura")
 * @param homeHref Where the "← Volver" button points (typically /dashboard/finances)
 */
export function FinancesErrorShell({
  error,
  reset,
  surface,
  homeHref,
}: {
  error: Error & { digest?: string }
  reset: () => void
  surface: string
  homeHref: string
}) {
  const classified = classifyAlegraError(error)

  // Server-side log already happens; don't expose digest/stack to user.
  useEffect(() => {
    console.error('[Finances] error boundary:', error)
  }, [error])

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <CardTitle className="text-destructive">{classified.title}</CardTitle>
        </div>
        <CardDescription>{classified.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button onClick={reset}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Reintentar
        </Button>
        <Button asChild variant="outline">
          <Link href={homeHref}>← Volver al {surface.toLowerCase()}</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/dashboard">Inicio</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
