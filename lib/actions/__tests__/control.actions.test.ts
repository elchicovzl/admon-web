/**
 * control.actions.test.ts
 *
 * Tests de los Server Actions del módulo Control.
 *
 * Los cálculos ya están cubiertos en control-ledger.test.ts. Acá se prueba lo
 * que solo existe en la capa de actions: el gate de autorización y los guardas
 * de negocio (periodo cerrado, doble anulación, cierre con descuadre).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TipoMovimiento, GrupoCategoria, TipoBolsillo } from '@prisma/client'

const USER_ID = 'cuseraaaaa0001'
const EFECTIVO = 'cbolefectivo1'
const IVONE = 'cbolivone0001'
const CATEGORIA = 'ccatgasto0001'

/** Prisma devuelve Decimal; en los tests alcanza con el contrato .toNumber(). */
function dec(n: number) {
  return { toNumber: () => n } as never
}

const {
  prismaMock,
  authMock,
  hasControlAccessMock,
  alegraMock,
  facturasMock,
  itemsMock,
  pagosMock,
  billsMock,
  estimateDetalleMock,
  invoiceDetalleMock,
} = vi.hoisted(() => ({
  prismaMock: {
    movimiento: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), aggregate: vi.fn() },
    cierreMensual: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn() },
    categoriaMovimiento: { findFirst: vi.fn(), create: vi.fn() },
    prestamo: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    bolsillo: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    contraparte: { findUnique: vi.fn(), create: vi.fn(), findMany: vi.fn() },
    servicioReferenciado: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    conceptoPagoAlegra: { findMany: vi.fn(), create: vi.fn() },
    servicioAlegra: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  authMock: vi.fn(),
  hasControlAccessMock: vi.fn(),
  alegraMock: vi.fn(),
  facturasMock: vi.fn(),
  itemsMock: vi.fn(),
  pagosMock: vi.fn(),
  billsMock: vi.fn(),
  estimateDetalleMock: vi.fn(),
  invoiceDetalleMock: vi.fn(),
}))

vi.mock('@/lib/db/prisma', () => ({ default: prismaMock }))
vi.mock('@/lib/auth/auth', () => ({ auth: authMock }))
vi.mock('@/lib/auth/rbac', () => ({ hasControlAccess: hasControlAccessMock }))
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  // lib/alegra/cache lo usa por debajo; en test se ejecuta la función directo.
  unstable_cache: <T>(fn: T) => fn,
}))
// Control mira a Alegra solo para leer cotizaciones. Acá se mockea para que
// los tests no salgan a la red.
vi.mock('@/lib/alegra/cache', () => ({
  getCachedEstimatesInRange: alegraMock,
  getCachedInvoices: facturasMock,
  getCachedItems: itemsMock,
  getCachedPaymentsInRange: pagosMock,
  getCachedBillsInRange: billsMock,
  ALEGRA_TTL: { company: 3600, kpis: 300, list: 30, detail: 30 },
  getCachedEstimate: estimateDetalleMock,
  getCachedInvoice: invoiceDetalleMock,
}))
vi.mock('react', () => ({
  cache: <T extends (...args: unknown[]) => unknown>(fn: T): T => fn,
}))

import {
  createMovimiento,
  anularMovimiento,
  cerrarPeriodo,
  getBolsillos,
  registrarPataServicio,
  createCategoria,
  createBolsillo,
  setBolsilloActivo,
  getResumenPeriodo,
  getMovimientos,
  getCotizacionesDelPeriodo,
  importarCotizacionesComoIngresos,
  getFacturasDelPeriodo,
  importarFacturasComoIngresos,
  sincronizarServiciosAlegra,
  getReporteAnual,
  getPagosDelPeriodo,
  importarPagosComoEgresos,
} from '../control.actions'

const SESSION = {
  user: { id: USER_ID, email: 'ivone@test.com', role: 'MANAGER', canAccessControl: true },
  expires: new Date(Date.now() + 3_600_000).toISOString(),
}

const MOVIMIENTO_VALIDO = {
  fecha: '2026-08-27',
  tipo: TipoMovimiento.EGRESO,
  monto: 40000,
  concepto: 'Gaseosas para la oficina',
  bolsilloId: EFECTIVO,
  categoriaId: CATEGORIA,
}

/** Fila devuelta por el `select` de movimiento en las actions. */
function filaMovimiento(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cmov0000001',
    fecha: new Date('2026-08-27T00:00:00.000Z'),
    periodo: '2026-08',
    tipo: TipoMovimiento.EGRESO,
    monto: dec(40000),
    concepto: 'Gaseosas para la oficina',
    prestamoId: null,
    notas: null,
    createdAt: new Date(),
    anulaMovimientoId: null,
    bolsillo: { id: EFECTIVO, nombre: 'EFECTIVO' },
    bolsilloDestino: null,
    categoria: { id: CATEGORIA, nombre: 'Cafetería y bebidas', grupo: GrupoCategoria.GASTO_OPERATIVO },
    contraparte: null,
    createdBy: { name: 'Ivone', email: 'ivone@test.com' },
    anuladoPor: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.mockResolvedValue(SESSION)
  hasControlAccessMock.mockResolvedValue(true)
  prismaMock.cierreMensual.findUnique.mockResolvedValue(null)
  // Catálogo de Alegra vacío por defecto: los tests que necesitan desglose lo
  // llenan en su propio beforeEach.
  prismaMock.servicioAlegra.findMany.mockResolvedValue([])
  prismaMock.conceptoPagoAlegra.findMany.mockResolvedValue([])
  prismaMock.conceptoPagoAlegra.create.mockResolvedValue({})
  billsMock.mockResolvedValue({ items: [], truncated: false })
})

// ---------------------------------------------------------------------------

describe('gate de autorización', () => {
  it('rechaza sin sesión', async () => {
    authMock.mockResolvedValue(null)

    const res = await createMovimiento(MOVIMIENTO_VALIDO)

    expect(res.success).toBe(false)
    expect(res.error).toBe('No autenticado')
    expect(prismaMock.movimiento.create).not.toHaveBeenCalled()
  })

  it('rechaza con sesión pero sin acceso a Control', async () => {
    hasControlAccessMock.mockResolvedValue(false)

    const res = await createMovimiento(MOVIMIENTO_VALIDO)

    expect(res.success).toBe(false)
    expect(res.error).toContain('No tenés acceso')
    expect(prismaMock.movimiento.create).not.toHaveBeenCalled()
  })

  it('consulta la base y NO el token de sesión', async () => {
    // La sesión dice canAccessControl: true, pero manda hasControlAccess(),
    // que lee la base. Si alguna vez alguien "optimiza" leyendo del token,
    // este test lo agarra.
    hasControlAccessMock.mockResolvedValue(false)

    const res = await createMovimiento(MOVIMIENTO_VALIDO)

    expect(SESSION.user.canAccessControl).toBe(true)
    expect(res.success).toBe(false)
    expect(hasControlAccessMock).toHaveBeenCalled()
  })

  it('también protege las lecturas de catálogo', async () => {
    hasControlAccessMock.mockResolvedValue(false)

    const res = await getBolsillos()

    expect(res.success).toBe(false)
    expect(prismaMock.bolsillo.findMany).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------

describe('createMovimiento', () => {
  it('deriva el periodo de la fecha y no lo acepta del cliente', async () => {
    prismaMock.movimiento.create.mockResolvedValue(filaMovimiento())

    await createMovimiento(MOVIMIENTO_VALIDO)

    expect(prismaMock.movimiento.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          periodo: '2026-08',
          fecha: new Date('2026-08-27T00:00:00.000Z'),
        }),
      })
    )
  })

  it('no corre de mes un movimiento del último día', async () => {
    prismaMock.movimiento.create.mockResolvedValue(filaMovimiento())

    await createMovimiento({ ...MOVIMIENTO_VALIDO, fecha: '2026-08-31' })

    expect(prismaMock.movimiento.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ periodo: '2026-08' }),
      })
    )
  })

  it('bloquea si el periodo ya está cerrado para ese bolsillo', async () => {
    prismaMock.cierreMensual.findUnique.mockResolvedValue({ cerrado: true })

    const res = await createMovimiento(MOVIMIENTO_VALIDO)

    expect(res.success).toBe(false)
    expect(res.error).toContain('cerrado')
    expect(prismaMock.movimiento.create).not.toHaveBeenCalled()
  })

  it('rechaza monto cero', async () => {
    const res = await createMovimiento({ ...MOVIMIENTO_VALIDO, monto: 0 })

    expect(res.success).toBe(false)
    expect(res.error).toContain('mayor a cero')
    expect(prismaMock.movimiento.create).not.toHaveBeenCalled()
  })

  it('rechaza un EGRESO con bolsillo destino', async () => {
    const res = await createMovimiento({
      ...MOVIMIENTO_VALIDO,
      bolsilloDestinoId: IVONE,
    })

    expect(res.success).toBe(false)
    expect(prismaMock.movimiento.create).not.toHaveBeenCalled()
  })

  it('rechaza un TRASLADO sin destino', async () => {
    const res = await createMovimiento({
      ...MOVIMIENTO_VALIDO,
      tipo: TipoMovimiento.TRASLADO,
    })

    expect(res.success).toBe(false)
    expect(prismaMock.movimiento.create).not.toHaveBeenCalled()
  })

  it('rechaza un traslado a sí mismo', async () => {
    const res = await createMovimiento({
      ...MOVIMIENTO_VALIDO,
      tipo: TipoMovimiento.TRASLADO,
      bolsilloDestinoId: EFECTIVO,
    })

    expect(res.success).toBe(false)
    expect(prismaMock.movimiento.create).not.toHaveBeenCalled()
  })

  it('devuelve el monto como number, no como Decimal', async () => {
    // Un Decimal cruzando hacia un Client Component revienta el render.
    prismaMock.movimiento.create.mockResolvedValue(filaMovimiento())

    const res = await createMovimiento(MOVIMIENTO_VALIDO)

    expect(res.success).toBe(true)
    expect(typeof res.data?.monto).toBe('number')
    expect(res.data?.monto).toBe(40000)
  })
})

// ---------------------------------------------------------------------------

