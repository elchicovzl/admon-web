import { describe, it, expect } from 'vitest'
import {
  CompanySchema,
  EstimateDetailSchema,
  EstimateListItemSchema,
  EstimateListResponseSchema,
  EstimateSellerSchema,
  EstimateWarehouseSchema,
  InvoiceCurrencySchema,
  InvoiceDetailSchema,
  InvoiceEventSchema,
  InvoiceItemSchema,
  InvoiceListItemSchema,
  InvoiceListResponseSchema,
  InvoicePaymentSchema,
  InvoiceRetentionSchema,
  InvoiceStatusSchema,
  NumberTemplateSchema,
} from '../types'

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function buildInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: '1',
    date: '2026-06-15',
    dueDate: '2026-07-15',
    datetime: '2026-06-15 16:04:00',
    status: 'open',
    client: {
      id: '20',
      name: 'ACME S.A.S',
      identification: '900123456-7',
      email: 'cliente@acme.co',
    },
    numberTemplate: { id: '1', prefix: 'FE-', number: 520, text: 'Resolución DIAN #45112' },
    total: 1190,
    totalPaid: 0,
    balance: 1190,
    currency: { code: 'COP', symbol: '$' },
    ...overrides,
  }
}

// -----------------------------------------------------------------------------
// InvoiceStatusSchema
// -----------------------------------------------------------------------------

describe('InvoiceStatusSchema', () => {
  it('acepta los 4 estados canónicos', () => {
    expect(InvoiceStatusSchema.parse('open')).toBe('open')
    expect(InvoiceStatusSchema.parse('closed')).toBe('closed')
    expect(InvoiceStatusSchema.parse('draft')).toBe('draft')
    expect(InvoiceStatusSchema.parse('void')).toBe('void')
  })

  it('rechaza un estado desconocido', () => {
    expect(() => InvoiceStatusSchema.parse('paid')).toThrow()
    expect(() => InvoiceStatusSchema.parse('PAID')).toThrow()
  })
})

// -----------------------------------------------------------------------------
// NumberTemplateSchema (object | array → always-object)
// -----------------------------------------------------------------------------

describe('NumberTemplateSchema', () => {
  it('preserva el objeto cuando viene como objeto', () => {
    const obj = { id: '1', prefix: 'FE-', number: 520 }
    expect(NumberTemplateSchema.parse(obj)).toEqual(obj)
  })

  it('extrae el primer elemento cuando viene como array', () => {
    const arr = [{ id: '1', prefix: 'FE-', number: 520 }]
    const result = NumberTemplateSchema.parse(arr)
    expect(result).toEqual({ id: '1', prefix: 'FE-', number: 520 })
  })

  it('devuelve null cuando viene null', () => {
    expect(NumberTemplateSchema.parse(null)).toBeNull()
  })

  it('devuelve null cuando el array está vacío', () => {
    expect(NumberTemplateSchema.parse([])).toBeNull()
  })

  it('coerce number string → number (caso real Alegra: "9850" → 9850)', () => {
    // Live data: numberTemplate.number comes as STRING, not number.
    const obj = { id: '18', prefix: 'FEAD', number: '9850' }
    const result = NumberTemplateSchema.parse(obj)
    expect(result).toEqual({ id: '18', prefix: 'FEAD', number: 9850 })
    expect(typeof (result as { number: number }).number).toBe('number')
  })

  it('acepta number nativo también', () => {
    const obj = { id: '1', prefix: 'FE-', number: 520 }
    const result = NumberTemplateSchema.parse(obj)
    expect((result as { number: number }).number).toBe(520)
    expect(typeof (result as { number: number }).number).toBe('number')
  })
})

// -----------------------------------------------------------------------------
// InvoiceListItemSchema
// -----------------------------------------------------------------------------

