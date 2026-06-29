import { z } from 'zod'

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
  number: z.union([z.number(), z.string()]).transform(Number),
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
 * Per-invoice currency sub-object. Most invoices in single-currency accounts
 * omit this entirely (key not present → `undefined`), which the UI replaces
 * with the company's currency. Accepts `object | null | undefined`.
 */
export const InvoiceCurrencySchema = z
  .object({
    code: z.string(),
    symbol: z.string(),
    exchangeRate: z.number().optional(),
  })
  .nullish()

export type InvoiceCurrency = z.infer<typeof InvoiceCurrencySchema>

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
  price: z.number(),
  quantity: z.number(),
  discount: z.number().optional(),
  tax: z.array(z.object({
    id: z.string(),
    name: z.string(),
    percentage: z.number(),
  })).optional(),
}).passthrough()

export type InvoiceItem = z.infer<typeof InvoiceItemSchema>

export const InvoicePaymentSchema = z.object({
  id: z.string(),
  date: z.string(),
  // `amount` documented as number but appears as string in some endpoints
  amount: z.union([z.number(), z.string()]).transform(Number),
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
  // documented as int but sometimes returns string
  decimalPrecision: z.union([z.number(), z.string()]).transform(Number),
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
}