describe('anularMovimiento', () => {
  const anulacion = { movimientoId: 'cmov0000001', motivo: 'Se cargó dos veces' }

  it('crea el espejo de un EGRESO como INGRESO en el mismo bolsillo', async () => {
    prismaMock.movimiento.findUnique.mockResolvedValue({
      id: 'cmov0000001',
      tipo: TipoMovimiento.EGRESO,
      monto: dec(40000),
      concepto: 'Gaseosas',
      bolsilloId: EFECTIVO,
      bolsilloDestinoId: null,
      categoriaId: CATEGORIA,
      contraparteId: null,
      prestamoId: null,
      anuladoPor: null,
      detalleServicios: [],
    })
    prismaMock.movimiento.create.mockResolvedValue(filaMovimiento())

    const res = await anularMovimiento({ ...anulacion, fecha: '2026-08-28' })

    expect(res.success).toBe(true)
    expect(prismaMock.movimiento.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tipo: TipoMovimiento.INGRESO,
          monto: 40000,
          bolsilloId: EFECTIVO,
          bolsilloDestinoId: null,
          anulaMovimientoId: 'cmov0000001',
        }),
      })
    )
  })

  it('anula un TRASLADO con otro TRASLADO en sentido contrario', async () => {
    prismaMock.movimiento.findUnique.mockResolvedValue({
      id: 'cmov0000002',
      tipo: TipoMovimiento.TRASLADO,
      monto: dec(200000),
      concepto: 'A Ivone',
      bolsilloId: EFECTIVO,
      bolsilloDestinoId: IVONE,
      categoriaId: CATEGORIA,
      contraparteId: null,
      prestamoId: null,
      anuladoPor: null,
      detalleServicios: [],
    })
    prismaMock.movimiento.create.mockResolvedValue(filaMovimiento())

    await anularMovimiento({ movimientoId: 'cmov0000002', motivo: 'Traslado erróneo', fecha: '2026-08-28' })

    // La plata vuelve por donde vino: origen y destino se invierten.
    expect(prismaMock.movimiento.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tipo: TipoMovimiento.TRASLADO,
          bolsilloId: IVONE,
          bolsilloDestinoId: EFECTIVO,
        }),
      })
    )
  })

  it('no deja anular dos veces el mismo movimiento', async () => {
    prismaMock.movimiento.findUnique.mockResolvedValue({
      id: 'cmov0000001',
      tipo: TipoMovimiento.EGRESO,
      monto: dec(40000),
      concepto: 'Gaseosas',
      bolsilloId: EFECTIVO,
      bolsilloDestinoId: null,
      categoriaId: CATEGORIA,
      contraparteId: null,
      prestamoId: null,
      anuladoPor: { id: 'cmovanula001' },
      detalleServicios: [],
    })

    const res = await anularMovimiento(anulacion)

    expect(res.success).toBe(false)
    expect(res.error).toContain('ya fue anulado')
    expect(prismaMock.movimiento.create).not.toHaveBeenCalled()
  })

  it('exige un motivo', async () => {
    const res = await anularMovimiento({ movimientoId: 'cmov0000001', motivo: 'no' })

    expect(res.success).toBe(false)
    expect(prismaMock.movimiento.findUnique).not.toHaveBeenCalled()
  })

  it('falla si el movimiento no existe', async () => {
    prismaMock.movimiento.findUnique.mockResolvedValue(null)

    const res = await anularMovimiento(anulacion)

    expect(res.success).toBe(false)
    expect(res.error).toContain('no existe')
  })
})

// ---------------------------------------------------------------------------

describe('cerrarPeriodo', () => {
  function prepararPeriodo(opts: {
    saldoInicial: number
    movimientos: Array<{ tipo: TipoMovimiento; monto: number; destino?: string | null }>
    saldoFinalReal?: number | null
    justificacion?: string | null
    cerrado?: boolean
  }) {
    prismaMock.bolsillo.findMany.mockResolvedValue([{ id: EFECTIVO, nombre: 'EFECTIVO' }])

    // getResumenPeriodo consulta movimientos DOS veces: los del periodo y los
    // anteriores (para acumular el saldo inicial). Acá solo interesan los del
    // periodo, así que la consulta de anteriores devuelve vacío.
    prismaMock.movimiento.findMany.mockImplementation(async (args: any) => {
      if (args?.where?.periodo?.lt) return []
      return opts.movimientos.map((m) => ({
        tipo: m.tipo,
        monto: dec(m.monto),
        bolsilloId: EFECTIVO,
        bolsilloDestinoId: m.destino ?? null,
        categoria: { nombre: 'Papelería y oficina', grupo: GrupoCategoria.GASTO_OPERATIVO },
        detalleServicios: [],
      }))
    })

    // Igual con cierreMensual: una consulta trae el cierre del periodo y otra
    // las aperturas semilla. El saldo inicial de estos casos viene de la
    // semilla, para que el cálculo acumulado dé el mismo número de siempre.
    prismaMock.cierreMensual.findMany.mockImplementation(async (args: any) => {
      if (args?.where?.esAperturaInicial) {
        return [{ bolsilloId: EFECTIVO, saldoInicial: dec(opts.saldoInicial) }]
      }
      return [
        {
          id: 'ccie0000001',
          bolsilloId: EFECTIVO,
          saldoInicial: dec(opts.saldoInicial),
          saldoFinalReal: opts.saldoFinalReal === undefined ? null : dec(opts.saldoFinalReal!),
          justificacion: opts.justificacion ?? null,
          esAperturaInicial: false,
          cerrado: opts.cerrado ?? false,
          cerradoEn: null,
        },
      ]
    })
    prismaMock.$transaction.mockResolvedValue([])
  }

  it('no cierra con una diferencia sin justificar', async () => {
    prepararPeriodo({
      saldoInicial: 100000,
      movimientos: [{ tipo: TipoMovimiento.EGRESO, monto: 40000 }],
      saldoFinalReal: 55000, // calculado sería 60000
    })

    const res = await cerrarPeriodo({ periodo: '2026-08', bolsilloId: EFECTIVO })

    expect(res.success).toBe(false)
    expect(res.error).toContain('sin justificar')
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('cierra cuando la diferencia está justificada', async () => {
    prepararPeriodo({
      saldoInicial: 100000,
      movimientos: [{ tipo: TipoMovimiento.EGRESO, monto: 40000 }],
      saldoFinalReal: 55000,
      justificacion: 'Faltante de caja, revisado con Ivone',
    })

    const res = await cerrarPeriodo({ periodo: '2026-08', bolsilloId: EFECTIVO })

    expect(res.success).toBe(true)
    expect(prismaMock.$transaction).toHaveBeenCalled()
  })

  it('siembra la apertura del mes siguiente con el cierre de este', async () => {
    // Es la invariante apertura(mes N) == cierre(mes N-1), que en el Excel no
    // existía: ADMON cerró noviembre-2025 en 8.000.000 y abrió diciembre en
    // 6.067.340 sin dejar rastro.
    prepararPeriodo({
      saldoInicial: 100000,
      movimientos: [{ tipo: TipoMovimiento.EGRESO, monto: 40000 }],
    })

    const res = await cerrarPeriodo({ periodo: '2026-08', bolsilloId: EFECTIVO })

    expect(res.success).toBe(true)

    const [operaciones] = prismaMock.$transaction.mock.calls[0] as [unknown[]]
    expect(operaciones).toHaveLength(2)

    // La segunda operación es el upsert de la apertura de 2026-09 en 60000.
    expect(prismaMock.cierreMensual.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { periodo_bolsilloId: { periodo: '2026-09', bolsilloId: EFECTIVO } },
        update: { saldoInicial: 60000 },
      })
    )
  })

  it('cruza el cambio de año al sembrar la apertura', async () => {
    prepararPeriodo({ saldoInicial: 500000, movimientos: [] })

    await cerrarPeriodo({ periodo: '2026-12', bolsilloId: EFECTIVO })

    expect(prismaMock.cierreMensual.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { periodo_bolsilloId: { periodo: '2027-01', bolsilloId: EFECTIVO } },
      })
    )
  })

  it('no cierra dos veces el mismo periodo', async () => {
    prepararPeriodo({ saldoInicial: 100000, movimientos: [], cerrado: true })

    const res = await cerrarPeriodo({ periodo: '2026-08', bolsilloId: EFECTIVO })

    expect(res.success).toBe(false)
    expect(res.error).toContain('ya estaba cerrado')
  })
})

// ---------------------------------------------------------------------------