describe('InvoiceListItemSchema', () => {
  it('parsea una factura válida', () => {
    const result = InvoiceListItemSchema.parse(buildInvoice())
    expect(result.id).toBe('1')
    expect(result.total).toBe(1190)
    expect(result.numberTemplate).toEqual({
      id: '1',
      prefix: 'FE-',
      number: 520,
      text: 'Resolución DIAN #45112',
    })
  })

  it('el id SIEMPRE es string (post Jan 2025 — UUID o legacy int)', () => {
    const a = InvoiceListItemSchema.parse(buildInvoice({ id: '1' }))
    const b = InvoiceListItemSchema.parse(buildInvoice({ id: '75c1a5ad-4bd5-4675-b51b-8d6c70f1f2f9' }))
    expect(typeof a.id).toBe('string')
    expect(typeof b.id).toBe('string')
    expect(b.id).toBe('75c1a5ad-4bd5-4675-b51b-8d6c70f1f2f9')
  })

  it('tolerante a campos extra (passthrough)', () => {
    const result = InvoiceListItemSchema.parse(buildInvoice({ unexpectedField: 'foo' }))
    expect((result as Record<string, unknown>).unexpectedField).toBe('foo')
  })

  it('normaliza numberTemplate array → objeto', () => {
    const result = InvoiceListItemSchema.parse(
      buildInvoice({ numberTemplate: [{ id: '1', prefix: 'FE-', number: 521 }] }),
    )
    expect(result.numberTemplate).toEqual({ id: '1', prefix: 'FE-', number: 521 })
  })

  it('acepta dueDate null (crédito abierto sin vencimiento)', () => {
    const result = InvoiceListItemSchema.parse(buildInvoice({ dueDate: null }))
    expect(result.dueDate).toBeNull()
  })

  it('acepta currency null (cuando no hay multicurrency)', () => {
    const result = InvoiceListItemSchema.parse(buildInvoice({ currency: null }))
    expect(result.currency).toBeNull()
  })

  it('rechaza un status inválido', () => {
    expect(() => InvoiceListItemSchema.parse(buildInvoice({ status: 'pagada' }))).toThrow()
  })
})

// -----------------------------------------------------------------------------
// InvoiceListResponseSchema (metadata wrapper | bare array → always { data, total })
// -----------------------------------------------------------------------------

describe('InvoiceListResponseSchema', () => {
  it('normaliza la respuesta con metadata', () => {
    const input = {
      metadata: { total: 1247 },
      data: [buildInvoice(), buildInvoice({ id: '2', numberTemplate: { id: '1', prefix: 'FE-', number: 521 } })],
    }
    const result = InvoiceListResponseSchema.parse(input)
    expect(result.total).toBe(1247)
    expect(result.data).toHaveLength(2)
    expect(result.data[0]!.id).toBe('1')
  })

  it('normaliza la respuesta como array puro', () => {
    const input = [buildInvoice(), buildInvoice({ id: '2' })]
    const result = InvoiceListResponseSchema.parse(input)
    expect(result.total).toBe(2)
    expect(result.data).toHaveLength(2)
  })

  it('array vacío → total=0', () => {
    const result = InvoiceListResponseSchema.parse([])
    expect(result).toEqual({ data: [], total: 0 })
  })
})

// -----------------------------------------------------------------------------
// InvoiceItemSchema
// -----------------------------------------------------------------------------

