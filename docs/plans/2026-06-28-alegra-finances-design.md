# Alegra Finance Module - Design Document

**Date:** 2026-06-28
**Status:** SHIPPED ✅ (V1 closed 2026-06-28; verified end-to-end against ADMINISTRACION SEGURA S.A.S Alegra account)
**Author:** Claude (via Brainstorming)
**Branch:** `feat/finance`

---

## V1 Verification Log

Smoke-tested live against the integration test company in Alegra (ADMINISTRACION SEGURA S.A.S, Colombia). All checks below passed:

| Check | Result | Notes |
|-------|--------|-------|
| Service user + token auth | ✅ Pass | Token via `Authorization: Basic base64(email:token)` |
| Rate limit awareness | ⏸️ Not exercised | Single-user page loads stayed well under 150 req/min |
| `/company` endpoint | ✅ Pass | After schema fix (country is optional) |
| `/invoices` list | ✅ Pass | After schema fixes (numberTemplate.number coerces string→number; InvoiceCurrencySchema nullish; NumberTemplate union handling) |
| `/invoices/{id}` detail | ⚠️ Code-complete, not smoke-tested in this session | Likely needs more shape adjustments in `items[]`/`payments[]`/`events[]`; will be caught by the flattened error logger on first load |
| Home KPIs render real numbers | ✅ Pass | $15.509.000 facturado mes · $2.674.405 por cobrar (6 abiertas) · $1.789.805 vencido >30d |
| List page renders + filter + paginate | ✅ Pass | FEAD9885 → FEAD9879 visible; status badges; Colombian peso formatting with comma decimal separator (auto-detected from company config) |
| Error boundary surfaces AllegraError subclasses | ✅ Pass | "Alegra cambió su API" shows when a payload fails Zod |
| Multi-currency / locale handling | ✅ Pass | Intl.NumberFormat reads company.currency.code and `decimalSeparator` from response |

**Real bugs found and fixed during smoke test** (worth remembering for future external API integrations):

1. **`NumberTemplate.number` came as string `"9850"`** — added `z.union([z.number(), z.string()]).transform(Number)`. Same pattern as `decimalPrecision` and `payment.amount` already used. This is now the THIRD confirmation that Alegra frequently returns numeric-looking fields as strings, so a header note was added to `lib/alegra/types.ts` with the safe recipe.

2. **`Company.country` omitted by some Alegra accounts** — made `.optional()`. The address carries department/city for country context anyway.

3. **`InvoiceCurrencySchema` was `.nullable()` but single-currency accounts omit the field entirely** — changed to `.nullish()` (accepts `object | null | undefined`).

4. **`open.metadata.total` on the home page didn't match the post-transform shape** — bug in my code, not in Alegra. The transform flattens `{ metadata: { total }, data }` into `{ data, total }`, but one line still used `.metadata.total`. **TypeScript didn't catch it** because `next build` uses esbuild/SWC for fast transpilation and skips strict type-checking on Server Components. Recommendation: add `tsc --noEmit` to CI.

5. **Default Zod error logger was useless** — `path: [Array]` placeholder, no actual field path. Wrote `formatValidationFailure()` helper that prints dotted field paths with expected/received, plus a JSON preview. **Also flattens `invalid_union` issues** into the member-branch errors, so a failing union doesn't just say "Invalid input" with no context.

---

## Problem Statement