describe('registrarPataServicio', () => {
  const CATEGORIA_MENSAJERIA = 'ccatmensajeria'
  const CLIENTE = 'ccontraaa0001'
  const PROVEEDOR = 'ccontrafawer1'

  function servicioMock(overrides: Record<string, unknown> = {}) {
    return {
      id: 'cserv0000001',
      valorFacturado: dec(520000),
      valorEntregado: dec(520000),
      clienteId: CLIENTE,
      proveedorId: PROVEEDOR,
      movimientoIngresoId: null,
      movimientoEgresoId: null,
      tipoServicio: { nombre: 'Mensajería', categoriaId: CATEGORIA_MENSAJERIA },
      ...overrides,
    }
  }

  beforeEach(() => {
    prismaMock.$transaction.mockImplementation(async (fn: unknown) =>
      typeof fn === 'function'
        ? (fn as (tx: unknown) => Promise<unknown>)(prismaMock)
        : fn
    )
    prismaMock.servicioReferenciado.update.mockResolvedValue({})
  })

  it('toma la categoría del tipo de servicio y NO la adivina por nombre', async () => {
    // El nombre del tipo ("Mensajería") no coincide con el de la categoría
    // ("Servicio de mensajería"). Antes eso caía en un fallback que elegía la
    // primera del grupo y categorizaba mal sin avisar.
    prismaMock.servicioReferenciado.findUnique.mockResolvedValue(servicioMock())
    prismaMock.movimiento.create.mockResolvedValue(filaMovimiento())

    const res = await registrarPataServicio({
      servicioId: 'cserv0000001',
      pata: 'INGRESO',
      fecha: '2026-08-27',
      bolsilloId: EFECTIVO,
    })

    expect(res.success).toBe(true)
    expect(prismaMock.movimiento.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ categoriaId: CATEGORIA_MENSAJERIA }),
      })
    )
    // Y ya no consulta el catálogo de categorías para resolverla.
    expect(prismaMock.categoriaMovimiento.findFirst).not.toHaveBeenCalled()
  })

  it('el cobro entra como INGRESO por el valor facturado, contra el cliente', async () => {
    prismaMock.servicioReferenciado.findUnique.mockResolvedValue(servicioMock())
    prismaMock.movimiento.create.mockResolvedValue(filaMovimiento())

    await registrarPataServicio({
      servicioId: 'cserv0000001',
      pata: 'INGRESO',
      fecha: '2026-08-27',
      bolsilloId: EFECTIVO,
    })

    expect(prismaMock.movimiento.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tipo: TipoMovimiento.INGRESO,
          monto: 520000,
          contraparteId: CLIENTE,
        }),
      })
    )
  })

  it('la entrega sale como EGRESO por el valor entregado, contra el proveedor', async () => {
    prismaMock.servicioReferenciado.findUnique.mockResolvedValue(
      servicioMock({ valorFacturado: dec(45000), valorEntregado: dec(30000) })
    )
    prismaMock.movimiento.create.mockResolvedValue(filaMovimiento())

    await registrarPataServicio({
      servicioId: 'cserv0000001',
      pata: 'EGRESO',
      fecha: '2026-08-27',
      bolsilloId: EFECTIVO,
    })

    // 30.000 al consultorio, no los 45.000 que se le cobraron al paciente.
    expect(prismaMock.movimiento.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tipo: TipoMovimiento.EGRESO,
          monto: 30000,
          contraparteId: PROVEEDOR,
        }),
      })
    )
  })

  it('no deja registrar dos veces la misma pata', async () => {
    prismaMock.servicioReferenciado.findUnique.mockResolvedValue(
      servicioMock({ movimientoIngresoId: 'cmov0000009' })
    )

    const res = await registrarPataServicio({
      servicioId: 'cserv0000001',
      pata: 'INGRESO',
      fecha: '2026-08-27',
      bolsilloId: EFECTIVO,
    })

    expect(res.success).toBe(false)
    expect(res.error).toContain('ya está registrado')
    expect(prismaMock.movimiento.create).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------

describe('createCategoria', () => {
  beforeEach(() => {
    prismaMock.categoriaMovimiento.findFirst.mockResolvedValue(null)
  })

  it('crea la categoría con su grupo', async () => {
    prismaMock.categoriaMovimiento.create.mockResolvedValue({
      id: 'ccatnueva0001',
      nombre: 'Fumigación',
      grupo: GrupoCategoria.GASTO_OPERATIVO,
      isActive: true,
    })

    const res = await createCategoria({
      nombre: 'Fumigación',
      grupo: GrupoCategoria.GASTO_OPERATIVO,
    })

    expect(res.success).toBe(true)
    expect(prismaMock.categoriaMovimiento.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { nombre: 'Fumigación', grupo: GrupoCategoria.GASTO_OPERATIVO },
      })
    )
  })

  it('recorta los espacios del nombre', async () => {
    prismaMock.categoriaMovimiento.create.mockResolvedValue({
      id: 'c1', nombre: 'Fumigación', grupo: GrupoCategoria.GASTO_OPERATIVO, isActive: true,
    })

    await createCategoria({
      nombre: '  Fumigación  ',
      grupo: GrupoCategoria.GASTO_OPERATIVO,
    })

    expect(prismaMock.categoriaMovimiento.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ nombre: 'Fumigación' }) })
    )
  })

  it('NO duplica cuando ya existe con otras mayúsculas', async () => {
    // "PAPELERIA" y "Papelería" partirían el total en dos y nadie lo notaría.
    // Se devuelve la existente para que el operador la use, en vez de un error
    // que lo empuje a inventar una variante para esquivarlo.
    const existente = {
      id: 'ccatpapeleria',
      nombre: 'Papelería y oficina',
      grupo: GrupoCategoria.GASTO_OPERATIVO,
      isActive: true,
    }
    prismaMock.categoriaMovimiento.findFirst.mockResolvedValue(existente)

    const res = await createCategoria({
      nombre: 'PAPELERÍA Y OFICINA',
      grupo: GrupoCategoria.GASTO_BIENESTAR,
    })

    expect(res.success).toBe(true)
    expect(res.data).toEqual(existente)
    expect(res.message).toContain('ya existía')
    expect(prismaMock.categoriaMovimiento.create).not.toHaveBeenCalled()

    // La búsqueda tiene que ser insensible a mayúsculas o el dedup no sirve.
    expect(prismaMock.categoriaMovimiento.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { nombre: { equals: 'PAPELERÍA Y OFICINA', mode: 'insensitive' } },
      })
    )
  })

  it('rechaza un nombre demasiado corto', async () => {
    const res = await createCategoria({
      nombre: 'x',
      grupo: GrupoCategoria.OTRO,
    })

    expect(res.success).toBe(false)
    expect(prismaMock.categoriaMovimiento.create).not.toHaveBeenCalled()
  })

  it('exige acceso a Control', async () => {
    hasControlAccessMock.mockResolvedValue(false)

    const res = await createCategoria({
      nombre: 'Fumigación',
      grupo: GrupoCategoria.GASTO_OPERATIVO,
    })

    expect(res.success).toBe(false)
    expect(prismaMock.categoriaMovimiento.create).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------

describe('catálogo de bolsillos', () => {
  beforeEach(() => {
    prismaMock.bolsillo.findFirst.mockResolvedValue(null)
  })

  it('crea un bolsillo', async () => {
    prismaMock.bolsillo.create.mockResolvedValue({
      id: 'cbolnuevo0001',
      nombre: 'DAVIVIENDA',
      tipo: TipoBolsillo.BANCARIA,
      orden: 6,
      isActive: true,
      cerradoEn: null,
    })

    const res = await createBolsillo({
      nombre: 'DAVIVIENDA',
      tipo: TipoBolsillo.BANCARIA,
      orden: 6,
    })

    expect(res.success).toBe(true)
    expect(prismaMock.bolsillo.create).toHaveBeenCalled()
  })

  it('NO deja crear un bolsillo con nombre repetido en otra caja', async () => {
    // "efectivo" y "EFECTIVO" como dos bolsillos separados partirían el saldo
    // en dos y ningún cierre volvería a cuadrar.
    prismaMock.bolsillo.findFirst.mockResolvedValue({ nombre: 'EFECTIVO' })

    const res = await createBolsillo({
      nombre: 'efectivo',
      tipo: TipoBolsillo.EFECTIVO,
      orden: 0,
    })

    expect(res.success).toBe(false)
    expect(res.error).toContain('Ya existe')
    expect(prismaMock.bolsillo.create).not.toHaveBeenCalled()
    expect(prismaMock.bolsillo.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { nombre: { equals: 'efectivo', mode: 'insensitive' } },
      })
    )
  })

  it('cerrar un bolsillo lo desactiva y le pone fecha, sin borrarlo', async () => {
    prismaMock.bolsillo.update.mockResolvedValue({})

    const res = await setBolsilloActivo({ id: 'cbolefectivo1', isActive: false })

    expect(res.success).toBe(true)
    const [args] = prismaMock.bolsillo.update.mock.calls[0]
    expect(args.where).toEqual({ id: 'cbolefectivo1' })
    expect(args.data.isActive).toBe(false)
    expect(args.data.cerradoEn).toBeInstanceOf(Date)
  })

  it('reabrir limpia la fecha de cierre', async () => {
    prismaMock.bolsillo.update.mockResolvedValue({})

    await setBolsilloActivo({ id: 'cbolefectivo1', isActive: true })

    const [args] = prismaMock.bolsillo.update.mock.calls[0]
    expect(args.data).toEqual({ isActive: true, cerradoEn: null })
  })

  it('exige acceso a Control', async () => {
    hasControlAccessMock.mockResolvedValue(false)

    const res = await setBolsilloActivo({ id: 'cbolefectivo1', isActive: false })

    expect(res.success).toBe(false)
    expect(prismaMock.bolsillo.update).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------

describe('getResumenPeriodo — saldo inicial acumulado', () => {
  /**
   * Prepara los cinco findMany que hace la action, discriminando por el `where`
   * porque movimiento y cierreMensual se consultan dos veces cada uno.
   */
  function prepararBase(opts: {
    semilla?: number
    previos?: number[]
    delPeriodo?: number[]
    cierreDelPeriodo?: Record<string, unknown> | null
  }) {
    prismaMock.bolsillo.findMany.mockResolvedValue([{ id: EFECTIVO, nombre: 'EFECTIVO' }])

    prismaMock.movimiento.findMany.mockImplementation(async (args: any) => {
      const montos = args?.where?.periodo?.lt ? (opts.previos ?? []) : (opts.delPeriodo ?? [])
      return montos.map((monto) => ({
        tipo: TipoMovimiento.EGRESO,
        monto: dec(monto),
        bolsilloId: EFECTIVO,
        bolsilloDestinoId: null,
        categoria: { nombre: 'Papelería y oficina', grupo: GrupoCategoria.GASTO_OPERATIVO },
        detalleServicios: [],
      }))
    })

    prismaMock.cierreMensual.findMany.mockImplementation(async (args: any) => {
      if (args?.where?.esAperturaInicial) {
        return opts.semilla === undefined
          ? []
          : [{ bolsilloId: EFECTIVO, saldoInicial: dec(opts.semilla) }]
      }
      return opts.cierreDelPeriodo ? [opts.cierreDelPeriodo] : []
    })
  }

  it('acumula desde la semilla cuando el mes anterior nunca se cerró', async () => {
    // ESTE es el bug que se corrigió: sin acumular, un mes al que no se le
    // cerró el anterior arrancaba en cero y todos los saldos daban negativo.
    prepararBase({ semilla: 344_000, previos: [100_000, 44_000], delPeriodo: [50_000] })

    const res = await getResumenPeriodo('2026-08')
    const efectivo = res.data!.cierres[0]

    expect(efectivo.saldoInicial).toBe(200_000) // 344.000 − 144.000
    expect(efectivo.saldoFinalCalculado).toBe(150_000) // − 50.000
  })

  it('sin semilla ni movimientos previos, arranca en cero', async () => {
    prepararBase({ previos: [], delPeriodo: [30_000] })

    const res = await getResumenPeriodo('2026-01')

    expect(res.data!.cierres[0].saldoInicial).toBe(0)
    expect(res.data!.cierres[0].saldoFinalCalculado).toBe(-30_000)
  })

  it('respeta el saldo declarado de un periodo YA CERRADO', async () => {
    // Un cierre formal es una verdad declarada y le gana al acumulado.
    prepararBase({
      semilla: 344_000,
      previos: [999_999],
      delPeriodo: [],
      cierreDelPeriodo: {
        id: 'ccie1',
        bolsilloId: EFECTIVO,
        saldoInicial: dec(777_000),
        saldoFinalReal: null,
        justificacion: null,
        esAperturaInicial: false,
        cerrado: true,
        cerradoEn: new Date(),
      },
    })

    const res = await getResumenPeriodo('2026-08')

    expect(res.data!.cierres[0].saldoInicial).toBe(777_000)
  })

  it('IGNORA el saldo de un cierre que existe pero está abierto', async () => {
    // Una fila creada al vuelo (por un conteo, por ejemplo) no es una verdad
    // declarada: si su saldoInicial ganara, volvería el bug.
    prepararBase({
      semilla: 500_000,
      previos: [100_000],
      delPeriodo: [],
      cierreDelPeriodo: {
        id: 'ccie2',
        bolsilloId: EFECTIVO,
        saldoInicial: dec(0),
        saldoFinalReal: null,
        justificacion: null,
        esAperturaInicial: false,
        cerrado: false,
        cerradoEn: null,
      },
    })

    const res = await getResumenPeriodo('2026-08')

    expect(res.data!.cierres[0].saldoInicial).toBe(400_000)
  })
})

// ---------------------------------------------------------------------------

describe('getMovimientos — paginación, filtros y totales', () => {
  beforeEach(() => {
    prismaMock.movimiento.findMany.mockResolvedValue([filaMovimiento()])
    prismaMock.movimiento.count.mockResolvedValue(137)
    prismaMock.movimiento.aggregate.mockResolvedValue({ _sum: { monto: dec(9_500_000) } })
  })

  it('pagina desde 1 y calcula el total de páginas', async () => {
    const res = await getMovimientos({ periodo: '2026-06', pageSize: 25 })

    expect(res.data).toMatchObject({ page: 1, pageSize: 25, totalCount: 137, totalPages: 6 })
    expect(prismaMock.movimiento.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 25 })
    )
  })

  it('salta los registros correctos en una página posterior', async () => {
    await getMovimientos({ periodo: '2026-06', page: 3, pageSize: 25 })

    expect(prismaMock.movimiento.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 50, take: 25 })
    )
  })

  it('acota el tamaño de página para que nadie pida 10.000 de una', async () => {
    await getMovimientos({ periodo: '2026-06', pageSize: 10_000 })

    expect(prismaMock.movimiento.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 200 })
    )
  })

  it('trata una página menor a 1 como la primera', async () => {
    const res = await getMovimientos({ periodo: '2026-06', page: -5 })

    expect(res.data!.page).toBe(1)
    expect(prismaMock.movimiento.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0 })
    )
  })

  it('la suma es la de TODO lo filtrado, no la de la página', async () => {
    // Si el total cambiara al pasar de página, nadie volvería a confiar en él.
    const res = await getMovimientos({ periodo: '2026-06' })

    expect(res.data!.sumaFiltrada).toBe(9_500_000)
    expect(res.data!.sumaPagina).toBe(40_000) // la única fila de la página
  })

  it('filtrar por bolsillo mira los DOS extremos de un traslado', async () => {
    // Un traslado toca dos bolsillos; mirando solo el origen, desaparecería de
    // la vista del bolsillo destino.
    await getMovimientos({ periodo: '2026-06', bolsilloId: EFECTIVO })

    const [args] = prismaMock.movimiento.findMany.mock.calls[0] as [any]
    expect(args.where.OR).toEqual([
      { bolsilloId: EFECTIVO },
      { bolsilloDestinoId: EFECTIVO },
    ])
  })

  it('busca en concepto y en notas, sin distinguir mayúsculas', async () => {
    await getMovimientos({ periodo: '2026-06', buscar: 'burbuja' })

    const [args] = prismaMock.movimiento.findMany.mock.calls[0] as [any]
    expect(args.where.AND[0].OR).toEqual([
      { concepto: { contains: 'burbuja', mode: 'insensitive' } },
      { notas: { contains: 'burbuja', mode: 'insensitive' } },
    ])
  })

  it('ignora una búsqueda que son solo espacios', async () => {
    await getMovimientos({ periodo: '2026-06', buscar: '   ' })

    const [args] = prismaMock.movimiento.findMany.mock.calls[0] as [any]
    expect(args.where.AND).toBeUndefined()
  })

  it('exige acceso a Control', async () => {
    hasControlAccessMock.mockResolvedValue(false)

    const res = await getMovimientos({ periodo: '2026-06' })

    expect(res.success).toBe(false)
    expect(prismaMock.movimiento.findMany).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------

describe('cotizaciones de Alegra como ingresos', () => {
  const COT = (id: string, numero: number, total: number, date = '2026-08-15') => ({
    id,
    number: numero,
    date,
    client: { name: 'A&A MODA CIRCULAR SAS' },
    total,
  })

  beforeEach(() => {
    alegraMock.mockResolvedValue({ items: [], truncated: false })
    prismaMock.movimiento.findMany.mockResolvedValue([])
    prismaMock.bolsillo.findFirst.mockResolvedValue({ id: 'cbolivone0001' })
    prismaMock.categoriaMovimiento.findFirst.mockResolvedValue({ id: 'ccatcobro0001' })
    prismaMock.movimiento.create.mockResolvedValue(filaMovimiento())
  })

  it('pide a Alegra el rango completo del mes', async () => {
    await getCotizacionesDelPeriodo('2026-02')

    // Febrero 2026 tiene 28 días. Un rango mal armado se come el último día.
    expect(alegraMock).toHaveBeenCalledWith({
      dateFrom: '2026-02-01',
      dateTo: '2026-02-28',
    })
  })

  it('marca como registrada la que ya tiene un movimiento', async () => {
    // Alegra NO sabe si se cobró: la única verdad es que exista el movimiento.
    alegraMock.mockResolvedValue({
      items: [COT('e1', 10, 100_000), COT('e2', 11, 250_000)],
      truncated: false,
    })
    prismaMock.movimiento.findMany.mockResolvedValue([
      { id: 'cmovya0001', alegraEstimateId: 'e1' },
    ])

    const res = await getCotizacionesDelPeriodo('2026-08')

    expect(res.data!.cotizaciones[0]).toMatchObject({
      estimateId: 'e1',
      yaRegistrada: true,
      movimientoId: 'cmovya0001',
    })
    expect(res.data!.cotizaciones[1].yaRegistrada).toBe(false)
    expect(res.data!.totalCotizado).toBe(350_000)
    expect(res.data!.totalPendiente).toBe(250_000)
    expect(res.data!.cantidadPendiente).toBe(1)
  })

  it('propaga el aviso de búsqueda incompleta', async () => {
    // Un total que miente por lo bajo es peor que no mostrarlo.
    alegraMock.mockResolvedValue({ items: [], truncated: true })

    const res = await getCotizacionesDelPeriodo('2026-01')

    expect(res.data!.posiblementeIncompleto).toBe(true)
  })

  it('devuelve un error legible si Alegra se cae', async () => {
    alegraMock.mockRejectedValue(new Error('ECONNRESET'))

    const res = await getCotizacionesDelPeriodo('2026-08')

    expect(res.success).toBe(false)
    expect(res.error).toContain('Alegra')
  })

  it('registra el ingreso en IVONE con la fecha de la cotización', async () => {
    alegraMock.mockResolvedValue({
      items: [COT('e1', 10, 520_000, '2026-08-15')],
      truncated: false,
    })

    const res = await importarCotizacionesComoIngresos({
      periodo: '2026-08',
      estimateIds: ['e1'],
    })

    expect(res.success).toBe(true)
    expect(prismaMock.movimiento.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tipo: TipoMovimiento.INGRESO,
          monto: 520_000,
          bolsilloId: 'cbolivone0001',
          periodo: '2026-08',
          fecha: new Date('2026-08-15T00:00:00.000Z'),
          alegraEstimateId: 'e1',
        }),
      })
    )
  })

  it('NO vuelve a registrar una cotización ya registrada', async () => {
    alegraMock.mockResolvedValue({ items: [COT('e1', 10, 520_000)], truncated: false })
    prismaMock.movimiento.findMany.mockResolvedValue([
      { id: 'cmovya0001', alegraEstimateId: 'e1' },
    ])

    const res = await importarCotizacionesComoIngresos({
      periodo: '2026-08',
      estimateIds: ['e1'],
    })

    expect(res.data!.creados).toBe(0)
    expect(prismaMock.movimiento.create).not.toHaveBeenCalled()
  })

  it('no registra nada en un periodo cerrado', async () => {
    alegraMock.mockResolvedValue({ items: [COT('e1', 10, 520_000)], truncated: false })
    prismaMock.cierreMensual.findUnique.mockResolvedValue({ cerrado: true })

    const res = await importarCotizacionesComoIngresos({
      periodo: '2026-08',
      estimateIds: ['e1'],
    })

    expect(res.data!.creados).toBe(0)
    expect(prismaMock.movimiento.create).not.toHaveBeenCalled()
  })

  it('rechaza si no existe el bolsillo IVONE', async () => {
    prismaMock.bolsillo.findFirst.mockResolvedValue(null)

    const res = await importarCotizacionesComoIngresos({
      periodo: '2026-08',
      estimateIds: ['e1'],
    })

    expect(res.success).toBe(false)
    expect(res.error).toContain('IVONE')
  })

  it('exige acceso a Control', async () => {
    hasControlAccessMock.mockResolvedValue(false)

    expect((await getCotizacionesDelPeriodo('2026-08')).success).toBe(false)
    expect((await importarCotizacionesComoIngresos({ periodo: '2026-08', estimateIds: ['e1'] })).success).toBe(false)
    expect(alegraMock).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------

describe('facturas de venta como ingresos ("por arriba")', () => {
  const FAC = (id: string, total: number, pagado: number) => ({
    id,
    date: '2026-08-15',
    status: pagado >= total ? 'closed' : 'open',
    client: { name: 'Cliente SAS' },
    numberTemplate: { fullNumber: `FE-${id}` },
    total,
    totalPaid: pagado,
    balance: total - pagado,
  })

  beforeEach(() => {
    facturasMock.mockResolvedValue({ data: [], total: 0 })
    prismaMock.movimiento.findMany.mockResolvedValue([])
    prismaMock.bolsillo.findUnique.mockResolvedValue({ id: 'cbolivone0001', nombre: 'IVONE' })
    prismaMock.categoriaMovimiento.findFirst.mockResolvedValue({ id: 'ccatfactura01' })
    prismaMock.movimiento.create.mockResolvedValue(filaMovimiento())
  })

  it('deja que Alegra filtre el rango: no recorre páginas por fecha', async () => {
    // /invoices SÍ acepta date_after/date_before, así que no hace falta el
    // walk ni sufrir su paginación inestable.
    await getFacturasDelPeriodo('2026-02')

    expect(facturasMock).toHaveBeenCalledWith(
      expect.objectContaining({ date_after: '2026-02-01', date_before: '2026-02-28' })
    )
  })

  it('respeta el tope de 30 de Alegra y pagina', async () => {
    // Pedir más no devuelve más: devuelve Bad Request.
    facturasMock.mockResolvedValueOnce({
      data: Array.from({ length: 30 }, (_, i) => FAC(String(i), 1000, 1000)),
      total: 45,
    })
    facturasMock.mockResolvedValueOnce({ data: [FAC('99', 1000, 1000)], total: 45 })

    const res = await getFacturasDelPeriodo('2026-08')

    expect(facturasMock).toHaveBeenCalledWith(expect.objectContaining({ limit: 30, start: 0 }))
    expect(facturasMock).toHaveBeenCalledWith(expect.objectContaining({ limit: 30, start: 30 }))
    expect(res.data!.facturas).toHaveLength(31)
  })

  it('separa lo facturado de lo cobrado', async () => {
    facturasMock.mockResolvedValueOnce({
      data: [FAC('1', 1_000_000, 400_000), FAC('2', 500_000, 500_000)],
      total: 2,
    })

    const res = await getFacturasDelPeriodo('2026-08')

    expect(res.data!.totalFacturado).toBe(1_500_000)
    expect(res.data!.totalCobrado).toBe(900_000)
  })

  it('registra el ingreso por lo COBRADO, no por lo facturado', async () => {
    // Una factura a medio pagar solo metió en caja lo que se pagó.
    facturasMock.mockResolvedValueOnce({ data: [FAC('1', 1_000_000, 400_000)], total: 1 })

    await importarFacturasComoIngresos({
      periodo: '2026-08',
      invoiceIds: ['1'],
      bolsilloId: 'cbolivone0001',
    })

    expect(prismaMock.movimiento.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tipo: TipoMovimiento.INGRESO,
          monto: 400_000,
          alegraInvoiceId: '1',
        }),
      })
    )
  })

  it('NO registra una factura que no cobró nada', async () => {
    // Existe el documento, pero no movió plata en ninguna caja.
    facturasMock.mockResolvedValueOnce({ data: [FAC('1', 1_000_000, 0)], total: 1 })

    const res = await importarFacturasComoIngresos({
      periodo: '2026-08',
      invoiceIds: ['1'],
      bolsilloId: 'cbolivone0001',
    })

    expect(res.data!.creados).toBe(0)
    expect(prismaMock.movimiento.create).not.toHaveBeenCalled()
  })

  it('exige el bolsillo: acá no se asume IVONE', async () => {
    const res = await importarFacturasComoIngresos({
      periodo: '2026-08',
      invoiceIds: ['1'],
      bolsilloId: '',
    })

    expect(res.success).toBe(false)
    expect(res.error).toContain('bolsillo')
  })

  it('usa la categoría del grupo COBRO_FACTURA, no la de cotizaciones', async () => {
    facturasMock.mockResolvedValueOnce({ data: [FAC('1', 100, 100)], total: 1 })

    await importarFacturasComoIngresos({
      periodo: '2026-08',
      invoiceIds: ['1'],
      bolsilloId: 'cbolivone0001',
    })

    expect(prismaMock.categoriaMovimiento.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ grupo: GrupoCategoria.COBRO_FACTURA }),
      })
    )
  })

  it('exige acceso a Control', async () => {
    hasControlAccessMock.mockResolvedValue(false)

    expect((await getFacturasDelPeriodo('2026-08')).success).toBe(false)
    expect(facturasMock).not.toHaveBeenCalled()
  })
})


