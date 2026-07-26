/**
 * Cached read layer over the Alegra client.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * `AlegraClient` sends `cache: 'no-store'` on every request by design — the
 * transport is dumb on purpose. All caching policy lives here, in one place,
 * so you can answer "how stale can this number be?" by reading a single
 * table (`ALEGRA_TTL`) instead of auditing five page components.
 *
 * The pressure this relieves is concrete: Alegra allows 150 requests per
 * minute per user. The finances home page alone fires 6 requests per view.
 * Uncached, ~25 concurrent home-page views per minute saturate the quota for
 * the WHOLE account — including any other integration sharing the token.
 *
 * TTL POLICY (agreed with the operator)
 * -------------------------------------
 *   company  1h    — currency/locale config. Effectively never changes.
 *   kpis     5min  — aggregates on the home page. The 6-request page.
 *   list     30s   — invoice/estimate tables. Operational view.
 *   detail   30s   — single document view.
 *
 * THE STALENESS TRADE-OFF — read this before changing a number
 * ------------------------------------------------------------
 * With `kpis` at 5 minutes, a payment registered in Alegra can take up to
 * five minutes to move the KPI cards. That is a deliberate choice, not an
 * oversight, and it is why `refreshFinances()` (lib/actions/finances.actions.ts)
 * exists: the "Actualizar" button drops every tag so an operator who knows
 * something changed never has to wait out the TTL.
 *
 * ⚠️ MUST only be imported from Server Components or Server Actions.
 * `unstable_cache` and the underlying client are both server-only.
 */

import { unstable_cache } from 'next/cache'
import { getAlegraClient } from './client'
import {
  collectEstimatesInRange,
  type EstimatesRangeResult,
} from './estimates-range'
import type {
  Company,
  EstimateDetail,
  EstimateListResponse,
  InvoiceDetail,
  InvoiceListResponse,
  ListEstimatesParams,
  ListInvoicesParams,
} from './types'

// -----------------------------------------------------------------------------
// Tags & TTLs
// -----------------------------------------------------------------------------

/**
 * Cache tags. `all` is applied to EVERY entry so a single
 * `revalidateTag(ALEGRA_TAGS.all)` is a complete flush — that's what the
 * refresh button uses. The narrower tags allow targeted invalidation later
 * (e.g. a webhook that only touches invoices) without a redesign.
 */
export const ALEGRA_TAGS = {
  all: 'alegra',
  company: 'alegra:company',
  invoices: 'alegra:invoices',
  estimates: 'alegra:estimates',
} as const

/** Revalidation windows in SECONDS (the unit `unstable_cache` expects). */
export const ALEGRA_TTL = {
  company: 3_600,
  kpis: 300,
  list: 30,
  detail: 30,
} as const

// -----------------------------------------------------------------------------
// Key derivation
// -----------------------------------------------------------------------------

/**
 * Build a deterministic cache-key fragment from a params object.
 *
 * `JSON.stringify` alone is NOT safe here: key order follows insertion
 * order, so `{status, page}` and `{page, status}` — semantically identical
 * filters arriving from different call sites — would serialize differently
 * and occupy two cache entries. Sorting the keys makes the fragment a
 * function of the VALUES, not of how the object happened to be built.
 *
 * `undefined` values are dropped so an explicitly-absent filter keys the
 * same as an omitted one (the client skips them when building the URL, so
 * they'd hit the same upstream URL anyway — they must share a cache entry).
 */
