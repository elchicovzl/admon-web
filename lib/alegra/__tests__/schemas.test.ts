import { describe, it, expect } from 'vitest'
import {
  CompanySchema,
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
  it('parsea un item con tax', () => {
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
})