// ---------------------------------------------------------------------------

describe('sincronizarServiciosAlegra', () => {
  /** Un item de /items tal como llega, con lo mínimo que mira la action. */
  function item(over: Record<string, unknown> = {}) {
    return {
      id: '3',
      name: 'Independiente 03',
      description: 'Afilicion de Eps y Pension',
      reference: '05',
      status: 'active',
      type: 'service',
      ...over,
    }
  }

  /** El catálogo entero en una página: menos de 30 corta el bucle. */
  function unaPagina(items: unknown[]) {
    itemsMock.mockResolvedValue({ data: items, total: items.length })
  }

  beforeEach(() => {
    prismaMock.servicioAlegra.findMany.mockResolvedValue([])
    prismaMock.servicioAlegra.create.mockResolvedValue({})
    prismaMock.servicioAlegra.update.mockResolvedValue({})
    prismaMock.servicioAlegra.updateMany.mockResolvedValue({ count: 0 })
  })

  it('exige acceso a Control', async () => {
    hasControlAccessMock.mockResolvedValue(false)

    const res = await sincronizarServiciosAlegra()

    expect(res.success).toBe(false)
    expect(itemsMock).not.toHaveBeenCalled()
  })

  it('descarta lo que no es servicio', async () => {
    // La cuenta tiene productos que no son de este negocio y no tienen nada
    // que hacer en un catálogo de servicios cobrados.
    unaPagina([item(), item({ id: '25', name: 'CONCOLOR LATEX GRIS', type: 'product' })])

    const res = await sincronizarServiciosAlegra()

    expect(res.success).toBe(true)
    expect(res.data?.creados).toBe(1)
    expect(res.data?.descartados).toBe(1)
    expect(prismaMock.servicioAlegra.create).toHaveBeenCalledTimes(1)
  })

  it('marca "Recaudo para Terceros" como plata en tránsito al crearlo', async () => {
    unaPagina([item({ id: '4', name: 'Recaudo para Terceros', reference: '02' })])

    await sincronizarServiciosAlegra()

    expect(prismaMock.servicioAlegra.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ alegraItemId: '4', enTransito: true }),
      })
    )
  })

  it('no marca en tránsito a los demás servicios', async () => {
    unaPagina([item()])

    await sincronizarServiciosAlegra()

    expect(prismaMock.servicioAlegra.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ enTransito: false }) })
    )
  })

  it('NO pisa enTransito de un servicio que ya existe', async () => {
    // Es una decisión del negocio, no un dato de Alegra: si alguien lo cambió
    // desde la pantalla, la sincronización siguiente tiene que respetarlo.
    prismaMock.servicioAlegra.findMany.mockResolvedValue([
      { id: 'csrvalegra01', alegraItemId: '4', isActive: true },
    ])
    unaPagina([item({ id: '4', name: 'Recaudo para Terceros', reference: '02' })])

    await sincronizarServiciosAlegra()

    expect(prismaMock.servicioAlegra.create).not.toHaveBeenCalled()
    const [args] = prismaMock.servicioAlegra.update.mock.calls[0] as [
      { data: Record<string, unknown> },
    ]
    expect(args.data).not.toHaveProperty('enTransito')
  })

  it('desactiva lo que ya no está en Alegra, sin borrarlo', async () => {
    prismaMock.servicioAlegra.findMany.mockResolvedValue([
      { id: 'cviejo0000001', alegraItemId: '99', isActive: true },
    ])
    unaPagina([item()])

    const res = await sincronizarServiciosAlegra()

    expect(res.data?.desactivados).toBe(1)
    expect(prismaMock.servicioAlegra.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['cviejo0000001'] } },
      data: { isActive: false },
    })
  })

  it('no cuenta como desactivado lo que ya estaba apagado', async () => {
    prismaMock.servicioAlegra.findMany.mockResolvedValue([
      { id: 'cviejo0000001', alegraItemId: '99', isActive: false },
    ])
    unaPagina([item()])

    const res = await sincronizarServiciosAlegra()

    expect(res.data?.desactivados).toBe(0)
    expect(prismaMock.servicioAlegra.updateMany).not.toHaveBeenCalled()
  })

  it('no toca el catálogo si Alegra no devuelve ningún servicio', async () => {
    // Sin esta guarda, una respuesta vacía o degradada apagaría todo de un saque.
    prismaMock.servicioAlegra.findMany.mockResolvedValue([
      { id: 'csrvalegra01', alegraItemId: '3', isActive: true },
    ])
    unaPagina([])

    const res = await sincronizarServiciosAlegra()

    expect(res.success).toBe(false)
    expect(prismaMock.servicioAlegra.updateMany).not.toHaveBeenCalled()
    expect(prismaMock.servicioAlegra.update).not.toHaveBeenCalled()
  })

  it('pagina: una página llena obliga a pedir la siguiente', async () => {
    const llena = Array.from({ length: 30 }, (_, i) => item({ id: String(i + 1) }))
    itemsMock
      .mockResolvedValueOnce({ data: llena, total: 31 })
      .mockResolvedValueOnce({ data: [item({ id: '31' })], total: 31 })

    const res = await sincronizarServiciosAlegra()

    expect(itemsMock).toHaveBeenCalledTimes(2)
    expect(itemsMock).toHaveBeenNthCalledWith(2, { start: 30, limit: 30 })
    expect(res.data?.creados).toBe(31)
  })

  it('si Alegra falla, avisa y no escribe nada', async () => {
    itemsMock.mockRejectedValue(new Error('502'))

    const res = await sincronizarServiciosAlegra()

    expect(res.success).toBe(false)
    expect(res.error).toContain('Alegra')
    expect(prismaMock.servicioAlegra.create).not.toHaveBeenCalled()
    expect(prismaMock.servicioAlegra.updateMany).not.toHaveBeenCalled()
  })
})


