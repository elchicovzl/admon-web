/**
 * Alegra API client (V1+ — read-only invoices + estimates + company).
 *
 * Singleton server-only HTTP client that wraps `fetch` with:
 *   - HTTP Basic auth from env (ALEGRA_EMAIL + ALEGRA_TOKEN)
 *   - Rate limit awareness via X-Rate-Limit-* response headers, with an
 *     OPTIMISTIC reservation so concurrent callers don't all sail past the
 *     same stale `remaining` value (see `acquireSlot`)
 *   - Automatic retry with backoff on 429 / 5xx / transient network errors
 *   - Single-flight de-duplication: N concurrent callers asking for the same
 *     URL produce ONE upstream request (see `inFlight`)
 *   - Typed errors (Auth / RateLimit / Validation / Generic)
 *   - Zod validation on every response (catches upstream API drift)
 *   - 10s timeout per attempt (no hanging)
 *   - `cache: 'no-store'` — this layer NEVER caches. Caching is a separate
 *     concern handled by `lib/alegra/cache.ts` (unstable_cache + tags), so
 *     the transport stays dumb and the TTL policy lives in one place.
 *
 * MUST only be imported from Server Components or Server Actions.
 * Importing from a Client Component will fail at build time because of
 * the server-only env var dependency.
 *
 * ⚠️ Single-replica assumption: the rate-limit state lives in process memory.
 * That is correct for the current Dokploy deploy (one container, one Node
 * process). If this ever scales horizontally, each replica will believe it
 * owns the full 150 req/min budget and the real limit will be exceeded —
 * at that point the state must move to a shared store (Postgres/Redis).
 */

import { z } from 'zod'
import {
  AlegraError,
  AuthError,
  RateLimitError,
  ValidationError,
} from './errors'
import {
  BillDetailSchema,
  BillListResponseSchema,
  CompanySchema,
  EstimateDetailSchema,
  EstimateListResponseSchema,
  InvoiceDetailSchema,
  InvoiceListResponseSchema,
  PaymentDetailSchema,
  PaymentListResponseSchema,
  type BillDetail,
  type BillListResponse,
  type Company,
  type EstimateDetail,
  type EstimateListResponse,
  type InvoiceDetail,
  type InvoiceListResponse,
  type ListBillsParams,
  type ListEstimatesParams,
  type ListInvoicesParams,
  type ListPaymentsParams,
  type PaymentDetail,
  type PaymentListResponse,
} from './types'

const BASE_URL = 'https://api.alegra.com/api/v1'
const DEFAULT_TIMEOUT_MS = 10_000
const RATE_LIMIT_SAFETY_THRESHOLD = 5
const RATE_LIMIT_MAX_WAIT_MS = 60_000

/**
 * Alegra's documented quota is 150 requests/minute/user. Used as the
 * optimistic starting budget and as the fallback wait window when we need
 * to back off before ever having seen an `X-Rate-Limit-Reset` header.
 */
const RATE_LIMIT_BUDGET = 150
const RATE_LIMIT_WINDOW_MS = 60_000

