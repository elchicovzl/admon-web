/**
 * Tests for the expense side: bills, payments, and above all the rule that
 * keeps them from being added together.
 *
 * The failure mode being guarded against is not a crash — it's a number that
 * looks plausible and is exactly twice the truth. Alegra's own docs flag it:
 * a payment settling a bill is the SAME money as that bill, one step later.
 */

import { describe, expect, it } from 'vitest'
import {
  BILL_STATUS_LABELS,
  classifyPaymentAssociation,
  describePaymentAssociation,
  formatBillNumber,
  getBillStatusLabel,
  getPaymentTypeLabel,
  parseBillFilters,
  parsePaymentFilters,
  buildBillsSearchString,
  buildPaymentsSearchString,
  sumBills,
  sumPayments,
  sumStandaloneExpenses,
} from '../transformers'
import {
  BillListItemSchema,
  BillListResponseSchema,
  PaymentListItemSchema,
  type BillListItem,
  type PaymentListItem,
} from '../types'

// -----------------------------------------------------------------------------
// Builders
// -----------------------------------------------------------------------------

function buildBill(overrides: Partial<BillListItem> = {}): BillListItem {
  return {
    id: 'b1',
    billNumber: 'FC-100',
    date: '2026-07-10',
    dueDate: '2026-08-10',
    status: 'open',
    provider: { id: '9', name: 'Proveedor SA', identification: '900999888-1' },
    total: 1000,
    totalPaid: 0,
    balance: 1000,
    currency: { code: 'COP', symbol: '$' },
    ...overrides,
  } as unknown as BillListItem
}

function buildPayment(overrides: Partial<PaymentListItem> = {}): PaymentListItem {
  return {
    id: 'p1',
    date: '2026-07-12',
    amount: 500,
    type: 'out',
    status: 'open',
    paymentMethod: 'transfer',
    number: 1,
    currency: { code: 'COP', symbol: '$' },
    associations: { categories: [{ id: 'c1' }] },
    ...overrides,
  } as unknown as PaymentListItem
}

// -----------------------------------------------------------------------------
// THE RULE
// -----------------------------------------------------------------------------

describe('regla anti-duplicación de gastos', () => {
  it('un pago asociado a una factura de compra NO cuenta como gasto suelto', () => {
    // The canonical double-count: a 1000 bill, paid with a 1000 payment.
    // Naively "bills + payments" reports 2000 of expenses for 1000 of spend.
    const bills = [buildBill({ total: 1000, totalPaid: 1000, balance: 0, status: 'closed' })]
    const payments = [
      buildPayment({ amount: 1000, associations: { bills: [{ id: 'b1' }] } }),
    ]

    const accrual = sumBills(bills, 'total')
    const cash = sumPayments(payments)
    const standalone = sumStandaloneExpenses(payments)

    expect(accrual).toBe(1000)
    expect(cash).toBe(1000)
    // The two views agree on the amount — that's the point, it's ONE expense.
    expect(accrual).toBe(cash)
    // And it must NOT show up again as an uninvoiced expense.
    expect(standalone).toBe(0)

    // The non-duplicating total is accrual + standalone, never accrual + cash.
    expect(accrual + standalone).toBe(1000)
    expect(accrual + cash).toBe(2000) // ← the wrong answer, pinned so it's visible
  })

  it('un pago sin factura SÍ es un gasto que no aparece en /bills', () => {
    const payments = [
      buildPayment({ amount: 250, associations: { categories: [{ id: 'taxi' }] } }),
    ]

    expect(sumStandaloneExpenses(payments)).toBe(250)
  })

  it('los cobros (type=in) nunca cuentan como gasto', () => {
    const payments = [
      buildPayment({ type: 'in', amount: 5000, associations: { categories: [{ id: 'c1' }] } }),
    ]

    // Money arriving is not an expense no matter how it's associated.
    expect(sumStandaloneExpenses(payments)).toBe(0)
  })

  it('un pago con associations ausente NO se cuenta como gasto suelto', () => {
    // This is the `fields=associations` failure mode. If the client forgets
    // that param, EVERY payment arrives without associations. Counting them
    // as standalone would invent a second copy of every expense.
    const payments = [buildPayment({ amount: 900, associations: undefined })]

    expect(classifyPaymentAssociation(payments[0]!)).toBe('unknown')
    expect(sumStandaloneExpenses(payments)).toBe(0)
  })

  it('mezcla realista: factura pagada + gasto suelto + cobro', () => {
    const bills = [buildBill({ total: 1000 })]
    const payments = [
      buildPayment({ amount: 1000, associations: { bills: [{ id: 'b1' }] } }),
      buildPayment({ id: 'p2', amount: 300, associations: { categories: [{ id: 'c1' }] } }),
      buildPayment({ id: 'p3', type: 'in', amount: 7000, associations: { invoices: [{ id: 'i1' }] } }),
    ]

    expect(sumBills(bills, 'total')).toBe(1000)
    // Cash view sums ALL outgoing... but this helper sums whatever it's given,
    // so the caller must pre-filter by type — which the KPI does via the API.
    expect(sumStandaloneExpenses(payments)).toBe(300)
    // Real month expense without duplication: 1000 invoiced + 300 uninvoiced.
    expect(sumBills(bills, 'total') + sumStandaloneExpenses(payments)).toBe(1300)
  })
})

