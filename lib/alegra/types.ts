import { z } from 'zod'

// =============================================================================
// Schemas for the Alegra REST API (https://developer.alegra.com/)
//
// ⚠️ IMPORTANT — "Alegra returns numbers as strings" pattern:
// Several numeric-looking fields come back from the API as JSON STRINGS
// rather than native numbers (the documented type is misleading). The known
// cases so far:
//   - Company.decimalPrecision                  → string "0" or number
//   - Payments[].amount                        → string "500" or number
//   - NumberTemplate.number (invoice sequence)  → string "9850" or number
//   - InvoiceItem.price                        → number or string
//   - InvoiceItem.quantity                     → number or string
//   - InvoiceItem.discount                     → number or string
//   - InvoiceItem.tax[].percentage             → string "19" or number
//
// For any new numeric field discovered through testing, USE the
// `safeNumber` helper below rather than `z.number()`:
//
//     quantity: safeNumber,           // accepts "19" or 19, always outputs number
//
// Always verify against live data before adopting the strict z.number()
// form — it will silently fail at runtime when Alegra decides to flip
// the type for a given account or field.

/**
 * Zod schema for a numeric field that Alegra may return as either a native
 * number or a JSON string. Always normalizes to a JS number.
 *
 * Beware: `Number("")` is `0` and `Number("garbage")` is `NaN`. None of the
 * known cases produce empty strings (yet), but if a new field does, harden
 * the schema with `.pipe(z.number().finite())` or similar.
 */
export const safeNumber = z.union([z.number(), z.string()]).transform(Number)
// =============================================================================

// =============================================================================
// Status enum (Alegra canonical values, no transformation)
// =============================================================================

export const INVOICE_STATUS = {
  OPEN: 'open',
  CLOSED: 'closed',
  DRAFT: 'draft',
  VOID: 'void',
} as const

export const InvoiceStatusSchema = z.enum([
  INVOICE_STATUS.OPEN,
  INVOICE_STATUS.CLOSED,
  INVOICE_STATUS.DRAFT,
  INVOICE_STATUS.VOID,
])

export type InvoiceStatus = z.infer<typeof InvoiceStatusSchema>

// =============================================================================
// Sub-schemas (shared between list and detail)
// =============================================================================

/**
 * `numberTemplate` is documented as an object but historical records
 * occasionally return it as a single-element array. Normalize to always-object.
 *
 * `number` (the invoice sequence number) may come back as either a JSON
 * number or a string — same pattern as `decimalPrecision` and the
 * payment `amount`. Coerce both to number.
 */
const NumberTemplateObjectSchema = z.object({
  id: z.string(),
  prefix: z.string(),
  number: safeNumber,
  text: z.string().optional(),
}).nullable()

export const NumberTemplateSchema = z.union([
  NumberTemplateObjectSchema,
  z.array(NumberTemplateObjectSchema),
]).transform((v) => (Array.isArray(v) ? v[0] ?? null : v))

export type NumberTemplate = z.infer<typeof NumberTemplateSchema>

export const InvoiceClientSchema = z.object({
  id: z.string(),
  name: z.string(),
  identification: z.string().nullable(),
  email: z.string().nullable().optional(),
  phonePrimary: z.string().nullable().optional(),
  address: z.object({
    address: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
  }).nullable().optional(),
}).passthrough()

export type InvoiceClient = z.infer<typeof InvoiceClientSchema>

/**
 * Per-document currency sub-object. Most invoices/estimates in single-currency
 * accounts omit this entirely (key not present → `undefined`), which the UI
 * replaces with the company's currency. Accepts `object | null | undefined`.
 *
 * `symbol` is `.optional()` because /estimates sometimes returns `{ code, exchangeRate }`
 * without the symbol (verified in the POST example for /estimates). Invoice
 * responses always include `symbol`, but accepting the omission is harmless.
 */
export const InvoiceCurrencySchema = z
  .object({
    code: z.string(),
    symbol: z.string().optional(),
    exchangeRate: safeNumber.optional(),
  })
  .nullish()

export type InvoiceCurrency = z.infer<typeof InvoiceCurrencySchema>