// ---------------------------------------------------------------------------

describe('desglose por servicio de Alegra', () => {
  /**
   * Los dos ítems de una factura real (FEAD10134). El nombre no importa acá:
   * el emparejamiento con el catálogo local es por `id`.
   */
  const ITEMS_FACTURA = [
    { id: '2', price: 63025, quantity: 2, discount: 0, tax: [{ percentage: 19 }] },
    { id: '4', price: 429600, quantity: 1, discount: 0 },
    { id: '4', price: 149400, quantity: 1, discount: 0 },
  ]

  const FACTURA = (
    id: string,
    numero: string,
    total: number,
    pagado: number,
    date = '2026-08-26'
  ) => ({
    id,
    date,
    status: pagado >= total ? 'closed' : 'open',
    client: { name: 'Cliente SAS' },
    numberTemplate: { fullNumber: numero },
    total,
    totalPaid: pagado,
    balance: total - pagado,
  })

  const COT = (id: string, numero: number, total: number, date = '2026-08-21') => ({
    id,
    number: numero,
    date,
    client: { name: 'Cliente SAS' },
    total,
  })

  /** El catálogo local ya sincronizado, con los dos servicios. */
  function catalogoCompleto() {
    prismaMock.servicioAlegra.findMany.mockResolvedValue([
      { id: 'csrvadmin001', alegraItemId: '2' },
      { id: 'csrvrecaudo1', alegraItemId: '4' },
    ])
  }

  beforeEach(() => {
    prismaMock.bolsillo.findUnique.mockResolvedValue({ id: 'cbolivone0001', nombre: 'IVONE' })
    prismaMock.categoriaMovimiento.findFirst.mockResolvedValue({ id: 'ccatcobro0001' })
    prismaMock.movimiento.findMany.mockResolvedValue([])
    prismaMock.movimiento.create.mockResolvedValue(filaMovimiento())
    catalogoCompleto()
  })

  /** El desglose que quedó en el `create` del movimiento. */
  function desgloseGuardado() {
    const [args] = prismaMock.movimiento.create.mock.calls[0] as [
      { data: { detalleServicios?: { create: Array<{ servicioAlegraId: string; monto: number }> } } },
    ]
    return args.data.detalleServicios?.create
  }

  it('guarda una fila por servicio, con el IVA en la línea que lo generó', async () => {
    facturasMock.mockResolvedValue({
      data: [FACTURA('i1', 'FE1', 729_000, 729_000, '2026-08-26')],
      total: 1,
    })
    invoiceDetalleMock.mockResolvedValue({ items: ITEMS_FACTURA })

    const res = await importarFacturasComoIngresos({
      periodo: '2026-08',
      invoiceIds: ['i1'],
      bolsilloId: 'cbolivone0001',
    })

    expect(res.success).toBe(true)
    const desglose = desgloseGuardado()!
    expect(desglose).toHaveLength(2)
    const porServicio = Object.fromEntries(
      desglose.map((d) => [d.servicioAlegraId, d.monto])
    )
    expect(Math.abs(porServicio['csrvadmin001']! - 150_000)).toBeLessThan(1)
    expect(Math.abs(porServicio['csrvrecaudo1']! - 579_000)).toBeLessThan(1)
  })

  it('el desglose suma exactamente el monto del movimiento', async () => {
    facturasMock.mockResolvedValue({
      data: [FACTURA('i1', 'FE1', 729_000, 729_000, '2026-08-26')],
      total: 1,
    })
    invoiceDetalleMock.mockResolvedValue({ items: ITEMS_FACTURA })

    await importarFacturasComoIngresos({
      periodo: '2026-08',
      invoiceIds: ['i1'],
      bolsilloId: 'cbolivone0001',
    })

    const total = desgloseGuardado()!.reduce((a, d) => a + d.monto, 0)
    expect(Math.round(total * 100) / 100).toBe(729_000)
  })

  it('reparte sobre lo COBRADO, no sobre lo facturado', async () => {
    // Una factura a medio pagar metió en caja solo una parte; el desglose
    // tiene que hablar de esa parte, no del documento entero.
    facturasMock.mockResolvedValue({
      data: [FACTURA('i1', 'FE1', 729_000, 364_500, '2026-08-26')],
      total: 1,
    })
    invoiceDetalleMock.mockResolvedValue({ items: ITEMS_FACTURA })

    await importarFacturasComoIngresos({
      periodo: '2026-08',
      invoiceIds: ['i1'],
      bolsilloId: 'cbolivone0001',
    })

    const total = desgloseGuardado()!.reduce((a, d) => a + d.monto, 0)
    expect(Math.round(total * 100) / 100).toBe(364_500)
  })

  it('NO guarda un desglose parcial si falta un servicio en el catálogo', async () => {
    // Es la regla central: el reparto es a prorrata, así que un desglose al
    // que le falta una línea seguiría sumando el monto del movimiento y le
    // adjudicaría a los servicios conocidos una plata que entró por otro.
    prismaMock.servicioAlegra.findMany.mockResolvedValue([
      { id: 'csrvadmin001', alegraItemId: '2' }, // falta el '4'
    ])
    facturasMock.mockResolvedValue({
      data: [FACTURA('i1', 'FE1', 729_000, 729_000, '2026-08-26')],
      total: 1,
    })
    invoiceDetalleMock.mockResolvedValue({ items: ITEMS_FACTURA })

    const res = await importarFacturasComoIngresos({
      periodo: '2026-08',
      invoiceIds: ['i1'],
      bolsilloId: 'cbolivone0001',
    })

    expect(desgloseGuardado()).toBeUndefined()
    expect(res.data!.creados).toBe(1) // el ingreso se registra igual
    expect(res.data!.sinDesglose).toBe(1)
  })

  it('si falla el detalle de Alegra, registra el ingreso igual', async () => {
    // La plata entró: no poder leer los items no puede impedir asentarla.
    facturasMock.mockResolvedValue({
      data: [FACTURA('i1', 'FE1', 729_000, 729_000, '2026-08-26')],
      total: 1,
    })
    invoiceDetalleMock.mockRejectedValue(new Error('504'))

    const res = await importarFacturasComoIngresos({
      periodo: '2026-08',
      invoiceIds: ['i1'],
      bolsilloId: 'cbolivone0001',
    })

    expect(res.data!.creados).toBe(1)
    expect(res.data!.sinDesglose).toBe(1)
    expect(desgloseGuardado()).toBeUndefined()
  })

  it('la cotización de diez líneas del mismo servicio guarda UNA fila', async () => {
    // Cotización 1191: diez líneas de "Liquidacion Planilla". Para reportar
    // por servicio son una sola cosa.
    prismaMock.servicioAlegra.findMany.mockResolvedValue([
      { id: 'csrvplanilla', alegraItemId: '9' },
    ])
    alegraMock.mockResolvedValue({
      items: [COT('e1', 1191, 205_000, '2026-08-21')],
      truncated: false,
    })
    estimateDetalleMock.mockResolvedValue({
      items: Array.from({ length: 10 }, () => ({ id: '9', price: 20500, quantity: 1 })),
    })

    await importarCotizacionesComoIngresos({ periodo: '2026-08', estimateIds: ['e1'] })

    const desglose = desgloseGuardado()!
    expect(desglose).toHaveLength(1)
    expect(desglose[0]!.monto).toBe(205_000)
  })
})