// -----------------------------------------------------------------------------
// classifyPaymentAssociation
// -----------------------------------------------------------------------------

describe('classifyPaymentAssociation', () => {
  it('bills tiene prioridad', () => {
    expect(
      classifyPaymentAssociation({ associations: { bills: [{ id: 'b1' }] } } as PaymentListItem),
    ).toBe('bill')
  })

  it('invoices → invoice', () => {
    expect(
      classifyPaymentAssociation({ associations: { invoices: [{ id: 'i1' }] } } as PaymentListItem),
    ).toBe('invoice')
  })

  it('solo categories → standalone', () => {
    expect(
      classifyPaymentAssociation({ associations: { categories: [{ id: 'c' }] } } as PaymentListItem),
    ).toBe('standalone')
  })

  it('objeto vacío → standalone (no unknown)', () => {
    // The object arrived, it's just empty — we DO know there's no document.
    expect(classifyPaymentAssociation({ associations: {} } as PaymentListItem)).toBe('standalone')
  })

  it('arrays vacíos → standalone', () => {
    expect(
      classifyPaymentAssociation({
        associations: { bills: [], invoices: [], categories: [] },
      } as unknown as PaymentListItem),
    ).toBe('standalone')
  })

  it('undefined → unknown', () => {
    expect(classifyPaymentAssociation({ associations: undefined } as PaymentListItem)).toBe('unknown')
  })

  it('null → unknown', () => {
    expect(classifyPaymentAssociation({ associations: null } as PaymentListItem)).toBe('unknown')
  })

  it('describePaymentAssociation devuelve etiquetas en español', () => {
    expect(describePaymentAssociation({ associations: { bills: [{ id: 'b' }] } } as PaymentListItem))
      .toBe('Factura de compra')
    expect(describePaymentAssociation({ associations: { invoices: [{ id: 'i' }] } } as PaymentListItem))
      .toBe('Factura de venta')
    expect(describePaymentAssociation({ associations: { categories: [{ id: 'c' }] } } as PaymentListItem))
      .toBe('Sin factura')
    expect(describePaymentAssociation({ associations: undefined } as PaymentListItem)).toBe('—')
  })
})

// -----------------------------------------------------------------------------
// Sums
// -----------------------------------------------------------------------------

describe('sumBills / sumPayments', () => {
  it('lista vacía suma 0, no NaN', () => {
    expect(sumBills([], 'total')).toBe(0)
    expect(sumPayments([])).toBe(0)
    expect(sumStandaloneExpenses([])).toBe(0)
  })

  it('suma el campo pedido', () => {
    const bills = [
      buildBill({ total: 100, totalPaid: 40, balance: 60 }),
      buildBill({ id: 'b2', total: 200, totalPaid: 200, balance: 0 }),
    ]

    expect(sumBills(bills, 'total')).toBe(300)
    expect(sumBills(bills, 'totalPaid')).toBe(240)
    expect(sumBills(bills, 'balance')).toBe(60)
  })
})

// -----------------------------------------------------------------------------
// Display helpers
// -----------------------------------------------------------------------------

describe('formatBillNumber', () => {
  it('devuelve el número tal cual', () => {
    expect(formatBillNumber({ billNumber: 'FC-100' })).toBe('FC-100')
  })

  it('devuelve — cuando falta', () => {
    // Bills captured without a supplier document number are legitimate.
    expect(formatBillNumber({ billNumber: null })).toBe('—')
    expect(formatBillNumber({ billNumber: undefined })).toBe('—')
    expect(formatBillNumber({ billNumber: '' })).toBe('—')
  })
})

describe('etiquetas', () => {
  it('el estado open de una compra dice "Por pagar", no "Abierta"', () => {
    // Same API value as an invoice's `open`, opposite meaning for the business.
    expect(getBillStatusLabel('open')).toBe('Por pagar')
    expect(BILL_STATUS_LABELS.closed).toBe('Pagada')
  })

  it('los tipos de pago distinguen cobro de pago', () => {
    expect(getPaymentTypeLabel('in')).toBe('Cobro')
    expect(getPaymentTypeLabel('out')).toBe('Pago')
  })
})

// -----------------------------------------------------------------------------
// Filters
// -----------------------------------------------------------------------------