export function stableKey(params: Record<string, unknown>): string {
  const entries = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${String(value)}`)

  return entries.length > 0 ? entries.join('&') : '__empty__'
}

// -----------------------------------------------------------------------------
// Cached readers
// -----------------------------------------------------------------------------

/**
 * Company config (currency, decimal precision).
 *
 * The single highest-value cache in the module: every page in the segment
 * calls it purely to learn the currency code, and that answer is stable for
 * the lifetime of the account. Caching it removes one upstream request from
 * every single finances page view.
 */
export const getCachedCompany = unstable_cache(
  async (): Promise<Company> => getAlegraClient().getCompany(),
  ['alegra', 'company'],
  {
    revalidate: ALEGRA_TTL.company,
    tags: [ALEGRA_TAGS.all, ALEGRA_TAGS.company],
  },
)

/**
 * Invoice list. `ttl` is a parameter because the same endpoint backs both
 * the KPI aggregates (5min is fine) and the operational table (30s), and
 * baking one number in would force the stricter policy on both.
 */
export function getCachedInvoices(
  params: ListInvoicesParams,
  ttl: number = ALEGRA_TTL.list,
): Promise<InvoiceListResponse> {
  const key = stableKey(params)

  return unstable_cache(
    async () => getAlegraClient().listInvoices(params),
    ['alegra', 'invoices', 'list', key, String(ttl)],
    {
      revalidate: ttl,
      tags: [ALEGRA_TAGS.all, ALEGRA_TAGS.invoices],
    },
  )()
}

/** Single invoice detail. */
export function getCachedInvoice(id: string): Promise<InvoiceDetail> {
  return unstable_cache(
    async () => getAlegraClient().getInvoice(id),
    ['alegra', 'invoices', 'detail', id],
    {
      revalidate: ALEGRA_TTL.detail,
      tags: [ALEGRA_TAGS.all, ALEGRA_TAGS.invoices],
    },
  )()
}

/** Estimate list. Same `ttl` rationale as `getCachedInvoices`. */
export function getCachedEstimates(
  params: ListEstimatesParams,
  ttl: number = ALEGRA_TTL.list,
): Promise<EstimateListResponse> {
  const key = stableKey(params)

  return unstable_cache(
    async () => getAlegraClient().listEstimates(params),
    ['alegra', 'estimates', 'list', key, String(ttl)],
    {
      revalidate: ttl,
      tags: [ALEGRA_TAGS.all, ALEGRA_TAGS.estimates],
    },
  )()
}

/** Query accepted by `getCachedEstimatesInRange`. */
export interface EstimatesRangeQuery {
  dateFrom: string | null
  dateTo: string | null
  /** Substring match handed to Alegra's `client_name` (server-side filter). */
  clientName?: string | null
}

/**
 * Every estimate whose `date` falls in [dateFrom, dateTo], paginating as far
 * as needed instead of trusting a single 30-row page.
 *
 * `order_field: 'date'` is now forced inside `AlegraClient.listEstimates`
 * (see the note there), so it isn't repeated here. It remains load-bearing:
 * the walk stops at the first document older than the range, which is only a
 * valid shortcut while the list is genuinely date-sorted.
 *
 * `clientName` goes to the API as a real server-side filter, so combining it
 * with a date range narrows the walk instead of widening it.
 *
 * The whole aggregate is cached as one entry — the individual pages still go
 * through the client's single-flight de-duplication on a cold read.
 */
export function getCachedEstimatesInRange(
  { dateFrom, dateTo, clientName = null }: EstimatesRangeQuery,
  ttl: number = ALEGRA_TTL.kpis,
): Promise<EstimatesRangeResult> {
  const key = stableKey({ from: dateFrom, to: dateTo, client: clientName })

  return unstable_cache(
    async () =>
      collectEstimatesInRange(
        (start, limit) =>
          getAlegraClient().listEstimates({
            start,
            limit,
            client_name: clientName ?? undefined,
          }),
        { dateFrom, dateTo },
      ),
    ['alegra', 'estimates', 'range', key, String(ttl)],
    {
      revalidate: ttl,
      tags: [ALEGRA_TAGS.all, ALEGRA_TAGS.estimates],
    },
  )()
}

/** Single estimate detail. */
export function getCachedEstimate(id: string): Promise<EstimateDetail> {
  return unstable_cache(
    async () => getAlegraClient().getEstimate(id),
    ['alegra', 'estimates', 'detail', id],
    {
      revalidate: ALEGRA_TTL.detail,
      tags: [ALEGRA_TAGS.all, ALEGRA_TAGS.estimates],
    },
  )()
}
