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
  PaymentListResponseSchema,
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

/**
 * Shaped after a REAL /payments row, not the published docs.
 *
 * The links live in sibling arrays (`invoices` / `bills` / `categories`);
 * `associations` is a display string like "Facturas: FEAD9073". Modelling it
 * the way the docs describe is what made the page 500 on first contact with
 * live data.
 */
function buildPayment(overrides: Partial<PaymentListItem> = {}): PaymentListItem {
  return {
    id: 'p1',
    date: '2026-07-12',
    amount: 500,
    type: 'out',
    status: 'open',
    paymentMethod: 'transfer',
    number: 1,
    categories: [{ id: 'c1' }],
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
      buildPayment({ amount: 1000, bills: [{ id: 'b1' }] }),
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
      buildPayment({ amount: 250, categories: [{ id: 'taxi' }] }),
    ]

    expect(sumStandaloneExpenses(payments)).toBe(250)
  })

  it('los cobros (type=in) nunca cuentan como gasto', () => {
    const payments = [
      buildPayment({ type: 'in', amount: 5000, categories: [{ id: 'c1' }] }),
    ]

    // Money arriving is not an expense no matter how it's associated.
    expect(sumStandaloneExpenses(payments)).toBe(0)
  })

  it('un pago con associations ausente NO se cuenta como gasto suelto', () => {
    // This is the `fields=associations` failure mode. If the client forgets
    // that param, EVERY payment arrives without associations. Counting them
    // as standalone would invent a second copy of every expense.
    const payments = [buildPayment({ amount: 900, invoices: undefined, bills: undefined, categories: undefined })]

    expect(classifyPaymentAssociation(payments[0]!)).toBe('unknown')
    expect(sumStandaloneExpenses(payments)).toBe(0)
  })

  it('mezcla realista: factura pagada + gasto suelto + cobro', () => {
    const bills = [buildBill({ total: 1000 })]
    const payments = [
      buildPayment({ amount: 1000, bills: [{ id: 'b1' }] }),
      buildPayment({ id: 'p2', amount: 300, categories: [{ id: 'c1' }] }),
      buildPayment({ id: 'p3', type: 'in', amount: 7000, invoices: [{ id: 'i1' }] }),
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
  const asPayment = (o: Record<string, unknown>) => o as unknown as PaymentListItem

  it('bills tiene prioridad', () => {
    expect(classifyPaymentAssociation(asPayment({ bills: [{ id: 'b1' }] }))).toBe('bill')
  })

  it('invoices → invoice', () => {
    expect(classifyPaymentAssociation(asPayment({ invoices: [{ id: 'i1' }] }))).toBe('invoice')
  })

  it('solo categories → standalone', () => {
    expect(classifyPaymentAssociation(asPayment({ categories: [{ id: 'c' }] }))).toBe('standalone')
  })

  it('arrays presentes pero vacíos → standalone', () => {
    // The arrays arrived and are empty — we DO know there's no document.
    expect(
      classifyPaymentAssociation(asPayment({ bills: [], invoices: [], categories: [] })),
    ).toBe('standalone')
  })

  it('ningún array presente → unknown', () => {
    // We weren't told, which is NOT the same as "there is nothing".
    expect(classifyPaymentAssociation(asPayment({}))).toBe('unknown')
  })

  it('IGNORA el string `associations` — es una etiqueta, no una estructura', () => {
    // Live data: "associations": "Facturas: FEAD9073". Parsing that sentence
    // for logic breaks the moment Alegra rewords it or the account runs in
    // another language. Only the arrays are authoritative.
    expect(
      classifyPaymentAssociation(asPayment({ associations: 'Facturas: FEAD9073' })),
    ).toBe('unknown')

    // …and when both are present, the arrays decide.
    expect(
      classifyPaymentAssociation(
        asPayment({ associations: 'Facturas: FEAD9073', invoices: [{ id: '2070' }] }),
      ),
    ).toBe('invoice')
  })

  it('describePaymentAssociation prefiere la etiqueta de Alegra cuando existe', () => {
    // It names the actual document, which beats a generic category for an
    // operator scanning the table.
    expect(
      describePaymentAssociation(
        asPayment({ associations: 'Facturas: FEAD9073', invoices: [{ id: '2070' }] }),
      ),
    ).toBe('Facturas: FEAD9073')
  })

  it('describePaymentAssociation cae a la clasificación sin etiqueta', () => {
    expect(describePaymentAssociation(asPayment({ bills: [{ id: 'b' }] }))).toBe('Factura de compra')
    expect(describePaymentAssociation(asPayment({ invoices: [{ id: 'i' }] }))).toBe('Factura de venta')
    expect(describePaymentAssociation(asPayment({ categories: [{ id: 'c' }] }))).toBe('Sin factura')
    expect(describePaymentAssociation(asPayment({}))).toBe('—')
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

  it('acepta los arrays de links ausentes sin romper', () => {
    // The shape you get when the extra `fields` weren't requested. It must
    // parse — the classifier is what flags it as unknown.
    const parsed = PaymentListItemSchema.parse({ ...base, amount: 1 })
    expect(classifyPaymentAssociation(parsed)).toBe('unknown')
  })

  it('preserva los links cuando vienen', () => {
    const parsed = PaymentListItemSchema.parse({
      ...base,
      amount: 1,
      bills: [{ id: 'b1', number: 7 }],
    })

    expect(classifyPaymentAssociation(parsed)).toBe('bill')
  })

  it('rechaza un type que no sea in/out', () => {
    expect(() => PaymentListItemSchema.parse({ ...base, type: 'maybe', amount: 1 })).toThrow()
  })

  // ---------------------------------------------------------------------------
  // Regression: the exact payload that 500'd the page
  // ---------------------------------------------------------------------------

  it('parsea una fila REAL de /payments (la que rompió el schema original)', () => {
    // Copied verbatim from a live response. Every field here contradicted the
    // published docs in some way: `associations` is a string, the links are
    // sibling arrays, the account key is `bankAccount`, and `currency` is
    // absent entirely.
    const real = {
      id: '2385',
      date: '2026-12-30',
      number: '1884',
      amount: 409300,
      observations: null,
      anotation: null,
      type: 'in',
      paymentMethod: 'deposit',
      status: 'open',
      decimalPrecision: '0',
      calculationScale: '6',
      bankAccount: { id: '3', name: 'Banco 1', type: 'bank' },
      client: {
        id: '317',
        name: 'AYDA ELIS RIVAS MORENO',
        phone: null,
        identification: '43077759',
      },
      invoices: [
        {
          id: '2070',
          number: 'FEAD9073',
          date: '2026-01-26',
          amount: 409300,
          total: 409300,
          balance: 0,
        },
      ],
      costCenter: null,
      numberTemplate: {
        id: '3',
        prefix: null,
        number: '1884',
        fullNumber: '1884',
        formattedNumber: '1884',
      },
      associations: 'Facturas: FEAD9073',
    }

    const parsed = PaymentListItemSchema.parse(real)

    expect(parsed.amount).toBe(409300)
    expect(parsed.number).toBe(1884) // string "1884" → number
    expect(parsed.type).toBe('in')
    expect(parsed.client?.name).toBe('AYDA ELIS RIVAS MORENO')
    // The link array, not the label, drives classification.
    expect(classifyPaymentAssociation(parsed)).toBe('invoice')
    expect(describePaymentAssociation(parsed)).toBe('Facturas: FEAD9073')
  })

  it('parsea el envoltorio metadata real (3485 pagos)', () => {
    const wrapped = {
      metadata: { total: 3485 },
      data: [
        {
          id: '2385',
          date: '2026-12-30',
          amount: 409300,
          type: 'in',
          associations: 'Facturas: FEAD9073',
          invoices: [{ id: '2070', number: 'FEAD9073' }],
        },
      ],
    }

    const parsed = PaymentListResponseSchema.parse(wrapped)
    expect(parsed.total).toBe(3485)
    expect(parsed.data).toHaveLength(1)
  })
})