describe('servicio en un movimiento manual', () => {
  beforeEach(() => {
    prismaMock.movimiento.create.mockResolvedValue(filaMovimiento())
  })

  it('un INGRESO con servicio guarda UNA línea con el monto entero', async () => {
    // El caso manual es el caso particular del general: escribe en la misma
    // tabla que el importador, no en un campo paralelo.
    const res = await createMovimiento({
      ...MOVIMIENTO_VALIDO,
      tipo: TipoMovimiento.INGRESO,
      monto: 80000,
      servicioAlegraId: 'csrvindep0001',
    })

    expect(res.success).toBe(true)
    expect(prismaMock.movimiento.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          detalleServicios: {
            create: [{ servicioAlegraId: 'csrvindep0001', monto: 80000 }],
          },
        }),
      })
    )
  })

  it('rechaza el servicio en un EGRESO', async () => {
    // El catálogo de Alegra es de VENTAS: un pago de nómina no vendió nada, y
    // permitirlo mezclaría egresos con ingresos al sumar por servicio.
    const res = await createMovimiento({
      ...MOVIMIENTO_VALIDO,
      tipo: TipoMovimiento.EGRESO,
      servicioAlegraId: 'csrvindep0001',
    })

    expect(res.success).toBe(false)
    expect(res.error).toContain('ingreso')
    expect(prismaMock.movimiento.create).not.toHaveBeenCalled()
  })

  it('un movimiento sin servicio no escribe desglose', async () => {
    const res = await createMovimiento(MOVIMIENTO_VALIDO)

    expect(res.success).toBe(true)
    const [args] = prismaMock.movimiento.create.mock.calls[0] as [
      { data: Record<string, unknown> },
    ]
    expect(args.data).not.toHaveProperty('detalleServicios')
  })

  it('la anulación espeja el desglose del original', async () => {
    // Si no, un movimiento anulado seguiría contando entero en el reporte por
    // servicio y el número mentiría hacia arriba.
    prismaMock.movimiento.findUnique.mockResolvedValue({
      id: 'cmov0000001',
      tipo: TipoMovimiento.INGRESO,
      monto: dec(729000),
      concepto: 'Cobro factura FE1',
      bolsilloId: IVONE,
      bolsilloDestinoId: null,
      categoriaId: CATEGORIA,
      contraparteId: null,
      prestamoId: null,
      anuladoPor: null,
      detalleServicios: [
        { servicioAlegraId: 'csrvadmin001', monto: dec(150000) },
        { servicioAlegraId: 'csrvrecaudo1', monto: dec(579000) },
      ],
    })

    await anularMovimiento({ movimientoId: 'cmov0000001', motivo: 'se devolvió el pago' })

    expect(prismaMock.movimiento.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          detalleServicios: {
            create: [
              { servicioAlegraId: 'csrvadmin001', monto: 150000 },
              { servicioAlegraId: 'csrvrecaudo1', monto: 579000 },
            ],
          },
        }),
      })
    )
  })
})


// ---------------------------------------------------------------------------

describe('reporte: separar lo ganado de lo que solo pasó', () => {
  /** Un movimiento tal como lo devuelve el select del reporte anual. */
  function mov(
    tipo: TipoMovimiento,
    monto: number,
    detalles: Array<{ id: string; nombre: string; monto: number; enTransito: boolean }> = []
  ) {
    return {
      tipo,
      monto: dec(monto),
      periodo: '2026-08',
      bolsillo: { id: IVONE, nombre: 'IVONE' },
      categoriaId: CATEGORIA,
      categoria: { id: CATEGORIA, nombre: 'Cobro de factura', grupo: GrupoCategoria.COBRO_FACTURA },
      contraparte: null,
      detalleServicios: detalles.map((d) => ({
        monto: dec(d.monto),
        servicio: {
          id: d.id,
          nombre: d.nombre,
          referencia: null,
          enTransito: d.enTransito,
        },
      })),
    }
  }

  const FACTURA_DESGLOSADA = [
    { id: 'csrvadmin001', nombre: 'Administracion', monto: 150_000, enTransito: false },
    { id: 'csrvrecaudo1', nombre: 'Recaudo para Terceros', monto: 579_000, enTransito: true },
  ]

  function prepararReporte(movimientos: unknown[]) {
    prismaMock.movimiento.findMany.mockImplementation(async (args: any) =>
      args?.distinct ? [{ periodo: '2026-08' }] : movimientos
    )
  }

  it('descuenta la plata en tránsito del ingreso del año', async () => {
    prepararReporte([mov(TipoMovimiento.INGRESO, 729_000, FACTURA_DESGLOSADA)])

    const res = await getReporteAnual(2026)

    expect(res.data!.totalIngresos).toBe(729_000)
    expect(res.data!.ingresoNeto.enTransito).toBe(579_000)
    expect(res.data!.ingresoNeto.netos).toBe(150_000)
  })

  it('agrupa por servicio', async () => {
    prepararReporte([mov(TipoMovimiento.INGRESO, 729_000, FACTURA_DESGLOSADA)])

    const res = await getReporteAnual(2026)

    const porServicio = res.data!.porServicio
    expect(porServicio).toHaveLength(2)
    expect(porServicio.find((f) => f.id === 'csrvadmin001')!.ingresos).toBe(150_000)
    expect(porServicio.find((f) => f.id === 'csrvrecaudo1')!.ingresos).toBe(579_000)
  })

  it('marca el servicio en tránsito en la etiqueta secundaria', async () => {
    prepararReporte([mov(TipoMovimiento.INGRESO, 729_000, FACTURA_DESGLOSADA)])

    const res = await getReporteAnual(2026)

    expect(res.data!.porServicio.find((f) => f.id === 'csrvrecaudo1')!.detalle).toBe(
      'En tránsito'
    )
  })

  it('informa cuánto entró SIN desglose', async () => {
    // Es lo que hace honesto al neto: hoy el libro tiene ingresos viejos sin
    // desglose, y sin este número el neto parecería exacto.
    prepararReporte([
      mov(TipoMovimiento.INGRESO, 729_000, FACTURA_DESGLOSADA),
      mov(TipoMovimiento.INGRESO, 200_000), // cargado a mano, sin servicio
    ])

    const res = await getReporteAnual(2026)

    expect(res.data!.ingresoNeto.conDesglose).toBe(729_000)
    expect(res.data!.ingresoNeto.sinDesglose).toBe(200_000)
  })

  it('sin ningún desglose, el neto es igual al bruto', async () => {
    // El caso de hoy: catálogo recién creado y ningún cobro importado.
    prepararReporte([mov(TipoMovimiento.INGRESO, 500_000)])

    const res = await getReporteAnual(2026)

    expect(res.data!.porServicio).toEqual([])
    expect(res.data!.ingresoNeto.netos).toBe(500_000)
    expect(res.data!.ingresoNeto.sinDesglose).toBe(500_000)
  })

  it('separa en el año lo que entró por cotización de lo que entró por factura', async () => {
    // Para el negocio son cosas distintas — "por debajo" y "por arriba" — y
    // por eso son dos grupos de categoría y no dos categorías del mismo grupo.
    prepararReporte([
      {
        ...mov(TipoMovimiento.INGRESO, 6_408_000),
        categoria: {
          id: 'ccatcot00001',
          nombre: 'Cobro de cotización',
          grupo: GrupoCategoria.COBRO_COTIZACION,
        },
      },
      mov(TipoMovimiento.INGRESO, 729_000, FACTURA_DESGLOSADA),
    ])

    const res = await getReporteAnual(2026)

    expect(res.data!.ingresos.cotizacion.bruto).toBe(6_408_000)
    expect(res.data!.ingresos.factura.bruto).toBe(729_000)
    expect(res.data!.ingresos.factura.neto).toBe(150_000)
  })

  it('el mes a mes trae C y F en BRUTO, sin descontar el tránsito', async () => {
    // La columna Neto de esa tabla significa ingresos − egresos. Descontar el
    // tránsito solo en una columna cambiaría en silencio lo que dice la otra.
    prepararReporte([mov(TipoMovimiento.INGRESO, 729_000, FACTURA_DESGLOSADA)])

    const res = await getReporteAnual(2026)

    const agosto = res.data!.meses.find((m) => m.periodo === '2026-08')!
    expect(agosto.ingresosFactura).toBe(729_000)
    expect(agosto.ingresos).toBe(729_000)
  })

  it('los ingresos que no son C ni F van a "otros"', async () => {
    // Un abono a préstamo también entra. Sin este bucket, C + F no daría el
    // total y la tabla dejaría de sumar a la vista.
    prepararReporte([
      {
        ...mov(TipoMovimiento.INGRESO, 400_000),
        categoria: {
          id: 'ccatabono001',
          nombre: 'Abono a préstamo',
          grupo: GrupoCategoria.PRESTAMO_ABONO,
        },
      },
    ])

    const res = await getReporteAnual(2026)

    expect(res.data!.ingresos.otros.bruto).toBe(400_000)
    expect(res.data!.meses[0]!.ingresosOtros).toBe(400_000)
    // La fila del mes a mes tiene que sumar a la vista.
    const mes = res.data!.meses[0]!
    expect(mes.ingresosCotizacion + mes.ingresosFactura + mes.ingresosOtros).toBe(
      mes.ingresos
    )
    expect(res.data!.ingresos.otros.porCategoria).toEqual([
      { nombre: 'Abono a préstamo', monto: 400_000 },
    ])
  })

  it('el egreso de una anulación cuenta del lado del egreso, no resta del neto', async () => {
    // Misma regla que el corte por categoría: una anulación aparece como
    // egreso. Restarla del neto lo dejaría fuera de escala con totalIngresos,
    // que tampoco descuenta anulaciones.
    prepararReporte([
      mov(TipoMovimiento.INGRESO, 729_000, FACTURA_DESGLOSADA),
      mov(TipoMovimiento.EGRESO, 729_000, FACTURA_DESGLOSADA),
    ])

    const res = await getReporteAnual(2026)

    expect(res.data!.ingresoNeto.enTransito).toBe(579_000)
    expect(res.data!.porServicio.find((f) => f.id === 'csrvrecaudo1')!.egresos).toBe(
      579_000
    )
  })
})