/**
 * Alias used by the estimate schemas — same shape as `InvoiceCurrencySchema`,
 * renamed for clarity in the estimate context. Both /invoices and /estimates
 * use the same currency sub-object on the document.
 */
export const EstimateCurrencySchema = InvoiceCurrencySchema
export type EstimateCurrency = InvoiceCurrency

// =============================================================================
// List shape (minimal fields shown in the table)
// =============================================================================

export const InvoiceListItemSchema = z.object({
  id: z.string(),
  date: z.string(),
  dueDate: z.string().nullable(),
  datetime: z.string(),
  status: InvoiceStatusSchema,
  client: InvoiceClientSchema,
  numberTemplate: NumberTemplateSchema,
  total: z.number(),
  totalPaid: z.number(),
  balance: z.number(),
  currency: InvoiceCurrencySchema,
  observations: z.string().nullable().optional(),
}).passthrough()

export type InvoiceListItem = z.infer<typeof InvoiceListItemSchema>

/**
 * The list endpoint returns either `{ metadata: { total }, data: [...] }`
 * (when `metadata=true` is sent) or a bare array `[...]`. Normalize BOTH
 * cases to `{ data, total }`.
 *
 * NOTE: the `.transform()` MUST explicitly reshape the metadata-wrapped
 * case — just returning `v` would leave the output as the original union,
 * and `result.total` would be undefined (it's at `result.metadata.total`).
 */
const InvoiceListResponseBaseSchema = z.union([
  z.object({
    metadata: z.object({ total: z.number() }),
    data: z.array(InvoiceListItemSchema),
  }),
  z.array(InvoiceListItemSchema),
])

export const InvoiceListResponseSchema = InvoiceListResponseBaseSchema.transform((v) => {
  if (Array.isArray(v)) {
    return { data: v, total: v.length }
  }
  return { data: v.data, total: v.metadata.total }
})

export interface InvoiceListResponse {
  data: z.infer<typeof InvoiceListItemSchema>[]
  total: number
}

// =============================================================================
// Detail shape (full breakdown for the invoice detail page)
// =============================================================================

export const InvoiceItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  reference: z.string().nullable().optional(),
  // All numeric-looking fields use `safeNumber` — see file header.
  price: safeNumber,
  quantity: safeNumber,
  discount: safeNumber.optional(),
  tax: z.array(z.object({
    id: z.string(),
    name: z.string(),
    percentage: safeNumber,
  })).optional(),
}).passthrough()

export type InvoiceItem = z.infer<typeof InvoiceItemSchema>

export const InvoicePaymentSchema = z.object({
  id: z.string(),
  date: z.string(),
  amount: safeNumber, // see file header comment
  paymentMethod: z.string().nullable(),
  status: z.string(),
}).passthrough()

export type InvoicePayment = z.infer<typeof InvoicePaymentSchema>

export const InvoiceRetentionSchema = z.object({
  id: z.string(),
  name: z.string(),
  percentage: z.number(),
  amount: z.number(),
}).passthrough()

export type InvoiceRetention = z.infer<typeof InvoiceRetentionSchema>

/**
 * DIAN electronic invoice events (Colombia-only).
 * `type` examples: CLIENT_EMAILS, CLIENT_ACCEPTANCE.
 * `status` examples: SENT, DELIVERED, OPENED, BOUNCED, ACKNOWLEDGED, ACCEPTED, REJECTED.
 *
 * `date` format is inconsistent across event types — sometimes
 * `YYYY-MM-DD HH:MM:SS`, sometimes `DD-MM-YYYY HH:MM:SS`. We don't parse here;
 * the UI should use `parseAlegraDateTime()` from transformers.ts.
 */
export const InvoiceEventSchema = z.object({
  status: z.string(),
  date: z.string(),
  type: z.string(),
}).passthrough()

export type InvoiceEvent = z.infer<typeof InvoiceEventSchema>

export const InvoiceDetailSchema = InvoiceListItemSchema.extend({
  items: z.array(InvoiceItemSchema).optional(),
  payments: z.array(InvoicePaymentSchema).optional(),
  retentions: z.array(InvoiceRetentionSchema).optional(),
  events: z.array(InvoiceEventSchema).optional(),
  termsConditions: z.string().nullable().optional(),
  anotation: z.string().nullable().optional(),
  seller: z.object({
    id: z.string(),
    name: z.string(),
    identification: z.string().nullable().optional(),
  }).nullable().optional(),
})