describe('InvoiceItemSchema', () => {
  it('parsea un item con tax (numbers nativos)', () => {
    const item = {
      id: '1',
      name: 'Servicio de consultoría',
      description: 'Auditoría junio',
      reference: 'SRV-001',
      price: 1000,
      quantity: 1,
      discount: 0,
      tax: [{ id: '6', name: 'IVA', percentage: 19 }],
    }
    const result = InvoiceItemSchema.parse(item)
    expect(result.name).toBe('Servicio de consultoría')
    expect(result.tax).toHaveLength(1)
    expect(result.tax![0]!.percentage).toBe(19)
  })

  it('acepta un item sin tax (exento)', () => {
    const item = { id: '1', name: 'Item exento', price: 100, quantity: 1 }
    const result = InvoiceItemSchema.parse(item)
    expect(result.tax).toBeUndefined()
  })

  // Smoke-test from real Alegra: numbers come as strings in detail view.
  it('coerce numeric strings (price, quantity, discount, percentage)', () => {
    const item = {
      id: '1',
      name: 'Servicio',
      price: '1000',        // string
      quantity: '2',         // string
      discount: '50',        // string
      tax: [{ id: '6', name: 'IVA', percentage: '19' }],  // string percentage
    }
    const result = InvoiceItemSchema.parse(item)
    expect(result.price).toBe(1000)
    expect(result.quantity).toBe(2)
    expect(result.discount).toBe(50)
    expect(result.tax![0]!.percentage).toBe(19)
    expect(typeof result.price).toBe('number')
    expect(typeof result.tax![0]!.percentage).toBe('number')
  })

  it('acepta discount ausente', () => {
    const item = { id: '1', name: 'Sin descuento', price: 100, quantity: 1 }
    const result = InvoiceItemSchema.parse(item)
    expect(result.discount).toBeUndefined()
  })

  it('tolerante a campos extra (passthrough)', () => {
    const item = {
      id: '1',
      name: 'X',
      price: 100,
      quantity: 1,
      customField: 'whatever',
    }
    const result = InvoiceItemSchema.parse(item) as Record<string, unknown>
    expect(result.customField).toBe('whatever')
  })
})

// -----------------------------------------------------------------------------
// InvoicePaymentSchema (amount: number | string → number)
// -----------------------------------------------------------------------------

describe('InvoicePaymentSchema', () => {
  it('coerce amount string a number', () => {
    const result = InvoicePaymentSchema.parse({
      id: '125',
      date: '2026-06-15',
      amount: '500.50',
      paymentMethod: 'transfer',
      status: 'open',
    })
    expect(result.amount).toBe(500.5)
    expect(typeof result.amount).toBe('number')
  })

  it('acepta amount number', () => {
    const result = InvoicePaymentSchema.parse({
      id: '125',
      date: '2026-06-15',
      amount: 500.5,
      paymentMethod: 'transfer',
      status: 'open',
    })
    expect(result.amount).toBe(500.5)
  })

  it('coerce amount string entero (caso Alegra legacy)', () => {
    const result = InvoicePaymentSchema.parse({
      id: '125',
      date: '2026-06-15',
      amount: '500',
      paymentMethod: null,
      status: 'open',
    })
    expect(result.amount).toBe(500)
  })
})

// -----------------------------------------------------------------------------
// InvoiceRetentionSchema
// -----------------------------------------------------------------------------

describe('InvoiceRetentionSchema', () => {
  it('parsea una retención (Retefuente, ReteIVA)', () => {
    const r = InvoiceRetentionSchema.parse({
      id: '1',
      name: 'Retefuente',
      percentage: 2.5,
      amount: 25,
    })
    expect(r.name).toBe('Retefuente')
    expect(r.amount).toBe(25)
  })
})

// -----------------------------------------------------------------------------
// InvoiceEventSchema (DIAN — strings libres, sin enum)
// -----------------------------------------------------------------------------

describe('InvoiceEventSchema', () => {
  it('acepta cualquier status string (DIAN usa valores ad-hoc)', () => {
    expect(() =>
      InvoiceEventSchema.parse({
        status: 'ACCEPTED_DIAN',
        date: '15-06-2026 16:04:00',
        type: 'CLIENT_ACCEPTANCE',
      }),
    ).not.toThrow()
  })

  it('NO parsea el date (queda como string para que la UI use parseAlegraDateTime)', () => {
    const result = InvoiceEventSchema.parse({
      status: 'SENT',
      date: '15-06-2026 16:04:00',
      type: 'CLIENT_EMAILS',
    })
    expect(typeof result.date).toBe('string')
    expect(result.date).toBe('15-06-2026 16:04:00')
  })
})

// -----------------------------------------------------------------------------
// InvoiceDetailSchema (extends list + items/payments/retentions/events)
// -----------------------------------------------------------------------------