/** Retry policy — applies to 429, 5xx and transient network failures. */
const MAX_RETRIES = 2
const RETRY_BASE_DELAY_MS = 500
const RETRY_MAX_DELAY_MS = 8_000
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504])

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
  private rateLimit: RateLimitState = { remaining: RATE_LIMIT_BUDGET, resetAt: 0 }

  /**
   * In-flight request de-duplication ("single flight").
   *
   * Keyed by the fully-built URL. When two Server Components render
   * concurrently and both ask for `/company`, the second one awaits the
   * first one's promise instead of opening a second socket to Alegra.
   *
   * This matters most on a COLD cache: without it, the six parallel calls
   * on the finances home page could each trigger their own `/company`
   * fetch. With it, that collapses to one.
   *
   * ⚠️ Callers share the SAME resolved object reference. Nothing in this
   * codebase mutates Alegra responses (they flow straight into render), so
   * this is safe — but if you ever need to mutate one, clone it first.
   */
  private readonly inFlight = new Map<string, Promise<unknown>>()

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
  // Public API (V1: invoices + company + V2: estimates)
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
  // V2 — Estimates (cotizaciones)
  //
  // Differences vs /invoices (see mem: finances/v2-estimates-api-shape):
  //   - No `status` parameter — estimates don't have a status field
  //   - No date_after/date_before — only exact `date` filter; range filtering
  //     is done by walking pages in `lib/alegra/estimates-range.ts`
  //   - Default order_direction on the API is ASC; we force DESC for UI parity
  //     with the invoices list (newest first)
  //   - Default order_field on the API is `id` (creation order) — we force
  //     `date`. See the note on `listEstimates` below; this one has teeth.
  // ---------------------------------------------------------------------------

  /**
   * List estimates with optional filters.
   *
   * Both ordering defaults are forced here rather than left to the API:
   *
   *   order_direction: 'DESC'  — newest first, matching the invoices list.
   *   order_field:     'date'  — sort by the DOCUMENT date, not by id.
   *
   * That second one is not cosmetic. The API defaults to ordering by `id`,
   * i.e. creation order, and a cotización can be created today carrying last
   * month's date. Every caller that reasons about "the most recent N" or
   * stops paginating once it sees an out-of-range date is silently wrong
   * under an id-ordered list — which is exactly how the "Cotizado mes"
   * KPI ended up summing the wrong 30 documents.
   *
   * Forcing it at the transport closes the whole class of bug instead of
   * patching each call site. `...params` still spreads last, so a caller
   * with a genuine reason to sort differently can override.
   */
  async listEstimates(params: ListEstimatesParams = {}): Promise<EstimateListResponse> {
    const normalized: ListEstimatesParams = {
      metadata: true,
      order_field: 'date',
      order_direction: 'DESC',
      ...params,
    }
    return this.request('/estimates', normalized, EstimateListResponseSchema)
  }

  /** Get full estimate detail by id. */
  async getEstimate(id: string): Promise<EstimateDetail> {
    if (!id || typeof id !== 'string') {
      throw new ValidationError('estimate id is required', { id })
    }
    return this.request(`/estimates/${encodeURIComponent(id)}`, undefined, EstimateDetailSchema)
  }

  // ---------------------------------------------------------------------------
  // V3 — Bills (facturas de compra) — EGRESOS
  //
  // Same ordering discipline as /estimates: `order_field: 'date'` is forced
  // because the API defaults to id (creation order) and the date-range walk
  // stops early on the first out-of-range date.
  //
  // Like /estimates, /bills has NO date_after / date_before — only an exact
  // `date`. Range queries go through `lib/alegra/date-range-walk.ts`.
  // ---------------------------------------------------------------------------

  /** List purchase invoices (bills) with optional filters. */
  async listBills(params: ListBillsParams = {}): Promise<BillListResponse> {
    const normalized: ListBillsParams = {
      metadata: true,
      order_field: 'date',
      order_direction: 'DESC',
      ...params,
    }
    return this.request('/bills', normalized, BillListResponseSchema)
  }

  /** Get full bill detail by id. */
  async getBill(id: string): Promise<BillDetail> {
    if (!id || typeof id !== 'string') {
      throw new ValidationError('bill id is required', { id })
    }
    return this.request(`/bills/${encodeURIComponent(id)}`, undefined, BillDetailSchema)
  }

  // ---------------------------------------------------------------------------
  // V3 — Payments (pagos)
  //
  // Two non-obvious defaults are forced here:
  //
  //   order_field: 'date'  — same rationale as bills/estimates.
  //
  //   fields: 'associations,bills,categories' — the link arrays are what
  //     `classifyPaymentAssociation` reads to tell "this settles a bill we
  //     already counted in /bills" from "this is an expense that exists
  //     nowhere else". Get that wrong and the month's expenses either double
  //     or lose their uninvoiced half. `invoices` comes back by default;
  //     `bills` and `categories` are opt-in fields, and `bills` is precisely
  //     the one the expense side depends on.
  //
  // ⚠️ /payments has NO date filter at all — not even exact `date`. It is the
  // most restricted list endpoint of the four; every date-scoped read walks.
  // ---------------------------------------------------------------------------

  /** Extra fields required for expense classification. See the note above. */
  private static readonly PAYMENT_FIELDS = 'associations,bills,categories'

  /** List payments (both directions unless `type` narrows it). */
  async listPayments(params: ListPaymentsParams = {}): Promise<PaymentListResponse> {
    const normalized: ListPaymentsParams = {
      metadata: true,
      order_field: 'date',
      order_direction: 'DESC',
      fields: AlegraClient.PAYMENT_FIELDS,
      ...params,
    }
    return this.request('/payments', normalized, PaymentListResponseSchema)
  }

  /** Get a single payment by id. */
  async getPayment(id: string): Promise<PaymentDetail> {
    if (!id || typeof id !== 'string') {
      throw new ValidationError('payment id is required', { id })
    }
    return this.request(
      `/payments/${encodeURIComponent(id)}`,
      { fields: AlegraClient.PAYMENT_FIELDS },
      PaymentDetailSchema,
    )
  }

  // ---------------------------------------------------------------------------
  // Core request method
  // ---------------------------------------------------------------------------

  private async request<S extends z.ZodTypeAny>(
    path: string,
    params: Record<string, unknown> | undefined,
    // Generic schema parameter that lets TS infer the return type from the
    // schema itself (`z.infer<S>` is the OUTPUT type, after `.transform()`).
    // Previous incarnation used `z.ZodTypeAny` which decoupled T from the
    // schema and let the compiler accept mismatches like passing
    // EstimateDetailSchema with a Promise<Invoice> return type — which is
    // exactly how the KPI `date_after` bug slipped through. Constraining
    // `S` to `z.ZodTypeAny` (rather than `unknown`) keeps the variance
    // happy while still enforcing that the schema actually matches the
    // declared return type at every call site.
    schema: S,
  ): Promise<z.infer<S>> {
    const url = this.buildUrl(path, params)
    const key = url.toString()

    // ---- Single flight -------------------------------------------------
    // If an identical request is already running, ride along with it.
    const existing = this.inFlight.get(key)
    if (existing) return existing as Promise<z.infer<S>>

    const promise = this.executeWithRetry(path, key, schema)
      // Always evict, success or failure — a failed request must not
      // poison the key for subsequent callers.
      .finally(() => {
        this.inFlight.delete(key)
      })

    this.inFlight.set(key, promise)
    return promise
  }

  /**
   * Perform the request, retrying on 429 / 5xx / transient network errors.
   *
   * Non-retryable failures (401, 404, other 4xx, Zod validation, non-JSON
   * bodies) throw on the first attempt — retrying them just burns quota
   * against a deterministic failure.
   */
  private async executeWithRetry<S extends z.ZodTypeAny>(
    path: string,
    key: string,
    schema: S,
  ): Promise<z.infer<S>> {
    let lastError: unknown

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      await this.acquireSlot()

      let res: Response
      try {
        res = await fetch(key, {
          headers: { Authorization: this.authHeader },
          cache: 'no-store',
          // A fresh signal PER ATTEMPT — an AbortSignal is one-shot, reusing
          // one across retries would abort every attempt after the first.
          signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
        })
      } catch (err) {
        const isTimeout = err instanceof Error && err.name === 'TimeoutError'
        const message = err instanceof Error ? err.message : 'fetch failed'
        lastError = new AlegraError(
          isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
          `Alegra request failed: ${message}`,
          { url: key },
        )

        // Timeouts are NOT retried: each attempt already burned the full 10s
        // budget, and three of them would leave the user staring at a
        // skeleton for 30 seconds. Fail fast and let the boundary show.
        if (isTimeout || attempt === MAX_RETRIES) throw lastError

        await sleep(backoffDelay(attempt))
        continue
      }

      this.updateRateLimitFromHeaders(res.headers)

      if (res.ok) {
        return this.parseResponse(path, res, schema)
      }

      // ---- Error path ----------------------------------------------------
      if (RETRYABLE_STATUS.has(res.status) && attempt < MAX_RETRIES) {
        const waitMs =
          res.status === 429
            ? this.retryAfterMs(res.headers)
            : backoffDelay(attempt)

        // Only retry a 429 if the wait is bounded — otherwise surface it so
        // the user gets a real message instead of a request hanging for
        // minutes behind a skeleton.
        if (waitMs <= RATE_LIMIT_MAX_WAIT_MS) {
          console.warn(
            `[Alegra] ${res.status} en ${path} — reintento ${attempt + 1}/${MAX_RETRIES} en ${Math.ceil(waitMs / 1000)}s`,
          )
          await sleep(waitMs)
          continue
        }
      }

      await this.handleHttpError(res)
    }

    // Unreachable: the loop either returns or throws. Kept for exhaustiveness.
    throw lastError ?? new AlegraError('UNKNOWN', 'Alegra request failed')
  }

  /** Parse + Zod-validate a successful response body. */
  private async parseResponse<S extends z.ZodTypeAny>(
    path: string,
    res: Response,
    schema: S,
  ): Promise<z.infer<S>> {
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
      // Log a STRUCTURED, human-readable summary to the server console so the
      // developer/operator can immediately see which field of the schema
      // failed and what the upstream actually sent. Default Zod output uses
      // `[object Object]` for the issues array, which is useless in a server
      // log. Format it explicitly.
      console.error(formatValidationFailure(path, json, parsed.error.issues as never))
      throw new ValidationError(
        'Alegra devolvió un shape inesperado',
        {
          formatted: formatValidationFailure(path, json, parsed.error.issues as never),
          zod: parsed.error.format(),
        },
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

  /**
   * Gate a request on the local rate-limit budget, then OPTIMISTICALLY
   * reserve a slot.
   *
   * Why the reservation matters: `remaining` is only refreshed when a
   * response comes back. Without decrementing up-front, twenty concurrent
   * callers all read the same pre-flight value, all conclude they have
   * budget, and all fire — the gate never engages under exactly the load
   * it exists to protect against. Decrementing here means the Nth
   * concurrent caller sees the budget the first N-1 already committed to
   * spending. `updateRateLimitFromHeaders` then corrects the estimate with
   * the server's real number.
   */
  private async acquireSlot(): Promise<void> {
    if (this.rateLimit.remaining <= RATE_LIMIT_SAFETY_THRESHOLD) {
      // If we've never seen a reset header, fall back to a full window —
      // the previous behaviour (don't block at all) meant the very burst
      // that exhausted the budget sailed straight through.
      const untilReset = this.rateLimit.resetAt - Date.now()
      const sleepMs = untilReset > 0 ? untilReset : RATE_LIMIT_WINDOW_MS

      if (sleepMs <= RATE_LIMIT_MAX_WAIT_MS) {
        console.warn(
          `[Alegra] rate limit bajo (${this.rateLimit.remaining} restantes), esperando ${Math.ceil(sleepMs / 1000)}s`,
        )
        await sleep(sleepMs)
        // Window elapsed — assume the budget refilled. The next response's
        // headers will correct us if Alegra disagrees.
        this.rateLimit.remaining = RATE_LIMIT_BUDGET
        this.rateLimit.resetAt = 0
      }
      // If the wait would exceed the cap we fall through deliberately: let
      // the request go and surface a real 429 rather than stall for minutes.
    }

    this.rateLimit.remaining -= 1
  }

  /**
   * How long to wait before retrying a 429.
   *
   * Prefers the standard `Retry-After` header (seconds), falls back to
   * Alegra's `X-Rate-Limit-Reset`, and finally to a full window. Always
   * returns at least 1s so we never hot-loop against a throttling server.
   */
  private retryAfterMs(headers: Headers): number {
    const retryAfter = Number(headers.get('Retry-After'))
    if (Number.isFinite(retryAfter) && retryAfter > 0) {
      return Math.max(1_000, retryAfter * 1_000)
    }

    const untilReset = this.rateLimit.resetAt - Date.now()
    if (untilReset > 0) return Math.max(1_000, untilReset)

    return RATE_LIMIT_WINDOW_MS
  }

  private async handleHttpError(res: Response): Promise<never> {
    // The `catch` below only fires when res.json() REJECTS. A body that is
    // empty or the literal JSON `null` RESOLVES — to null — and reading
    // `.error` off it throws a TypeError that replaces the AlegraError we
    // were about to build. The boundary then classifies a clean 404 as a
    // generic "error de conexión". Hence the explicit shape guard.
    let body: { code?: number; error?: string } = {}
    try {
      const parsed: unknown = await res.json()
      if (parsed !== null && typeof parsed === 'object') {
        body = parsed as { code?: number; error?: string }
      }
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

// -----------------------------------------------------------------------------
// Retry helpers (exported for unit testing)
// -----------------------------------------------------------------------------

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Exponential backoff with full jitter: `random(0, base * 2^attempt)`,
 * capped at RETRY_MAX_DELAY_MS.
 *
 * The jitter is not decoration. Without it, N callers that hit the same 5xx
 * at the same moment all sleep the same duration and retry in the same
 * instant — a thundering herd that reproduces the overload it was meant to
 * relieve. Randomizing spreads the retries across the window.
 */
export function backoffDelay(attempt: number): number {
  const ceiling = Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS)
  return Math.random() * ceiling
}

// -----------------------------------------------------------------------------
// Validation error formatter (exported for unit testing)
// -----------------------------------------------------------------------------

/**
 * Format a Zod validation failure into a readable multi-line string with:
 *   - The request path
 *   - Each issue with its field path (e.g. "currency.code"), expected/received
 *   - For `invalid_union` issues, the nested failures from each branch
 *   - A truncated JSON preview of the upstream response
 *
 * Truncation is at 2 KB to keep logs bounded — large arrays are clipped.
 */
export function formatValidationFailure(
  requestPath: string,
  rawJson: unknown,
  issues: ReadonlyArray<{
    code?: string
    path: ReadonlyArray<string | number>
    message: string
    expected?: string
    received?: unknown
    unionErrors?: ReadonlyArray<{
      issues: ReadonlyArray<{
        path?: ReadonlyArray<string | number>
        message: string
        expected?: string
        received?: unknown
      }>
    }>
  }>,
): string {
  const MAX_PREVIEW_CHARS = 2000

  // Flatten `invalid_union` errors into their member issues so we see the
  // ACTUAL fields that failed, not just the union-level symptom.
  const flattened = flattenUnionIssues(issues)

  const issueLines = flattened.map((issue) => {
    const fieldPath = issue.path.length > 0 ? issue.path.join('.') : '(root)'
    const expected = issue.expected ? ` expected ${issue.expected}` : ''
    const received = issue.received !== undefined ? `, received ${JSON.stringify(issue.received)}` : ''
    return `  • ${fieldPath}: ${issue.message}${expected}${received}`
  })

  let preview: string
  if (rawJson === undefined) {
    preview = '(undefined — no JSON parsed)'
  } else if (rawJson === null) {
    preview = 'null'
  } else {
    try {
      preview = JSON.stringify(rawJson, null, 2)
    } catch {
      preview = '(could not serialize response — possibly circular)'
    }
  }
  if (preview.length > MAX_PREVIEW_CHARS) {
    preview = `${preview.slice(0, MAX_PREVIEW_CHARS)}\n  … (truncated at ${MAX_PREVIEW_CHARS} chars)`
  }

  return [
    `[Alegra] Zod validation failed at ${requestPath}:`,
    issueLines.join('\n') || '  • (no issues reported)',
    '',
    'Raw response:',
    preview,
  ].join('\n')
}

/**
 * Recursively flatten `invalid_union` Zod issues into the underlying
 * member-branch issues. Nested unions are also flattened.
 *
 * Why: when a `z.union([schemaA, schemaB])` fails, Zod reports a single
 * issue with code `invalid_union` and `unionErrors: [errorA, errorB]`.
 * The default issue.issues loop only shows the union-level message
 * ("Invalid input"), which is useless for debugging — you need to see
 * which field inside which branch failed.
 */
function flattenUnionIssues(
  issues: ReadonlyArray<{
    code?: string
    unionErrors?: ReadonlyArray<{ issues: ReadonlyArray<unknown> }>
  }>,
): Array<{
  path: ReadonlyArray<string | number>
  message: string
  expected?: string
  received?: unknown
}> {
  const out: Array<{
    path: ReadonlyArray<string | number>
    message: string
    expected?: string
    received?: unknown
  }> = []

  for (const issue of issues) {
    if (
      issue.code === 'invalid_union' &&
      Array.isArray(issue.unionErrors) &&
      issue.unionErrors.length > 0
    ) {
      // Recurse into each branch's issues
      for (const branch of issue.unionErrors) {
        if (Array.isArray(branch.issues)) {
          out.push(...flattenUnionIssues(branch.issues as never))
        }
      }
    } else {
      out.push(issue as never)
    }
  }

  return out
}