export type InvoiceDetail = z.infer<typeof InvoiceDetailSchema>

// =============================================================================
// Company (used for currency / locale awareness)
// =============================================================================

export const CompanySchema = z.object({
  name: z.string(),
  // Country not always present (some Alegra accounts omit it; the address
  // has department/city instead). Optional rather than nullable.
  country: z.string().optional(),
  applicationVersion: z.string(),
  decimalPrecision: safeNumber,
  currency: z.object({
    code: z.string(),
    symbol: z.string(),
  }),
}).passthrough()

export type Company = z.infer<typeof CompanySchema>

// =============================================================================
// Client method parameter types (not Zod schemas — just TS interfaces)
// =============================================================================

export interface ListInvoicesParams {
  start?: number
  limit?: number
  status?: InvoiceStatus | `${InvoiceStatus},${InvoiceStatus}` | string
  date_after?: string
  date_before?: string
  dueDate_after?: string
  dueDate_before?: string
  client_id?: string
  client_name?: string
  metadata?: boolean
  order_field?: 'date' | 'dueDate' | 'id' | 'name'
  order_direction?: 'ASC' | 'DESC'
  // Index signature required because `AlegraClient.request()` accepts
  // `Record<string, unknown>`. Without this, TS complains that
  // ListInvoicesParams lacks a string index (caught by `tsc --noEmit`,
  // invisible to `next build` which uses esbuild/SWC).
  [key: string]: unknown
}

// =============================================================================
// Estimates (cotizaciones) — V2
//
// Key differences vs /invoices (see mem: finances/v2-estimates-api-shape):
//   - NO `status` field on estimates — cotizaciones are informational docs
//   - NO `balance` / `totalPaid` — estimates don't get paid
//   - NO `numberTemplate` — flat `number` (string) field instead
//   - NO `payments` / `retentions` / `events` (DIAN) — not relevant
//   - HAS `anotation` (singular, no "annotation") + `seller` + `priceList`
//   - HAS `warehouse` (not on invoices) — only present on detail, ignored for V2
//   - Items use the same shape as invoice items, all numerics are strings
// =============================================================================

/**
 * Seller assigned to an estimate. Nullable (estimates don't require a seller).
 * Examples show extra `observations` field on the seller object — passthrough
 * captures anything not in the schema.
 */
export const EstimateSellerSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    identification: z.string().nullable().optional(),
  })
  .nullable()
  .optional()

export type EstimateSeller = z.infer<typeof EstimateSellerSchema>

/**
 * Price list referenced by the estimate. Nullable — most estimates don't use one.
 * The full Alegra price-list object has many fields (currency, products, etc.)
 * but estimates only echo back a minimal subset.
 */
export const EstimatePriceListSchema = z
  .object({
    id: z.string(),
    name: z.string(),
  })
  .nullable()
  .optional()

export type EstimatePriceList = z.infer<typeof EstimatePriceListSchema>

/**
 * Warehouse the estimate is fulfilled from. Only present on detail.
 * Ignored for V2 list view.
 */
export const EstimateWarehouseSchema = z
  .object({
    id: z.string(),
    name: z.string(),
  })
  .nullable()
  .optional()

export type EstimateWarehouse = z.infer<typeof EstimateWarehouseSchema>

/**
 * List shape — what the table on /dashboard/finances/estimates renders.
 *
 * No `status`, no `balance`, no `totalPaid`. `number` is a flat string
 * (NOT wrapped in numberTemplate). `anotation` is singular (Alegra typo).
 */
export const EstimateListItemSchema = z.object({
  id: z.string(),
  number: safeNumber, // flat field, e.g. "8" → 8
  date: z.string(),
  dueDate: z.string().nullable(),
  observations: z.string().nullable().optional(),
  anotation: z.string().nullable().optional(),
  seller: EstimateSellerSchema,
  priceList: EstimatePriceListSchema,
  client: InvoiceClientSchema, // same client shape — passthrough handles estimate extras
  total: safeNumber, // number or string depending on account/field
  currency: InvoiceCurrencySchema,
}).passthrough()