Administración Segura currently uses [Alegra](https://www.alegra.com/) as their system of record for invoicing, quotations, income, and expenses. Today, to consult any financial data, operators must leave the dashboard and log into the Alegra web UI — breaking context, duplicating logins, and preventing financial awareness from being a first-class citizen of the dashboard.

**Key insight:** Operators working on client affiliations and processes need frequent visibility into the company's invoicing (what was billed, what's outstanding, what's overdue, DIAN compliance status) — without leaving the dashboard.

---

## Proposed Solution (V1)

Build a **read-only Finances module** inside the existing dashboard (`/dashboard/finances/*`) that surfaces Alegra invoice data on-demand.

V1 explicitly covers only **invoices (facturas de venta)**. Quotes, bills, payments, and income/expenses follow the same integration pattern and are deferred to V2.

---

## V1 Scope

| Aspect | Decision |
|---|---|
| Data flow | **On-demand** — every page load calls Alegra directly |
| Storage | **Zero** — no new Prisma models, no cache, no cron |
| Entities | **Invoices only** (`/invoices` endpoint) |
| UI | KPIs summary + filtered list + drill-down detail |
| RBAC | All roles (SUPER_ADMIN + MANAGER) |
| Auth | HTTP Basic with service-user credentials in env vars |
| Rate limit | Respected via header monitoring + safety threshold of 5 req |
| Tests | Unit tests (client + schemas + pure functions) |
| Out of scope (V2+) | Quotes, bills, payments, webhooks, caching/sync, write operations, reports, charts, multi-currency beyond display, audit log, cross-linking with our `Client` |

---

## Architecture

### High-Level Flow

```
Browser
  ↓ GET /dashboard/finances/invoices?status=open&date_from=2026-01-01
Next.js Server Component
  ↓ await client.listInvoices({ status: 'open', date_after: '2026-01-01', metadata: true })
AlegraClient (lib/alegra/client.ts)
  ↓ checks rate limit (waits if Remaining < 5)
  ↓ GET https://api.alegra.com/api/v1/invoices?...
Alegra API
  ↓ JSON with { metadata: { total: 247 }, data: [...30 invoices] }
AlegraClient (Zod validates + normalizes)
  ↓ typed Invoice[]
Server Component → <InvoiceTable data={invoices} total={247} />
  ↓ HTML to browser
```

### File Structure

```
app/dashboard/finances/
├── layout.tsx                          # Sidebar entry, role check, header
├── page.tsx                            # KPIs overview (4 cards + link to invoices)
└── invoices/
    ├── page.tsx                        # List with filters (Server Component)
    └── [id]/
        └── page.tsx                    # Invoice detail

lib/alegra/
├── client.ts                           # HTTP client + rate limit handling
├── types.ts                            # Zod schemas → inferred TS types
├── errors.ts                           # AlegraError / AuthError / RateLimitError
└── transformers.ts                     # Normalize unstable fields

components/dashboard/finances/
├── kpi-cards.tsx                       # 4 KPI cards on home
├── invoice-filters.tsx                 # Status, date range, client search (Client Component)
├── invoice-table.tsx                   # TanStack table (same pattern as my-assignments)
├── invoice-detail-header.tsx           # Totals + status header
├── invoice-items-table.tsx             # Items with discounts and taxes
├── invoice-payments.tsx                # Payments list with progress
└── dian-events-timeline.tsx            # Timeline of DIAN events

emails/                                 # (no changes)
prisma/schema.prisma                    # (no changes — V1 adds no models)
```

### Environment Variables

```bash
# Alegra API (credentials of a dedicated service user)
ALEGRA_EMAIL="integration@admon-segura.com"
ALEGRA_TOKEN=""  # generated in Alegra → Configuración → API → Integraciones
```

Add to `.env.example` (without real values) and `.env.local` (with real values for development).

---

## API Integration

### Endpoints Used in V1

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/company` | Discover currency, decimal precision, country rules |
| `GET` | `/invoices?metadata=true&...filters` | List invoices with pagination |
| `GET` | `/invoices/{id}?fields=pdf,xml,comments,events` | Invoice detail with DIAN events |

### Key Filter Parameters

| Param | Type | Example |
|---|---|---|
| `start` | int (offset) | `0`, `30`, `60` |
| `limit` | int (max 30) | `30` |
| `status` | enum (comma-sep) | `open`, `closed`, `draft`, `void` |
| `date_after` | `YYYY-MM-DD` | `2026-01-01` |
| `date_before` | `YYYY-MM-DD` | `2026-06-30` |
| `dueDate_after` | `YYYY-MM-DD` | `2026-01-01` |
| `dueDate_before` | `YYYY-MM-DD` | `2026-06-30` |
| `client_id` | string | `"75c1a5ad-..."` |
| `client_name` | string (substring) | `"ACME"` |
| `metadata` | bool | `true` (default true for our usage) |
| `order_field` | enum | `date` |
| `order_direction` | enum | `DESC` |

### Known Quirks (must be handled in client)

- **ID format change (Jan 2025)**: `id` is now a `VARCHAR(36)` string. Old records return `"1"`, new records return UUIDs. We treat all IDs as strings.
- **`numberTemplate` shape unstable**: object on most records, array on some historical records. Normalize via Zod transform.
- **`amount` in payments**: sometimes number, sometimes string. Coerce via Zod transform.
- **`decimalPrecision`**: sometimes int, sometimes string. Coerce via Zod transform.
- **Datetime formats**: inconsistent — `"YYYY-MM-DD HH:MM:SS"` vs `"DD-MM-YYYY HH:MM:SS"` in invoice events. Parse defensively.

---

## Core Components

### 1. `lib/alegra/client.ts` — The HTTP Client

A server-only singleton class wrapping `fetch` with:
- HTTP Basic auth header (built once from env vars)
- Rate limit awareness via `X-Rate-Limit-*` response headers
- Safety threshold (waits if `Remaining < 5`)
- Typed errors (Auth, RateLimit, Validation, Generic)
- `cache: 'no-store'` on every fetch (always fresh data)

```typescript
import 'server-only';
import { z } from 'zod';
import { AlegraError, RateLimitError, AuthError } from './errors';
import { InvoiceListResponseSchema, InvoiceDetailSchema, CompanySchema } from './types';

const BASE_URL = 'https://api.alegra.com/api/v1';
const SAFETY_THRESHOLD = 5;
const RATE_LIMIT_MAX_WAIT_MS = 60_000;

let _client: AlegraClient | null = null;
export function getAlegraClient(): AlegraClient {
  if (!_client) _client = new AlegraClient();
  return _client;
}

export class AlegraClient {
  private authHeader: string;
  private rateLimit = { remaining: 150, resetAt: 0 };

  constructor() {
    const email = process.env.ALEGRA_EMAIL;
    const token = process.env.ALEGRA_TOKEN;
    if (!email || !token) {
      throw new Error('ALEGRA_EMAIL y ALEGRA_TOKEN son requeridos');
    }
    this.authHeader = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;
  }

  async listInvoices(params: ListInvoicesParams) {
    return this.request('/invoices', params, InvoiceListResponseSchema);
  }

  async getInvoice(id: string) {
    return this.request(`/invoices/${id}`, undefined, InvoiceDetailSchema);
  }

  async getCompany() {
    return this.request('/company', undefined, CompanySchema);
  }

  private async request<T>(
    path: string,
    params: Record<string, unknown> | undefined,
    schema: z.ZodSchema<T>
  ): Promise<T> {
    await this.waitForRateLimit();

    const url = new URL(`${BASE_URL}${path}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          url.searchParams.append(k, String(v));
        }
      });
    }

    const res = await fetch(url.toString(), {
      headers: { Authorization: this.authHeader },
      cache: 'no-store',
    });

    this.updateRateLimitFromHeaders(res.headers);

    if (!res.ok) {
      await this.handleHttpError(res);
    }

    const json = await res.json();
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new AlegraError('VALIDATION_ERROR', 'Alegra devolvió un shape inesperado', { zod: parsed.error.format() });
    }
    return parsed.data;
  }

  private async waitForRateLimit() {
    if (this.rateLimit.remaining > SAFETY_THRESHOLD) return;
    const sleepMs = Math.max(0, this.rateLimit.resetAt - Date.now());
    if (sleepMs > 0 && sleepMs < RATE_LIMIT_MAX_WAIT_MS) {
      console.warn(`[Alegra] rate limit bajo (${this.rateLimit.remaining}), esperando ${sleepMs}ms`);
      await new Promise(r => setTimeout(r, sleepMs));
    }
  }

  private updateRateLimitFromHeaders(headers: Headers) {
    const remaining = headers.get('X-Rate-Limit-Remaining');
    const reset = headers.get('X-Rate-Limit-Reset');
    if (remaining) this.rateLimit.remaining = Number(remaining);
    if (reset) this.rateLimit.resetAt = Date.now() + Number(reset) * 1000;
  }

  private async handleHttpError(res: Response): Promise<never> {
    const body = await res.json().catch(() => ({}));
    if (res.status === 401) throw new AuthError(body.error ?? 'Credenciales inválidas');
    if (res.status === 429) throw new RateLimitError(body.error ?? 'Rate limit exceeded', this.rateLimit.resetAt);
    throw new AlegraError(`HTTP_${res.status}`, body.error ?? res.statusText, { body });
  }
}
```

### 2. `lib/alegra/types.ts` — Zod Schemas

```typescript
import { z } from 'zod';

// === Invoice (LIST shape) ===
export const InvoiceSchema = z.object({
  id: z.string(),
  date: z.string(),
  dueDate: z.string().nullable(),
  datetime: z.string(),
  status: z.enum(['open', 'closed', 'draft', 'void']),
  client: z.object({
    id: z.string(),
    name: z.string(),
    identification: z.string().nullable(),
    email: z.string().nullable(),
  }),
  numberTemplate: z.union([
    z.object({
      id: z.string(),
      prefix: z.string(),
      number: z.number(),
      text: z.string().optional(),
    }),
    z.array(z.any()),
  ])
    .transform((v) => (Array.isArray(v) ? v[0] : v))
    .nullable(),
  total: z.number(),
  totalPaid: z.number(),
  balance: z.number(),
  currency: z.object({ code: z.string(), symbol: z.string() }).nullable(),
  observations: z.string().nullable().optional(),
}).passthrough();

export const InvoiceListResponseSchema = z.union([
  z.object({ metadata: z.object({ total: z.number() }), data: z.array(InvoiceSchema) }),
  z.array(InvoiceSchema),
]).transform((v) => (Array.isArray(v) ? { data: v, total: v.length } : v));

// === Invoice (DETAIL shape) ===
export const InvoiceDetailSchema = InvoiceSchema.extend({
  items: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable().optional(),
    reference: z.string().nullable().optional(),
    price: z.number(),
    quantity: z.number(),
    discount: z.number().optional(),
    tax: z.array(z.object({
      id: z.string(),
      name: z.string(),
      percentage: z.number(),
    })).optional(),
  })),
  payments: z.array(z.object({
    id: z.string(),
    date: z.string(),
    amount: z.union([z.number(), z.string()]).transform(Number),
    paymentMethod: z.string().nullable(),
    status: z.string(),
  })).optional(),
  retentions: z.array(z.object({
    id: z.string(),
    name: z.string(),
    percentage: z.number(),
    amount: z.number(),
  })).optional(),
  events: z.array(z.object({
    status: z.string(),
    date: z.string(),
    type: z.string(),
  })).optional(),
});

// === Company ===
export const CompanySchema = z.object({
  name: z.string(),
  country: z.string(),
  applicationVersion: z.string(),
  decimalPrecision: z.union([z.number(), z.string()]).transform(Number),
  currency: z.object({ code: z.string(), symbol: z.string() }),
});

export type Invoice = z.infer<typeof InvoiceSchema>;
export type InvoiceDetail = z.infer<typeof InvoiceDetailSchema>;
export type InvoiceListResponse = z.infer<typeof InvoiceListResponseSchema>;
export type Company = z.infer<typeof CompanySchema>;

export interface ListInvoicesParams {
  start?: number;
  limit?: number;
  status?: 'open' | 'closed' | 'draft' | 'void' | string;
  date_after?: string;
  date_before?: string;
  dueDate_after?: string;
  dueDate_before?: string;
  client_id?: string;
  client_name?: string;
  metadata?: boolean;
  order_field?: 'date' | 'dueDate' | 'id' | 'name';
  order_direction?: 'ASC' | 'DESC';
}
```

### 3. `lib/alegra/errors.ts` — Typed Errors

```typescript
export class AlegraError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AlegraError';
  }
}

export class AuthError extends AlegraError {
  constructor(message: string) {
    super('AUTH_ERROR', message);
    this.name = 'AuthError';
  }
}

export class RateLimitError extends AlegraError {
  constructor(message: string, public resetAt: number) {
    super('RATE_LIMIT', message);
    this.name = 'RateLimitError';
  }
}
```

---

## UI Pages

### 1. Home — `/dashboard/finances` (KPIs Overview)

Four KPI cards, each backed by a single Alegra request (4 in parallel via `Promise.all`):

| KPI | Query | Computation |
|---|---|---|
| Facturado mes actual | `date_after=startOfMonth&status=open,closed` | Sum of `total` |
| Por cobrar (abiertas) | `status=open` | Sum of `balance` |
| Vencido >30 días | `status=open&dueDate_before=30daysAgo` | Sum of `balance` |
| Facturas abiertas | `status=open` | Count from `metadata.total` |

Currency formatting: `new Intl.NumberFormat('es-CO', { style: 'currency', currency: company.currency.code })`.

Manual refresh button on each card (no auto-refresh).

### 2. List — `/dashboard/finances/invoices`

- **Filters** (URL-driven via `searchParams`, Client Component for interactivity):
  - Status multi-select (`open`, `closed`, `draft`, `void`)
  - Date range (uses project's existing `react-day-picker`)
  - Client search (substring match via `client_name`)
- **Table** (TanStack table, matches `my-assignments` pattern):
  - Columns: # (number), Fecha, Vencimiento (with overdue warning), Cliente, Total, Saldo, Estado
  - Pagination: server-side, "Anterior/Siguiente" with `start=0,30,60,...`
  - Sort by date DESC by default
- **Optional**: Export CSV button (current filtered set)

### 3. Detail — `/dashboard/finances/invoices/[id]`

Sections (top to bottom):
- **Header**: invoice number, dates, status badge
- **Client card**: name, NIT, email, phone (from embedded `client` object)
- **Totals card**: subtotal, taxes, retentions, total, paid, balance (using `Intl.NumberFormat`)
- **Items table**: line items with quantity, price, discount, tax
- **Payments section**: list of `payments[]` with progress indicator (paid vs balance)
- **Retentions section** (if present): Colombian withholding taxes (Retefuente, ReteIVA)
- **DIAN events timeline** (Colombia-specific): visual timeline of `events[]` — emission, email sent/delivered/opened, client acceptance/rejection

---

## Testing Strategy

### Unit Tests (Vitest — already configured)

**`lib/alegra/__tests__/client.test.ts`**
- Auth header construction
- Rate limit waiting behavior (fake timers)
- HTTP error mapping (401 → AuthError, 429 → RateLimitError)
- Zod validation rejection on bad payloads

**`lib/alegra/__tests__/schemas.test.ts`**
- `numberTemplate` object vs array normalization
- `amount` string vs number coercion
- `decimalPrecision` int vs string coercion
- ID as string (UUID or legacy integer-as-string)

**`app/dashboard/finances/__tests__/kpis.test.ts`**
- `sum(invoices, total)` correctness
- `groupByAging(invoices, today)` bucket assignment

### Manual Testing

- Set up **integration test company** in Alegra (separate from production data)
- Use those credentials in `.env.local` during development
- Verify edge cases: 0 invoices, 1 invoice, 1000 invoices, partial payments, rejected DIAN events
- **Never** run development requests against the production Alegra account

### What We Don't Test

- ❌ Integration tests against real Alegra in CI (no sandbox; would mutate real data)
- ❌ E2E Playwright in V1 (marginal value, components reuse tested patterns)

---

## Security & Operations

### Setup Prerequisites

1. **Create a dedicated service user** in Alegra (`Configuración → Usuarios`)
   - Email: `integration@admon-segura.com` (or company-domain equivalent)
   - Role: read-only access if possible
   - This isolates the 150 req/min budget from human admin users

2. **Generate the API token** as the service user
   - `Configuración → API - Integraciones con otros sistemas`
   - Token shown ONCE — store in password manager

3. **Create integration test company** in Alegra with sample data
   - 5–10 fake invoices, mixed statuses, 2–3 contacts
   - Used exclusively for local development

4. **Document credentials rotation** in `docs/runbooks/alegra-credentials.md`
   - How to rotate the token
   - How to revoke access
   - What to do if Alegra changes their API

### Token Storage

- `ALEGRA_EMAIL` and `ALEGRA_TOKEN` in `.env.local` (gitignored) and `.env.example` (no values)
- Production: platform environment variables (Vercel/Railway/etc.)
- **Never** commit real credentials

---

## Out of Scope (V2+ Roadmap)

| Feature | Why deferred | Trigger for V2 |
|---|---|---|
| Quotes, Bills, Payments | Same integration pattern, replicate after V1 validates | User request or operator feedback |
| Webhooks | Requires queue + idempotency + 5s SLA infra | When V2 introduces caching/sync |
| Cache / sync to our DB | When performance hurts or rate limits bite | Measured pain |
| Write operations | Module is read-only by design (Alegra is source of truth) | Clear product use case |
| Reports / aging charts | Aggregations are slow on-demand | After sync exists |
| PDF/XML download | Link to Alegra web for legal docs | Operator complaint |
| Audit log ("who saw what") | Not yet a requirement | Compliance ask |
| Multi-currency support | Display-only for V1 | Company enables multicurrency |
| Cross-link with our `Client` | Modules independent in V1 | Pain with manual client matching |

---

## Files to Create

**New files (~16):**

```
docs/plans/2026-06-28-alegra-finances-design.md       # this file
docs/runbooks/alegra-credentials.md                  # rotation + emergency

app/dashboard/finances/layout.tsx
app/dashboard/finances/page.tsx
app/dashboard/finances/invoices/page.tsx
app/dashboard/finances/invoices/[id]/page.tsx

lib/alegra/client.ts
lib/alegra/types.ts
lib/alegra/errors.ts
lib/alegra/transformers.ts

components/dashboard/finances/kpi-cards.tsx
components/dashboard/finances/invoice-filters.tsx
components/dashboard/finances/invoice-table.tsx
components/dashboard/finances/invoice-detail-header.tsx
components/dashboard/finances/invoice-items-table.tsx
components/dashboard/finances/invoice-payments.tsx
components/dashboard/finances/dian-events-timeline.tsx

lib/alegra/__tests__/client.test.ts
lib/alegra/__tests__/schemas.test.ts
app/dashboard/finances/__tests__/kpis.test.ts
```

**Files to modify (~3):**

```
.env.example                                              # add ALEGRA_EMAIL, ALEGRA_TOKEN
components/dashboard/layout/sidebar.tsx (or equivalent)   # add "Finanzas" nav entry
docs/CLAUDE_DASHBOARD.md                                  # document the new module
```

**Migrations:** 0
**New dependencies:** 0 (all required libraries already in project)

---

## Implementation Order

1. **Foundation**: `lib/alegra/{client,types,errors,transformers}.ts` + tests
2. **Runbook**: `docs/runbooks/alegra-credentials.md`
3. **Layout + sidebar**: `app/dashboard/finances/layout.tsx` + sidebar nav entry
4. **Home (KPIs)**: `app/dashboard/finances/page.tsx` + `components/dashboard/finances/kpi-cards.tsx`
5. **List**: `app/dashboard/finances/invoices/page.tsx` + `invoice-filters.tsx` + `invoice-table.tsx`
6. **Detail**: `app/dashboard/finances/invoices/[id]/page.tsx` + `invoice-detail-header.tsx` + `invoice-items-table.tsx` + `invoice-payments.tsx` + `dian-events-timeline.tsx`
7. **Docs**: update `docs/CLAUDE_DASHBOARD.md` to document the module
8. **Manual smoke test**: load each page against integration test Alegra account

---

## References

- [Alegra API docs](https://developer.alegra.com/) — primary source
- [Alegra changelog: ID format change](https://developer.alegra.com/changelog/nuevo-formato-de-id)
- [Project dashboard patterns](./CLAUDE_DASHBOARD.md)
- [Alegra API research observation](../..) (saved in Engram memory, `architecture/alegra-finance-v1` topic)
