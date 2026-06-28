/**
 * Alegra API client (V1 — read-only, invoices).
 *
 * Singleton server-only HTTP client that wraps `fetch` with:
 *   - HTTP Basic auth from env (ALEGRA_EMAIL + ALEGRA_TOKEN)
 *   - Rate limit awareness via X-Rate-Limit-* response headers
 *   - Typed errors (Auth / RateLimit / Validation / Generic)
 *   - Zod validation on every response (catches upstream API drift)
 *   - 10s timeout per request (no hanging)
 *   - `cache: 'no-store'` (always fresh data, never Next.js-cached)
 *
 * MUST only be imported from Server Components or Server Actions.
 * Importing from a Client Component will fail at build time because of
 * the server-only env var dependency.
 */

import { z } from 'zod'
import {
  AlegraError,
  AuthError,
  RateLimitError,
  ValidationError,
} from './errors'
import {
  CompanySchema,
  InvoiceDetailSchema,
  InvoiceListResponseSchema,
  type Company,
  type InvoiceDetail,
  type InvoiceListResponse,
  type ListInvoicesParams,
} from './types'

const BASE_URL = 'https://api.alegra.com/api/v1'
const DEFAULT_TIMEOUT_MS = 10_000
const RATE_LIMIT_SAFETY_THRESHOLD = 5
const RATE_LIMIT_MAX_WAIT_MS = 60_000

interface RateLimitState {
  remaining: number
  resetAt: number // epoch ms when window resets
}

// -----------------------------------------------------------------------------
// Singleton
// -----------------------------------------------------------------------------

let _client: AlegraClient | null = null

/**
 * Get the process-wide AlegraClient singleton.
 * Construction is deferred until first call so the env var check happens
 * at request time (rather than module load time, which would crash the
 * build when env vars are absent in CI).
 */
export function getAlegraClient(): AlegraClient {
  if (!_client) {
    _client = new AlegraClient()
  }
  return _client
}

// -----------------------------------------------------------------------------
// Client class
// -----------------------------------------------------------------------------

export class AlegraClient {
  private readonly authHeader: string
  private rateLimit: RateLimitState = { remaining: 150, resetAt: 0 }

  constructor() {
    const email = process.env.ALEGRA_EMAIL
    const token = process.env.ALEGRA_TOKEN

    if (!email || !token) {
      throw new Error(
        '[Alegra] Faltan variables de entorno: ALEGRA_EMAIL y ALEGRA_TOKEN son requeridas.',
      )
    }

    this.authHeader = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`
  }

  // ---------------------------------------------------------------------------
  // Public API (V1: invoices + company)
  // ---------------------------------------------------------------------------

  /** List invoices with optional filters. */
  async listInvoices(params: ListInvoicesParams = {}): Promise<InvoiceListResponse> {
    // Default to metadata=true so we always get the total count for pagination.
    const normalized: ListInvoicesParams = { metadata: true, ...params }
    return this.request('/invoices', normalized, InvoiceListResponseSchema)
  }

  /** Get full invoice detail by id. */
  async getInvoice(id: string): Promise<InvoiceDetail> {
    if (!id || typeof id !== 'string') {
      throw new ValidationError('invoice id is required', { id })
    }
    return this.request(`/invoices/${encodeURIComponent(id)}`, undefined, InvoiceDetailSchema)
  }

  /**
   * Get company info (currency, locale, decimal precision).
   * Used by the UI to know how to format amounts (Intl.NumberFormat).
   */
  async getCompany(): Promise<Company> {
    return this.request('/company', undefined, CompanySchema)
  }

  // ---------------------------------------------------------------------------
  // Core request method
  // ---------------------------------------------------------------------------

  private async request<T>(
    path: string,
    params: Record<string, unknown> | undefined,
    schema: z.ZodSchema<T>,
  ): Promise<T> {
    await this.waitForRateLimit()

    const url = this.buildUrl(path, params)
    const init: RequestInit = {
      headers: { Authorization: this.authHeader },
      cache: 'no-store',
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    }

    let res: Response
    try {
      res = await fetch(url.toString(), init)
    } catch (err) {
      // Network error, DNS failure, timeout, etc.
      const message = err instanceof Error ? err.message : 'fetch failed'
      throw new AlegraError('NETWORK_ERROR', `Alegra request failed: ${message}`, { url: url.toString() })
    }

    this.updateRateLimitFromHeaders(res.headers)

    if (!res.ok) {
      await this.handleHttpError(res)
    }

    let json: unknown
    try {
      json = await res.json()
    } catch (err) {
      throw new ValidationError('Alegra returned a non-JSON response', {
        status: res.status,
        contentType: res.headers.get('content-type'),
        parseError: err instanceof Error ? err.message : 'unknown',
      })
    }

    const parsed = schema.safeParse(json)
    if (!parsed.success) {
      // Log to server console so we can spot upstream API drift quickly.
      console.error('[Alegra] Zod validation failed:', {
        path,
        issues: parsed.error.issues,
      })
      throw new ValidationError(
        'Alegra devolvió un shape inesperado',
        parsed.error.format(),
      )
    }

    return parsed.data
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private buildUrl(path: string, params: Record<string, unknown> | undefined): URL {
    const url = new URL(`${BASE_URL}${path}`)
    if (!params) return url

    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') continue
      url.searchParams.append(key, String(value))
    }
    return url
  }

  private updateRateLimitFromHeaders(headers: Headers): void {
    const remaining = headers.get('X-Rate-Limit-Remaining')
    const reset = headers.get('X-Rate-Limit-Reset')

    if (remaining !== null) {
      const parsed = Number(remaining)
      if (!isNaN(parsed)) this.rateLimit.remaining = parsed
    }

    if (reset !== null) {
      const parsed = Number(reset)
      if (!isNaN(parsed)) {
        this.rateLimit.resetAt = Date.now() + parsed * 1000
      }
    }
  }

  private async waitForRateLimit(): Promise<void> {
    if (this.rateLimit.remaining > RATE_LIMIT_SAFETY_THRESHOLD) return

    const sleepMs = Math.max(0, this.rateLimit.resetAt - Date.now())
    if (sleepMs === 0) {
      // resetAt hasn't been set yet (first request). Don't block.
      return
    }
    if (sleepMs > RATE_LIMIT_MAX_WAIT_MS) {
      // Would wait too long. Let the request go and surface a 429 if it hits.
      return
    }

    console.warn(
      `[Alegra] rate limit bajo (${this.rateLimit.remaining} restantes), esperando ${Math.ceil(sleepMs / 1000)}s`,
    )
    await new Promise<void>((resolve) => setTimeout(resolve, sleepMs))
  }

  private async handleHttpError(res: Response): Promise<never> {
    let body: { code?: number; error?: string } = {}
    try {
      body = await res.json()
    } catch {
      // body might not be JSON; ignore
    }

    if (res.status === 401) {
      throw new AuthError(body.error ?? 'Credenciales inválidas')
    }
    if (res.status === 429) {
      throw new RateLimitError(
        body.error ?? 'Rate limit exceeded',
        this.rateLimit.resetAt,
      )
    }
    throw new AlegraError(
      `HTTP_${res.status}`,
      body.error ?? res.statusText,
      { status: res.status, body },
    )
  }

  // ---------------------------------------------------------------------------
  // Introspection (for tests and observability)
  // ---------------------------------------------------------------------------

  /** Read the current rate limit state. Used by tests and metrics. */
  getRateLimitState(): Readonly<RateLimitState> {
    return { ...this.rateLimit }
  }
}