export type EstimateListItem = z.infer<typeof EstimateListItemSchema>

/**
 * The list endpoint returns either `{ metadata: { total }, data: [...] }`
 * (when `metadata=true`) or a bare array `[...]`. Same normalization as
 * InvoiceListResponseSchema.
 */
const EstimateListResponseBaseSchema = z.union([
  z.object({
    metadata: z.object({ total: z.number() }),
    data: z.array(EstimateListItemSchema),
  }),
  z.array(EstimateListItemSchema),
])

export const EstimateListResponseSchema = EstimateListResponseBaseSchema.transform((v) => {
  if (Array.isArray(v)) {
    return { data: v, total: v.length }
  }
  return { data: v.data, total: v.metadata.total }
})

export interface EstimateListResponse {
  data: z.infer<typeof EstimateListItemSchema>[]
  total: number
}

/**
 * Detail shape — extends list with the items array and warehouse.
 * Items reuse InvoiceItemSchema verbatim (same shape, same safeNumber usage).
 */
export const EstimateDetailSchema = EstimateListItemSchema.extend({
  items: z.array(InvoiceItemSchema).optional(),
  warehouse: EstimateWarehouseSchema,
})

export type EstimateDetail = z.infer<typeof EstimateDetailSchema>

/**
 * Client method parameter types (not Zod schemas — just TS interfaces).
 *
 * NOTE: /estimates does NOT support `date_after` / `date_before` /
 * `dueDate_after` / `dueDate_before` — only exact `date` and `dueDate`.
 * Date-range filtering goes through `lib/alegra/date-range-walk.ts`.
 */
export interface ListEstimatesParams {
  start?: number
  limit?: number
  order_field?: 'id' | 'name' | 'date' | 'dueDate'
  order_direction?: 'ASC' | 'DESC'
  metadata?: boolean
  item_id?: string
  client_id?: string
  number?: string
  client_name?: string
  date?: string
  // Index signature required because `AlegraClient.request()` accepts
  // `Record<string, unknown>`. See ListInvoicesParams for the same rationale.
  [key: string]: unknown
}

// =============================================================================
// Bills (facturas de compra / proveedor) — EGRESOS
//
// ⚠️ VOCABULARY — the whole point of this module split:
//   /invoices = facturas de VENTA    → INGRESO (a client owes us)
//   /bills    = facturas de COMPRA   → EGRESO  (we owe a provider)
//
// The shape is close to invoices — same status enum, same total/totalPaid/
// balance triple — but the counterparty is a `provider`, not a `client`, and
// the document number is a flat `billNumber` string rather than a
// numberTemplate object.
//
// Like /estimates, /bills supports only an EXACT `date` filter — no
// date_after / date_before. Range queries go through the date-range walk.
// =============================================================================

export const BILL_STATUS = {
  OPEN: 'open',
  CLOSED: 'closed',
  VOID: 'void',
} as const

/**
 * Bills have no `draft` state (unlike invoices) — a purchase invoice is
 * recorded once it exists. Kept as its own enum rather than reusing
 * InvoiceStatusSchema so a future divergence doesn't silently widen both.
 */
export const BillStatusSchema = z.enum([
  BILL_STATUS.OPEN,
  BILL_STATUS.CLOSED,
  BILL_STATUS.VOID,
])

export type BillStatus = z.infer<typeof BillStatusSchema>

/**
 * The counterparty on a bill. Alegra returns the same underlying contact
 * shape as `client`, just under a different key — `passthrough()` absorbs
 * whatever extra fields the account has configured.
 */
export const BillProviderSchema = z.object({
  id: z.string(),
  name: z.string(),
  identification: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phonePrimary: z.string().nullable().optional(),
}).passthrough()

export type BillProvider = z.infer<typeof BillProviderSchema>

/**
 * List shape for the bills table.
 *
 * `billNumber` is a flat string (NOT a numberTemplate object) and may be
 * absent on bills captured without a supplier document number.
 * Every numeric field uses `safeNumber` — see the file header.
 */