describe('InvoiceDetailSchema', () => {
  it('extiende InvoiceListItemSchema con items, payments, retentions, events', () => {
    const detail = {
      ...buildInvoice(),
      items: [{ id: '1', name: 'Servicio', price: 1000, quantity: 1 }],
      payments: [{ id: '125', date: '2026-06-15', amount: '500', paymentMethod: 'transfer', status: 'open' }],
      retentions: [{ id: '1', name: 'Retefuente', percentage: 2.5, amount: 25 }],
      events: [{ status: 'ACCEPTED_DIAN', date: '15-06-2026 16:04:00', type: 'CLIENT_ACCEPTANCE' }],
    }
    const result = InvoiceDetailSchema.parse(detail)
    expect(result.items).toHaveLength(1)
    expect(result.payments).toHaveLength(1)
    expect(result.payments![0]!.amount).toBe(500)
    expect(result.retentions).toHaveLength(1)
    expect(result.events).toHaveLength(1)
  })

  it('acepta sin items/payments/retentions/events (opcionales)', () => {
    const result = InvoiceDetailSchema.parse(buildInvoice())
    expect(result.items).toBeUndefined()
    expect(result.payments).toBeUndefined()
  })
})

// -----------------------------------------------------------------------------
// CompanySchema
// -----------------------------------------------------------------------------

describe('CompanySchema', () => {
  it('parsea una company colombiana', () => {
    const result = CompanySchema.parse({
      name: 'Administración Segura',
      country: 'CO',
      applicationVersion: 'colombia',
      decimalPrecision: 0,
      currency: { code: 'COP', symbol: '$' },
    })
    expect(result.country).toBe('CO')
    expect(result.currency.code).toBe('COP')
    expect(result.decimalPrecision).toBe(0)
  })

  it('acepta company SIN country (Alegra a veces no lo devuelve)', () => {
    // Some Alegra accounts omit country. Address has department/city instead.
    const result = CompanySchema.parse({
      name: 'Administración Segura S.A.S',
      applicationVersion: 'colombia',
      decimalPrecision: '0',
      currency: { code: 'COP', symbol: '$' },
      address: { city: 'Medellín', department: 'Antioquia' },
    })
    expect(result.country).toBeUndefined()
    expect(result.currency.code).toBe('COP')
  })

  it('coerce decimalPrecision string a number', () => {
    const result = CompanySchema.parse({
      name: 'Test',
      country: 'CO',
      applicationVersion: 'colombia',
      decimalPrecision: '2',
      currency: { code: 'USD', symbol: '$' },
    })
    expect(result.decimalPrecision).toBe(2)
    expect(typeof result.decimalPrecision).toBe('number')
  })

  it('tolerante a campos extra (passthrough)', () => {
    const result = CompanySchema.parse({
      name: 'Test',
      country: 'CO',
      applicationVersion: 'colombia',
      decimalPrecision: 0,
      currency: { code: 'COP', symbol: '$' },
      id: 123,
      logoUrl: 'https://example.com/logo.png',
    })
    expect((result as Record<string, unknown>).id).toBe(123)
  })
})

describe('InvoiceCurrencySchema (nullish)', () => {
  it('acepta el objeto con code + symbol', () => {
    const r = { code: 'COP', symbol: '$' }
    expect(InvoiceCurrencySchema.parse(r)).toEqual(r)
  })

  it('acepta null (cuenta multicurrency sin esta factura)', () => {
    expect(InvoiceCurrencySchema.parse(null)).toBeNull()
  })

  it('acepta undefined (caso típico: cuenta single-currency, Alegra omite el campo)', () => {
    expect(InvoiceCurrencySchema.parse(undefined)).toBeUndefined()
  })

  // V2 — /estimates sometimes returns currency WITHOUT symbol (only code + exchangeRate).
  // We made `symbol` .optional() so the same InvoiceCurrencySchema works for both
  // invoices and estimates.
  it('acepta currency SIN symbol (caso V2 /estimates)', () => {
    const r = { code: 'USD', exchangeRate: 3100 }
    const result = InvoiceCurrencySchema.parse(r)
    expect(result).toEqual({ code: 'USD', exchangeRate: 3100, symbol: undefined })
  })
})

// =============================================================================
// V2 — Estimates (cotizaciones)
// =============================================================================