// ---------------------------------------------------------------------------

describe('getResumenPeriodo — ingresos C y F separados', () => {
  function prepararIngresos(
    movimientos: Array<{
      grupo: GrupoCategoria
      categoria?: string
      monto: number
      detalles?: Array<{ monto: number; enTransito: boolean }>
    }>
  ) {
    prismaMock.bolsillo.findMany.mockResolvedValue([{ id: IVONE, nombre: 'IVONE' }])
    prismaMock.cierreMensual.findMany.mockResolvedValue([])
    prismaMock.movimiento.findMany.mockImplementation(async (args: any) => {
      if (args?.where?.periodo?.lt) return []
      return movimientos.map((m) => ({
        tipo: TipoMovimiento.INGRESO,
        monto: dec(m.monto),
        bolsilloId: IVONE,
        bolsilloDestinoId: null,
        categoria: { nombre: m.categoria ?? 'Cobro', grupo: m.grupo },
        detalleServicios: (m.detalles ?? []).map((d) => ({
          monto: dec(d.monto),
          servicio: { enTransito: d.enTransito },
        })),
      }))
    })
  }

  it('separa el cobro por cotización del cobro por factura', async () => {
    prepararIngresos([
      { grupo: GrupoCategoria.COBRO_COTIZACION, monto: 6_408_000 },
      { grupo: GrupoCategoria.COBRO_FACTURA, monto: 729_000 },
    ])

    const res = await getResumenPeriodo('2026-08')

    expect(res.data!.ingresos.cotizacion.bruto).toBe(6_408_000)
    expect(res.data!.ingresos.factura.bruto).toBe(729_000)
    expect(res.data!.totalIngresos).toBe(7_137_000)
  })

  it('descuenta el tránsito solo dentro de la factura', async () => {
    // El recaudo para terceros viaja en las facturas, no en las cotizaciones.
    prepararIngresos([
      { grupo: GrupoCategoria.COBRO_COTIZACION, monto: 80_000 },
      {
        grupo: GrupoCategoria.COBRO_FACTURA,
        monto: 729_000,
        detalles: [
          { monto: 150_000, enTransito: false },
          { monto: 579_000, enTransito: true },
        ],
      },
    ])

    const res = await getResumenPeriodo('2026-08')

    expect(res.data!.ingresos.cotizacion.neto).toBe(80_000)
    expect(res.data!.ingresos.factura.neto).toBe(150_000)
  })

  it('C + F + otros da el total de ingresos', async () => {
    // Es lo que permite cuadrar la fila de tarjetas del resumen: un ingreso
    // que no viene de una cotización ni de una factura —un abono a préstamo—
    // tiene que aparecer en algún lado o el total no cierra.
    prepararIngresos([
      { grupo: GrupoCategoria.COBRO_COTIZACION, monto: 6_408_000 },
      { grupo: GrupoCategoria.COBRO_FACTURA, monto: 729_000 },
      {
        grupo: GrupoCategoria.PRESTAMO_ABONO,
        categoria: 'Abono a préstamo',
        monto: 400_000,
      },
    ])

    const res = await getResumenPeriodo('2026-08')
    const i = res.data!.ingresos

    expect(i.otros.bruto).toBe(400_000)
    expect(i.cotizacion.bruto + i.factura.bruto + i.otros.bruto).toBe(
      res.data!.totalIngresos
    )
  })

  it('"otros" dice de qué categorías se compone', async () => {
    // Un agregado sin desglose no se puede cuadrar contra nada.
    prepararIngresos([
      {
        grupo: GrupoCategoria.PRESTAMO_ABONO,
        categoria: 'Abono a préstamo',
        monto: 400_000,
      },
      {
        grupo: GrupoCategoria.DEVOLUCION,
        categoria: 'Devolución a cliente',
        monto: 50_000,
      },
    ])

    const res = await getResumenPeriodo('2026-08')

    expect(res.data!.ingresos.otros.porCategoria).toEqual([
      { nombre: 'Abono a préstamo', monto: 400_000 },
      { nombre: 'Devolución a cliente', monto: 50_000 },
    ])
  })

  it('el saldo del bolsillo NO descuenta la plata en tránsito', async () => {
    // La regla que no se puede romper: los 729.000 entraron al banco de verdad
    // y la caja tiene que seguir cuadrando contra el extracto.
    prepararIngresos([
      {
        grupo: GrupoCategoria.COBRO_FACTURA,
        monto: 729_000,
        detalles: [
          { monto: 150_000, enTransito: false },
          { monto: 579_000, enTransito: true },
        ],
      },
    ])

    const res = await getResumenPeriodo('2026-08')

    expect(res.data!.saldoConsolidado).toBe(729_000)
  })
})


// ---------------------------------------------------------------------------

describe('getMovimientos — filtro por préstamo', () => {
  beforeEach(() => {
    prismaMock.movimiento.findMany.mockResolvedValue([])
    prismaMock.movimiento.count.mockResolvedValue(0)
    prismaMock.movimiento.aggregate.mockResolvedValue({ _sum: { monto: null } })
  })

  it('filtra por prestamoId', async () => {
    await getMovimientos({ prestamoId: 'cpre0000001' })

    expect(prismaMock.movimiento.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ prestamoId: 'cpre0000001' }),
      })
    )
  })

  it('sin préstamo, no ensucia el where', async () => {
    await getMovimientos({ periodo: '2026-08' })

    const [args] = prismaMock.movimiento.count.mock.calls[0] as [
      { where: Record<string, unknown> },
    ]
    expect(args.where.prestamoId).toBeUndefined()
  })
})


// ---------------------------------------------------------------------------

describe('reporte: contraste de lo que entra y sale', () => {
  const MENSAJERIA = 'csrvmensaje1'
  const CAT_EGRESO = 'ccatmensaje1'

  function mov(
    tipo: TipoMovimiento,
    monto: number,
    categoriaId: string,
    detalles: Array<{ id: string; monto: number }> = []
  ) {
    return {
      tipo,
      monto: dec(monto),
      periodo: '2026-08',
      categoriaId,
      bolsillo: { id: IVONE, nombre: 'IVONE' },
      categoria: {
        id: categoriaId,
        nombre: 'Categoría',
        grupo:
          categoriaId === CAT_EGRESO
            ? GrupoCategoria.SERVICIO_REFERENCIADO
            : GrupoCategoria.COBRO_FACTURA,
      },
      contraparte: null,
      detalleServicios: detalles.map((d) => ({
        monto: dec(d.monto),
        servicio: { id: d.id, nombre: 'Servicios de Mensajería', referencia: '19', enTransito: true },
      })),
    }
  }

  function preparar(movimientos: unknown[], servicios: unknown[]) {
    prismaMock.movimiento.findMany.mockImplementation(async (args: any) =>
      args?.distinct ? [{ periodo: '2026-08' }] : movimientos
    )
    prismaMock.servicioAlegra.findMany.mockResolvedValue(servicios)
  }

  it('contrasta lo que entró por el servicio contra lo que salió por su categoría', async () => {
    // Los números reales de agosto-2026.
    preparar(
      [
        mov(TipoMovimiento.INGRESO, 1_752_000, CATEGORIA, [
          { id: MENSAJERIA, monto: 1_752_000 },
        ]),
        mov(TipoMovimiento.EGRESO, 4_839_000, CAT_EGRESO),
      ],
      [
        {
          id: MENSAJERIA,
          nombre: 'Servicios de Mensajería',
          categoriaEgresoId: CAT_EGRESO,
          categoriaEgreso: { nombre: 'Servicio de mensajería' },
        },
      ]
    )

    const res = await getReporteAnual(2026)
    const [c] = res.data!.intermediados

    expect(c!.totalEntro).toBe(1_752_000)
    expect(c!.totalSalio).toBe(4_839_000)
    expect(c!.totalMargen).toBe(-3_087_000)
  })

  it('un servicio sin categoría de egreso aparece con la salida en cero', async () => {
    // Es el caso de "Recaudo para Terceros": entró y su salida nunca se
    // registró. No mostrarlo sería esconder que infla el saldo.
    preparar(
      [
        mov(TipoMovimiento.INGRESO, 43_695_716, CATEGORIA, [
          { id: 'csrvrecaudo1', monto: 43_695_716 },
        ]),
      ],
      [
        {
          id: 'csrvrecaudo1',
          nombre: 'Recaudo para Terceros',
          categoriaEgresoId: null,
          categoriaEgreso: null,
        },
      ]
    )

    const res = await getReporteAnual(2026)
    const [c] = res.data!.intermediados

    expect(c!.categoriaEgreso).toBeNull()
    expect(c!.totalSalio).toBe(0)
    expect(c!.totalMargen).toBe(43_695_716)
  })

  it('sin servicios en tránsito, la vista queda vacía', async () => {
    preparar([mov(TipoMovimiento.INGRESO, 100_000, CATEGORIA)], [])

    const res = await getReporteAnual(2026)

    expect(res.data!.intermediados).toEqual([])
  })
})


// ---------------------------------------------------------------------------