export const BillListItemSchema = z.object({
  id: z.string(),
  billNumber: z.string().nullable().optional(),
  date: z.string(),
  dueDate: z.string().nullable(),
  status: BillStatusSchema,
  provider: BillProviderSchema.nullable().optional(),
  total: safeNumber,
  totalPaid: safeNumber,
  balance: safeNumber,
  currency: InvoiceCurrencySchema,
  observations: z.string().nullable().optional(),
  anotation: z.string().nullable().optional(),
}).passthrough()

export type BillListItem = z.infer<typeof BillListItemSchema>

const BillListResponseBaseSchema = z.union([
  z.object({
    metadata: z.object({ total: z.number() }),
    data: z.array(BillListItemSchema),
  }),
  z.array(BillListItemSchema),
])

export const BillListResponseSchema = BillListResponseBaseSchema.transform((v) => {
  if (Array.isArray(v)) {
    return { data: v, total: v.length }
  }
  return { data: v.data, total: v.metadata.total }
})

export interface BillListResponse {
  data: BillListItem[]
  total: number
}

/**
 * Detail shape. `purchases.items` is Alegra's nesting for bill line items;
 * some accounts return a flat `items` array instead, so both are optional
 * and the UI falls back between them.
 */
export const BillDetailSchema = BillListItemSchema.extend({
  items: z.array(InvoiceItemSchema).optional(),
  purchases: z.object({
    items: z.array(InvoiceItemSchema).optional(),
  }).passthrough().nullable().optional(),
  payments: z.array(InvoicePaymentSchema).optional(),
  termsConditions: z.string().nullable().optional(),
})

export type BillDetail = z.infer<typeof BillDetailSchema>

export interface ListBillsParams {
  start?: number
  limit?: number
  status?: BillStatus | string
  /** EXACT date only — /bills has no date_after / date_before. */
  date?: string
  dueDate?: string
  provider_name?: string
  client_id?: string
  billNumber?: string
  metadata?: boolean
  order_field?: 'date' | 'name' | 'dueDate'
  order_direction?: 'ASC' | 'DESC'
  /** bill | supportDocument | all — defaults to `bill` on the API side. */
  type?: 'bill' | 'supportDocument' | 'all'
  [key: string]: unknown
}

// =============================================================================
// Payments (pagos) — BOTH DIRECTIONS
//
// ⚠️⚠️ DOUBLE-COUNTING WARNING — read before using this in any total.
//
// A payment is the SETTLEMENT of an obligation, not a new one. Alegra's own
// docs are explicit: do not add bill amounts to their associated payment
// amounts, because they are the same money at two different moments.
//
//   /bills                 → accrual view  ("what we owe")
//   /payments (type: out)  → cash view     ("what actually left")
//
// These are two LENSES on the same expense, never two expenses. The UI shows
// them as separate, explicitly-labelled figures and NEVER sums them.
//
// The one asymmetry worth knowing: a payment linked to no document at all IS
// an expense that appears nowhere in /bills (a taxi, a bank fee). That is the
// only case where cash-side data contains something the accrual side does not.
//
// ⚠️⚠️ THE DOCS ARE WRONG ABOUT `associations` — verified against live data.
//
// The published reference describes `associations` as an object keyed by
// document type. It is NOT. Against a real account it comes back as a HUMAN
// -READABLE STRING:
//
//     "associations": "Facturas: FEAD9073"
//
// The machine-readable links are SIBLING ARRAYS at the top level of the
// payment object:
//
//     "invoices": [ { id, number, date, amount, total, balance } ]
//     "bills":    [ ... ]   (same idea, for type: "out")
//
// So `associations` is a display label and must never be parsed for logic —
// its format is a sentence, in Spanish, and nothing stops Alegra rewording
// it. `classifyPaymentAssociation` reads the arrays instead.
//
// Two more corrections from the same live payload:
//   - the bank account key is `bankAccount`, not `account`
//   - `currency` is absent entirely on payments in single-currency accounts
// =============================================================================

export const PAYMENT_TYPE = {
  IN: 'in',
  OUT: 'out',
} as const

export const PaymentTypeSchema = z.enum([PAYMENT_TYPE.IN, PAYMENT_TYPE.OUT])