function buildEstimate(overrides: Record<string, unknown> = {}) {
  return {
    id: '21',
    number: '22',
    date: '2015-12-15',
    dueDate: '2015-12-25',
    observations: 'Observaciones de la cotización.',
    anotation: 'Notas de mi cotización',
    seller: { id: '6', name: 'Alejandro Mesa', identification: '123456', observations: 'Ventas sur' },
    priceList: null,
    client: {
      id: '2',
      name: 'Acrecer',
      identification: '963.654.988',
      email: 'prueba2@alegra.com',
      phonePrimary: '111 11 11',
      phoneSecondary: '',
      fax: '',
      mobile: '(333) 555-55-55',
      observations: '',
      address: { address: 'Avenida Madison', city: 'New York, USA' },
    },
    total: 707,
    currency: { code: 'USD', exchangeRate: 3100 },
    ...overrides,
  }
}

// -----------------------------------------------------------------------------
// EstimateSellerSchema
// -----------------------------------------------------------------------------

describe('EstimateSellerSchema', () => {
  it('parsea un seller completo', () => {
    const result = EstimateSellerSchema.parse({
      id: '6',
      name: 'Alejandro Mesa',
      identification: '123456',
      observations: 'Ventas sur',
    })
    expect(result?.name).toBe('Alejandro Mesa')
  })

  it('acepta null (estimate sin vendedor asignado)', () => {
    expect(EstimateSellerSchema.parse(null)).toBeNull()
  })

  it('acepta undefined (campo omitido)', () => {
    expect(EstimateSellerSchema.parse(undefined)).toBeUndefined()
  })

  it('identification es opcional', () => {
    const result = EstimateSellerSchema.parse({ id: '1', name: 'Vendedor X' })
    expect(result?.identification).toBeUndefined()
  })
})

// -----------------------------------------------------------------------------
// EstimateWarehouseSchema
// -----------------------------------------------------------------------------

describe('EstimateWarehouseSchema', () => {
  it('parsea un warehouse completo', () => {
    const result = EstimateWarehouseSchema.parse({ id: '1', name: 'Principal' })
    expect(result?.name).toBe('Principal')
  })

  it('acepta null', () => {
    expect(EstimateWarehouseSchema.parse(null)).toBeNull()
  })

  it('acepta undefined', () => {
    expect(EstimateWarehouseSchema.parse(undefined)).toBeUndefined()
  })
})

// -----------------------------------------------------------------------------
// EstimateListItemSchema
// -----------------------------------------------------------------------------

describe('EstimateListItemSchema', () => {
  it('parsea una cotización válida (number como string)', () => {
    const result = EstimateListItemSchema.parse(buildEstimate())
    expect(result.id).toBe('21')
    expect(result.number).toBe(22) // coerced from "22"
    expect(result.total).toBe(707)
    expect(result.seller?.name).toBe('Alejandro Mesa')
    expect(result.anotation).toBe('Notas de mi cotización')
  })

  it('coerce number "22" → 22 (Alegra sends numbers as JSON strings)', () => {
    const result = EstimateListItemSchema.parse(buildEstimate({ number: '22' }))
    expect(result.number).toBe(22)
    expect(typeof result.number).toBe('number')
  })

  it('coerce total numérico como string ("1500000" → 1500000)', () => {
    const result = EstimateListItemSchema.parse(buildEstimate({ total: '1500000' }))
    expect(result.total).toBe(1500000)
  })

  it('NO tiene campo `status` en el shape (cotizaciones son docs informativos)', () => {
    // Defensive: if a stray status sneaks in, it should pass through but the
    // schema doesn't declare it. The consumer code can't rely on it.
    const result = EstimateListItemSchema.parse(buildEstimate({ status: 'sent' }))
    expect((result as Record<string, unknown>).status).toBe('sent') // passthrough
  })

  it('seller null es válido', () => {
    const result = EstimateListItemSchema.parse(buildEstimate({ seller: null }))
    expect(result.seller).toBeNull()
  })

  it('acepta dueDate null (sin vencimiento)', () => {
    const result = EstimateListItemSchema.parse(buildEstimate({ dueDate: null }))
    expect(result.dueDate).toBeNull()
  })

  it('acepta currency SIN symbol (caso real V2)', () => {
    const result = EstimateListItemSchema.parse(
      buildEstimate({ currency: { code: 'USD', exchangeRate: 3100 } }),
    )
    expect(result.currency?.code).toBe('USD')
    expect(result.currency?.symbol).toBeUndefined()
  })

  it('tolerante a campos extra (passthrough — ej. fax, mobile del client)', () => {
    const result = EstimateListItemSchema.parse(buildEstimate({ unexpectedField: 'foo' }))
    expect((result as Record<string, unknown>).unexpectedField).toBe('foo')
  })

  it('client con campos extra de /estimates pasa por el InvoiceClientSchema passthrough', () => {
    // /estimates returns extra client fields (fax, mobile, phoneSecondary, observations)
    // that aren't in InvoiceClientSchema but pass through.
    const result = EstimateListItemSchema.parse(buildEstimate())
    expect(result.client.identification).toBe('963.654.988')
    // Verify extras are accessible via the type (the field is preserved)
    expect((result.client as Record<string, unknown>).mobile).toBe('(333) 555-55-55')
  })
})

