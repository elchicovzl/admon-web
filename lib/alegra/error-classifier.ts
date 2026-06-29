/**
 * Pure error → UI-message mapping for the /dashboard/finances boundaries.
 *
 * Kept as `.ts` (not `.tsx`) so Vitest can import it without needing the
 * React JSX transform. The JSX `<FinancesErrorShell>` consumer lives in
 * the sibling `error-ui.tsx` file.
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

import {
  AuthError,
  RateLimitError,
  ValidationError,
} from './errors'

/**
 * UI-facing classification of an error thrown by the Alegra integration.
 * Distinct from `error.digest` (which is a code string like 'AUTH_ERROR')
 * — these `Category` values are for UI switching only.
 */
export type AlegraUiErrorCategory =
  | 'auth'           // 401, bad credentials
  | 'rate_limit'     // 429, retry later
  | 'not_found'      // 404 / invoice ID doesn't exist
  | 'validation'     // Zod / API shape drift
  | 'network'        // everything else (catch-all: 5xx, fetch failures, unknown)

export interface AlegraUiError {
  category: AlegraUiErrorCategory
  title: string
  description: string
}

/**
 * Classify an arbitrary error into a UI-friendly {category, title, desc}.
 *
 * Order of preference (most reliable → least):
 *   (1) `instanceof` checks on our typed errors (works in all environments)
 *   (2) `error.digest` === 'CODE' string match (works in production — digest
 *       survives the Next.js boundary because it's serialized explicitly)
 *   (3) Substring match on `error.message` (only works in dev — Next masks
 *       messages in production; kept as a last-resort fallback)
 *
 * HTTP codes from `client.ts#handleHttpError` set their digest to
 * `HTTP_<status>` (e.g. 'HTTP_404'). We special-case 404 because it's
 * the one we can show a friendly message for; everything else falls
 * through to the generic NETWORK bucket.
 */
export function classifyAlegraError(err: unknown): AlegraUiError {
  const message = err instanceof Error ? err.message.toLowerCase() : ''

  // (1) Type-narrow — strongest signal, survives all boundaries.
  if (err instanceof AuthError) return AUTH
  if (err instanceof RateLimitError) return RATE_LIMIT
  if (err instanceof ValidationError) return VALIDATION

  // (2) Digest string — set by each AlegraError subclass constructor and
  // by the HTTP-error path in client.ts. These are the production-safe
  // branches (digest is the only field that survives Next.js's
  // message-masking in production error.tsx boundaries).
  const digest = err instanceof Error ? err.digest : undefined
  if (digest === 'AUTH_ERROR') return AUTH
  if (digest === 'RATE_LIMIT') return RATE_LIMIT
  if (digest === 'VALIDATION_ERROR') return VALIDATION
  if (digest === 'HTTP_404') return NOT_FOUND

  // (3) Substring fallback (dev only — Next masks messages in prod).
  // Order matters — most specific first.
  if (message.includes('not found') || message.includes('404')) return NOT_FOUND
  if (message.includes('credencial') || message.includes('auth') || message.includes('401')) return AUTH
  if (message.includes('rate limit') || message.includes('429')) return RATE_LIMIT
  if (
    message.includes('shape') ||
    message.includes('validation') ||
    message.includes('zod') ||
    message.includes('inesperado')
  ) return VALIDATION

  // Generic catch-all (network errors, 5xx, anything unrecognized).
  return NETWORK
}

// -----------------------------------------------------------------------------
// Messages — one source of truth. Update these once, all 3 boundaries see it.
// -----------------------------------------------------------------------------

const AUTH: AlegraUiError = {
  category: 'auth',
  title: 'Credenciales de Alegra inválidas',
  description:
    'El token guardado en las variables de entorno no funciona. Contactá al administrador.',
}

const RATE_LIMIT: AlegraUiError = {
  category: 'rate_limit',
  title: 'Alegra saturado',
  description: 'La API recibió muchas requests. Vuelve a intentar en un minuto.',
}

const NOT_FOUND: AlegraUiError = {
  category: 'not_found',
  title: 'Factura no encontrada',
  description:
    'Alegra no devolvió datos para esta factura. Verificá el ID o que la factura aún exista.',
}

const VALIDATION: AlegraUiError = {
  category: 'validation',
  title: 'Alegra cambió su API',
  description:
    'La respuesta de Alegra no coincide con lo esperado. Reportá al equipo de desarrollo.',
}

const NETWORK: AlegraUiError = {
  category: 'network',
  title: 'Error de conexión con Alegra',
  description:
    'No se pudieron obtener los datos financieros. Verificá la conectividad y volvé a intentar.',
}