export type PaymentType = z.infer<typeof PaymentTypeSchema>

/**
 * A document a payment is applied to.
 *
 * Same shape for the `invoices` and `bills` arrays. Only `id` is relied on;
 * everything else (number, amount, total, balance) passes through for display.
 */
export const PaymentDocumentLinkSchema = z.object({
  id: z.string(),
  number: z.union([z.string(), z.number()]).nullable().optional(),
  amount: safeNumber.optional(),
}).passthrough()

export type PaymentDocumentLink = z.infer<typeof PaymentDocumentLinkSchema>

/**
 * Counterparty on a payment.
 *
 * Deliberately NOT `InvoiceClientSchema`: that one requires `identification`
 * (nullable but present) and names the phone field `phonePrimary`. Live
 * payment payloads use `phone` and don't guarantee `identification`. Reusing
 * the invoice schema here is what would make a perfectly valid payment fail
 * to parse.
 */
export const PaymentClientSchema = z.object({
  id: z.string(),
  name: z.string(),
  identification: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
}).passthrough()

export type PaymentClient = z.infer<typeof PaymentClientSchema>

export const PaymentListItemSchema = z.object({
  id: z.string(),
  date: z.string(),
  amount: safeNumber,
  type: PaymentTypeSchema,
  status: z.string().nullable().optional(),
  paymentMethod: z.string().nullable().optional(),
  number: safeNumber.nullable().optional(),
  observations: z.string().nullable().optional(),
  anotation: z.string().nullable().optional(),
  // Absent on payments in single-currency accounts — `.nullish()` already
  // allows that, and the UI falls back to the company currency.
  currency: InvoiceCurrencySchema,
  /** Counterparty — a client for `in`, a provider for `out`. */
  client: PaymentClientSchema.nullable().optional(),
  /** Live payloads use `bankAccount`; the docs say `account`. Accept both. */
  bankAccount: z.object({
    id: z.string(),
    name: z.string(),
  }).passthrough().nullable().optional(),
  account: z.object({
    id: z.string(),
    name: z.string(),
  }).passthrough().nullable().optional(),

  // --- What the payment settles -----------------------------------------
  // These sibling arrays are the machine-readable truth. See the section
  // header: `associations` is a display string, NOT a structure.
  invoices: z.array(PaymentDocumentLinkSchema).optional(),
  bills: z.array(PaymentDocumentLinkSchema).optional(),
  categories: z.array(PaymentDocumentLinkSchema).optional(),

  /**
   * Human-readable summary Alegra builds for the UI, e.g.
   * "Facturas: FEAD9073". Display only — never parse it for logic.
   * Typed loosely because the docs claim it's an object and live data says
   * string; accepting both means an API correction won't take the page down.
   */
  associations: z.union([z.string(), z.record(z.unknown()), z.null()]).optional(),
}).passthrough()

export type PaymentListItem = z.infer<typeof PaymentListItemSchema>

const PaymentListResponseBaseSchema = z.union([
  z.object({
    metadata: z.object({ total: z.number() }),
    data: z.array(PaymentListItemSchema),
  }),
  z.array(PaymentListItemSchema),
])

export const PaymentListResponseSchema = PaymentListResponseBaseSchema.transform((v) => {
  if (Array.isArray(v)) {
    return { data: v, total: v.length }
  }
  return { data: v.data, total: v.metadata.total }
})

export interface PaymentListResponse {
  data: PaymentListItem[]
  total: number
}

export const PaymentDetailSchema = PaymentListItemSchema

export type PaymentDetail = z.infer<typeof PaymentDetailSchema>

/**
 * ⚠️ /payments has NO date filter of any kind — not even an exact `date`.
 * It is the most restricted of the four list endpoints. Any date-scoped
 * query MUST go through the date-range walk.
 */
export interface ListPaymentsParams {
  start?: number
  limit?: number
  type?: PaymentType
  client_id?: string
  metadata?: boolean
  order_field?: 'id' | 'number' | 'date' | 'type'
  order_direction?: 'ASC' | 'DESC'
  /** Comma-separated extras. `associations` is required for expense math. */
  fields?: string
  [key: string]: unknown
}