// -----------------------------------------------------------------------------
// EstimateListResponseSchema (metadata wrapper | bare array → always { data, total })
// -----------------------------------------------------------------------------

describe('EstimateListResponseSchema', () => {
  it('normaliza la respuesta con metadata', () => {
    const input = {
      metadata: { total: 15 },
      data: [buildEstimate(), buildEstimate({ id: '22' })],
    }
    const result = EstimateListResponseSchema.parse(input)
    expect(result.total).toBe(15)
    expect(result.data).toHaveLength(2)
    expect(result.data[0]!.id).toBe('21')
  })

  it('normaliza la respuesta como array puro (sin metadata)', () => {
    const input = [buildEstimate(), buildEstimate({ id: '22' })]
    const result = EstimateListResponseSchema.parse(input)
    expect(result.total).toBe(2)
    expect(result.data).toHaveLength(2)
  })

  it('array vacío → total=0', () => {
    const result = EstimateListResponseSchema.parse([])
    expect(result).toEqual({ data: [], total: 0 })
  })
})

// -----------------------------------------------------------------------------
// EstimateDetailSchema (extends list + items + warehouse)
// -----------------------------------------------------------------------------

describe('EstimateDetailSchema', () => {
  it('extiende EstimateListItemSchema con items y warehouse', () => {
    const detail = {
      ...buildEstimate(),
      items: [
        { id: '1', name: 'Billetera', price: 120, discount: '0.00', quantity: '5.00', total: 630 },
      ],
      warehouse: { id: '1', name: 'Principal' },
    }
    const result = EstimateDetailSchema.parse(detail)
    expect(result.items).toHaveLength(1)
    expect(result.items![0]!.quantity).toBe(5) // coerced from "5.00"
    expect(result.warehouse?.name).toBe('Principal')
  })

  it('items y warehouse son opcionales', () => {
    const result = EstimateDetailSchema.parse(buildEstimate())
    expect(result.items).toBeUndefined()
    expect(result.warehouse).toBeUndefined()
  })

  it('items acepta el shape de InvoiceItemSchema (mismos campos, misma safeNumber)', () => {
    // The estimate detail item shape is identical to the invoice item shape.
    // Quantity, discount come as strings in real /estimates responses.
    const result = EstimateDetailSchema.parse(
      buildEstimate({
        items: [
          {
            id: '1',
            name: 'Servicio',
            price: 500000,
            quantity: '3.00', // string
            discount: '0.00', // string
            tax: [{ id: '3', name: 'IVA', percentage: '16.00' }],
          },
        ],
      }),
    )
    expect(result.items![0]!.quantity).toBe(3)
    expect(result.items![0]!.discount).toBe(0)
    expect(result.items![0]!.tax![0]!.percentage).toBe(16)
  })
})