describe('pagos de Alegra como egresos', () => {
  const PAGO = (id: string, monto: number, fecha = '2026-08-15') => ({
    id,
    date: fecha,
    number: 714,
    amount: monto,
    type: 'out',
    paymentMethod: 'transfer',
    bankAccount: { id: '3', name: 'Banco 1' },
    client: { id: '1170', name: 'FAWER SAS' },
    associations: 'Facturas de compra: DOSE188',
  })

  beforeEach(() => {
    pagosMock.mockResolvedValue({ items: [], truncated: false })
    prismaMock.movimiento.findMany.mockResolvedValue([])
    prismaMock.bolsillo.findUnique.mockResolvedValue({ id: IVONE, nombre: 'IVONE' })
    prismaMock.movimiento.create.mockResolvedValue(filaMovimiento())
  })

  it('pide SOLO los pagos de salida', async () => {
    // /payments no acepta filtro de fecha pero `type` sí es del servidor, y
    // achica el recorrido a la cuarta parte.
    await getPagosDelPeriodo('2026-08')

    expect(pagosMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'out',
        dateFrom: '2026-08-01',
        dateTo: '2026-08-31',
      }),
      expect.any(Number)
    )
  })

  it('marca los pagos que ya están registrados', async () => {
    pagosMock.mockResolvedValue({ items: [PAGO('3579', 902_400)], truncated: false })
    prismaMock.movimiento.findMany.mockResolvedValue([
      { id: 'cmovya0001', alegraPaymentId: '3579' },
    ])

    const res = await getPagosDelPeriodo('2026-08')

    expect(res.data!.pagos[0]!.yaRegistrado).toBe(true)
    expect(res.data!.cantidadPendiente).toBe(0)
  })

  it('propaga el aviso de búsqueda incompleta', async () => {
    // Un total que miente por lo bajo es peor que no mostrarlo.
    pagosMock.mockResolvedValue({ items: [], truncated: true })

    const res = await getPagosDelPeriodo('2026-08')

    expect(res.data!.posiblementeIncompleto).toBe(true)
  })

  it('registra el egreso con la categoría elegida PARA ESE pago', async () => {
    // Entre estos pagos hay gastos, traslados y retiros. Una sola categoría
    // para todos dejaría el reporte por categoría sin significado.
    pagosMock.mockResolvedValue({ items: [PAGO('3579', 902_400)], truncated: false })

    const res = await importarPagosComoEgresos({
      periodo: '2026-08',
      bolsilloId: IVONE,
      pagos: [{ paymentId: '3579', categoriaId: CATEGORIA }],
    })

    expect(res.success).toBe(true)
    expect(prismaMock.movimiento.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tipo: TipoMovimiento.EGRESO,
          monto: 902_400,
          categoriaId: CATEGORIA,
          bolsilloId: IVONE,
          alegraPaymentId: '3579',
        }),
      })
    )
  })

  it('la categoría es OPCIONAL: sin elegir una, se deriva del concepto', async () => {
    // Lo único que hay que decidir para importar es de qué cuenta salió la
    // plata. Exigir la categoría convertía cada mes en 244 decisiones.
    pagosMock.mockResolvedValue({
      items: [{ ...PAGO('3579', 902_400), categories: [{ id: '5', name: 'Aportes a EPS' }] }],
      truncated: false,
    })
    prismaMock.categoriaMovimiento.findFirst.mockResolvedValue(null)
    prismaMock.categoriaMovimiento.create.mockResolvedValue({ id: 'ccatnueva001' })

    const res = await importarPagosComoEgresos({
      periodo: '2026-08',
      bolsilloId: IVONE,
      pagos: [{ paymentId: '3579' }],
    })

    expect(res.success).toBe(true)
    expect(prismaMock.categoriaMovimiento.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          nombre: 'Aportes a EPS',
          grupo: GrupoCategoria.OTRO,
        }),
      })
    )
    expect(prismaMock.movimiento.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ categoriaId: 'ccatnueva001' }),
      })
    )
  })

  it('reusa la categoría si ya existe una con el nombre del concepto', async () => {
    pagosMock.mockResolvedValue({
      items: [{ ...PAGO('3579', 902_400), categories: [{ id: '5', name: 'Aportes a EPS' }] }],
      truncated: false,
    })
    prismaMock.categoriaMovimiento.findFirst.mockResolvedValue({ id: 'ccatya000001' })

    await importarPagosComoEgresos({
      periodo: '2026-08',
      bolsilloId: IVONE,
      pagos: [{ paymentId: '3579' }],
    })

    expect(prismaMock.categoriaMovimiento.create).not.toHaveBeenCalled()
    expect(prismaMock.movimiento.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ categoriaId: 'ccatya000001' }),
      })
    )
  })

  it('la categoría elegida a mano MANDA sobre el concepto', async () => {
    pagosMock.mockResolvedValue({
      items: [{ ...PAGO('3579', 902_400), categories: [{ id: '5', name: 'Aportes a EPS' }] }],
      truncated: false,
    })

    await importarPagosComoEgresos({
      periodo: '2026-08',
      bolsilloId: IVONE,
      pagos: [{ paymentId: '3579', categoriaId: CATEGORIA }],
    })

    expect(prismaMock.categoriaMovimiento.create).not.toHaveBeenCalled()
    expect(prismaMock.movimiento.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ categoriaId: CATEGORIA }) })
    )
  })

  it('exige bolsillo', async () => {
    const res = await importarPagosComoEgresos({
      periodo: '2026-08',
      bolsilloId: '',
      pagos: [{ paymentId: '3579', categoriaId: CATEGORIA }],
    })

    expect(res.success).toBe(false)
    expect(prismaMock.movimiento.create).not.toHaveBeenCalled()
  })

  it('NO vuelve a registrar un pago ya registrado', async () => {
    pagosMock.mockResolvedValue({ items: [PAGO('3579', 902_400)], truncated: false })
    prismaMock.movimiento.findMany.mockResolvedValue([
      { id: 'cmovya0001', alegraPaymentId: '3579' },
    ])

    const res = await importarPagosComoEgresos({
      periodo: '2026-08',
      bolsilloId: IVONE,
      pagos: [{ paymentId: '3579', categoriaId: CATEGORIA }],
    })

    expect(res.data!.creados).toBe(0)
    expect(prismaMock.movimiento.create).not.toHaveBeenCalled()
  })

  it('no registra nada en un periodo cerrado', async () => {
    pagosMock.mockResolvedValue({ items: [PAGO('3579', 902_400)], truncated: false })
    prismaMock.cierreMensual.findUnique.mockResolvedValue({ cerrado: true })

    const res = await importarPagosComoEgresos({
      periodo: '2026-08',
      bolsilloId: IVONE,
      pagos: [{ paymentId: '3579', categoriaId: CATEGORIA }],
    })

    expect(res.data!.creados).toBe(0)
    expect(prismaMock.movimiento.create).not.toHaveBeenCalled()
  })

  it('exige acceso a Control', async () => {
    hasControlAccessMock.mockResolvedValue(false)

    expect((await getPagosDelPeriodo('2026-08')).success).toBe(false)
    expect(pagosMock).not.toHaveBeenCalled()
  })
})


// ---------------------------------------------------------------------------

describe('el concepto del pago decide la categoría', () => {
  const PAGO_CON_CONCEPTO = {
    id: '3578',
    date: '2026-08-15',
    number: 713,
    amount: 32_400,
    type: 'out',
    bankAccount: { id: '3', name: 'Banco 1' },
    client: { id: '34', name: 'SIMPLE S.A.' },
    categories: [{ id: '5236', name: 'Otros gastos generales' }],
  }

  const PAGO_CON_FACTURA = {
    id: '3579',
    date: '2026-08-15',
    number: 714,
    amount: 902_400,
    type: 'out',
    bankAccount: { id: '3', name: 'Banco 1' },
    client: { id: '1170', name: 'NIDIA IVONE RENDON MUÑETON' },
    bills: [{ id: '275', number: '188' }],
  }

  beforeEach(() => {
    prismaMock.movimiento.findMany.mockResolvedValue([])
    prismaMock.bolsillo.findUnique.mockResolvedValue({ id: IVONE, nombre: 'IVONE' })
    prismaMock.movimiento.create.mockResolvedValue(filaMovimiento())
    pagosMock.mockResolvedValue({ items: [], truncated: false })
  })

  it('lee el concepto del propio pago cuando no tiene factura', async () => {
    pagosMock.mockResolvedValue({ items: [PAGO_CON_CONCEPTO], truncated: false })

    const res = await getPagosDelPeriodo('2026-08')

    expect(res.data!.pagos[0]!.conceptos).toEqual(['Otros gastos generales'])
  })

  it('lo lee de la FACTURA cuando el pago se aplicó a una', async () => {
    // 89 de cada 150 pagos son así: el concepto no está en el pago, está en la
    // factura de compra. Y /bills ya lo devuelve en la lista.
    pagosMock.mockResolvedValue({ items: [PAGO_CON_FACTURA], truncated: false })
    billsMock.mockResolvedValue({
      items: [{ id: '275', purchases: { categories: [{ name: 'Otros honorarios' }] } }],
      truncated: false,
    })

    const res = await getPagosDelPeriodo('2026-08')

    expect(res.data!.pagos[0]!.conceptos).toEqual(['Otros honorarios'])
  })

  it('acepta la forma `purchases.items` además de `purchases.categories`', async () => {
    // Algunas cuentas anidan la compra de una forma y otras de la otra.
    pagosMock.mockResolvedValue({ items: [PAGO_CON_FACTURA], truncated: false })
    billsMock.mockResolvedValue({
      items: [{ id: '275', purchases: { items: [{ name: 'Dotación a trabajadores' }] } }],
      truncated: false,
    })

    const res = await getPagosDelPeriodo('2026-08')

    expect(res.data!.pagos[0]!.conceptos).toEqual(['Dotación a trabajadores'])
  })

  it('sugiere la categoría que ya se mapeó para ese concepto', async () => {
    pagosMock.mockResolvedValue({ items: [PAGO_CON_CONCEPTO], truncated: false })
    prismaMock.conceptoPagoAlegra.findMany.mockResolvedValue([
      { nombre: 'Otros gastos generales', categoriaId: CATEGORIA },
    ])

    const res = await getPagosDelPeriodo('2026-08')

    expect(res.data!.pagos[0]!.categoriaSugeridaId).toBe(CATEGORIA)
  })

  it('sin mapeo previo no sugiere nada', async () => {
    pagosMock.mockResolvedValue({ items: [PAGO_CON_CONCEPTO], truncated: false })

    const res = await getPagosDelPeriodo('2026-08')

    expect(res.data!.pagos[0]!.categoriaSugeridaId).toBeNull()
  })

  it('si no se pueden leer las facturas, el pago igual aparece', async () => {
    // Sin las facturas se pierde la sugerencia, no el pago.
    pagosMock.mockResolvedValue({ items: [PAGO_CON_FACTURA], truncated: false })
    billsMock.mockRejectedValue(new Error('502'))

    const res = await getPagosDelPeriodo('2026-08')

    expect(res.success).toBe(true)
    expect(res.data!.pagos).toHaveLength(1)
    expect(res.data!.pagos[0]!.conceptos).toEqual([])
  })

  it('al importar APRENDE la equivalencia concepto → categoría', async () => {
    // Es lo que hace viable clasificar 244 pagos: se decide una vez por
    // concepto y el mes siguiente sale solo.
    pagosMock.mockResolvedValue({ items: [PAGO_CON_CONCEPTO], truncated: false })

    await importarPagosComoEgresos({
      periodo: '2026-08',
      bolsilloId: IVONE,
      pagos: [{ paymentId: '3578', categoriaId: CATEGORIA }],
    })

    expect(prismaMock.conceptoPagoAlegra.create).toHaveBeenCalledWith({
      data: { nombre: 'Otros gastos generales', categoriaId: CATEGORIA },
    })
  })

  it('una equivalencia ya existente no rompe la importación', async () => {
    // A partir del segundo pago del mismo concepto el índice único rebota.
    // Es lo normal, no un error: la decisión vieja manda.
    pagosMock.mockResolvedValue({ items: [PAGO_CON_CONCEPTO], truncated: false })
    prismaMock.conceptoPagoAlegra.create.mockRejectedValue(new Error('unique'))

    const res = await importarPagosComoEgresos({
      periodo: '2026-08',
      bolsilloId: IVONE,
      pagos: [{ paymentId: '3578', categoriaId: CATEGORIA }],
    })

    expect(res.success).toBe(true)
    expect(res.data!.creados).toBe(1)
  })

  it('deja el concepto escrito en las notas del movimiento', async () => {
    pagosMock.mockResolvedValue({ items: [PAGO_CON_CONCEPTO], truncated: false })

    await importarPagosComoEgresos({
      periodo: '2026-08',
      bolsilloId: IVONE,
      pagos: [{ paymentId: '3578', categoriaId: CATEGORIA }],
    })

    const [args] = prismaMock.movimiento.create.mock.calls[0] as [
      { data: { notas: string } },
    ]
    expect(args.data.notas).toContain('Otros gastos generales')
  })
})