describe('parseBillFilters', () => {
  it('parsea status en forma de array y de coma', () => {
    expect(parseBillFilters({ status: ['open', 'closed'] }).status).toEqual(['open', 'closed'])
    expect(parseBillFilters({ status: 'open,void' }).status).toEqual(['open', 'void'])
  })

  it('descarta status inválidos — draft no existe en compras', () => {
    expect(parseBillFilters({ status: 'draft' }).status).toEqual([])
    expect(parseBillFilters({ status: 'garbage' }).status).toEqual([])
  })

  it('descarta fechas malformadas', () => {
    expect(parseBillFilters({ date_from: '10-07-2026' }).dateFrom).toBeNull()
    expect(parseBillFilters({ date_from: '2026-07-10' }).dateFrom).toBe('2026-07-10')
  })

  it('normaliza provider_name y page', () => {
    expect(parseBillFilters({ provider_name: '  ACME  ' }).providerName).toBe('ACME')
    expect(parseBillFilters({ provider_name: '   ' }).providerName).toBeNull()
    expect(parseBillFilters({ page: '3' }).page).toBe(3)
    expect(parseBillFilters({ page: '0' }).page).toBe(1)
    expect(parseBillFilters(undefined).page).toBe(1)
  })
})

describe('parsePaymentFilters', () => {
  it('acepta solo in/out', () => {
    expect(parsePaymentFilters({ type: 'in' }).type).toBe('in')
    expect(parsePaymentFilters({ type: 'out' }).type).toBe('out')
    expect(parsePaymentFilters({ type: 'sideways' }).type).toBeNull()
    expect(parsePaymentFilters({}).type).toBeNull()
  })
})

describe('search strings', () => {
  it('omite page=1 y filtros vacíos', () => {
    expect(buildBillsSearchString({ page: 1 })).toBe('')
    expect(buildPaymentsSearchString({ page: 1 })).toBe('')
  })

  it('serializa los filtros activos', () => {
    expect(buildBillsSearchString({ status: ['open'], providerName: 'ACME', page: 2 }))
      .toBe('?status=open&provider_name=ACME&page=2')
    expect(buildPaymentsSearchString({ type: 'out', dateFrom: '2026-07-01' }))
      .toBe('?type=out&date_from=2026-07-01')
  })
})

// -----------------------------------------------------------------------------
// Schemas — the "Alegra returns numbers as strings" hazard
// -----------------------------------------------------------------------------

describe('BillListItemSchema', () => {
  const base = {
    id: '1',
    billNumber: 'FC-1',
    date: '2026-07-10',
    dueDate: '2026-08-10',
    status: 'open',
    provider: { id: '9', name: 'Proveedor SA' },
    currency: { code: 'COP', symbol: '$' },
  }

  it('acepta montos como STRING y los normaliza a number', () => {
    // The single most common shape surprise from this API. A string total
    // silently poisons every downstream sum with concatenation or NaN.
    const parsed = BillListItemSchema.parse({
      ...base,
      total: '1190',
      totalPaid: '0',
      balance: '1190',
    })

    expect(parsed.total).toBe(1190)
    expect(parsed.balance).toBe(1190)
    expect(typeof parsed.total).toBe('number')
  })

  it('acepta montos como number', () => {
    const parsed = BillListItemSchema.parse({ ...base, total: 500, totalPaid: 0, balance: 500 })
    expect(parsed.total).toBe(500)
  })

  it('acepta provider ausente', () => {
    // Bills captured without a linked provider record are legitimate.
    const parsed = BillListItemSchema.parse({
      ...base,
      provider: null,
      total: 1,
      totalPaid: 0,
      balance: 1,
    })
    expect(parsed.provider).toBeNull()
  })

  it('rechaza el status draft — no existe en compras', () => {
    expect(() =>
      BillListItemSchema.parse({ ...base, status: 'draft', total: 1, totalPaid: 0, balance: 1 }),
    ).toThrow()
  })

  it('normaliza la respuesta con y sin envoltorio metadata', () => {
    const row = { ...base, total: 10, totalPaid: 0, balance: 10 }

    const wrapped = BillListResponseSchema.parse({ metadata: { total: 87 }, data: [row] })
    expect(wrapped.total).toBe(87)
    expect(wrapped.data).toHaveLength(1)

    const bare = BillListResponseSchema.parse([row])
    expect(bare.total).toBe(1)
  })
})

describe('PaymentListItemSchema', () => {
  const base = {
    id: '1',
    date: '2026-07-12',
    type: 'out',
    currency: { code: 'COP', symbol: '$' },
  }

  it('acepta amount como string', () => {
    const parsed = PaymentListItemSchema.parse({ ...base, amount: '2500' })
    expect(parsed.amount).toBe(2500)
  })

  it('acepta associations ausente sin romper', () => {
    // This is the shape you get when `fields=associations` wasn't sent.
    // It must parse — the classifier is what flags it as unknown.
    const parsed = PaymentListItemSchema.parse({ ...base, amount: 1 })
    expect(parsed.associations).toBeUndefined()
    expect(classifyPaymentAssociation(parsed)).toBe('unknown')
  })

  it('preserva las associations cuando vienen', () => {
    const parsed = PaymentListItemSchema.parse({
      ...base,
      amount: 1,
      associations: { bills: [{ id: 'b1', number: 7 }] },
    })

    expect(classifyPaymentAssociation(parsed)).toBe('bill')
  })

  it('rechaza un type que no sea in/out', () => {
    expect(() => PaymentListItemSchema.parse({ ...base, type: 'maybe', amount: 1 })).toThrow()
  })
})
