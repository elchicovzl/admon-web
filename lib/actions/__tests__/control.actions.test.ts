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

const { prismaMock, authMock, hasControlAccessMock } = vi.hoisted(() => ({
  prismaMock: {
    movimiento: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
    cierreMensual: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn() },
    categoriaMovimiento: { findFirst: vi.fn(), create: vi.fn() },
    prestamo: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    bolsillo: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    contraparte: { findUnique: vi.fn(), create: vi.fn(), findMany: vi.fn() },
    servicioReferenciado: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
  authMock: vi.fn(),
  hasControlAccessMock: vi.fn(),
}))

vi.mock('@/lib/db/prisma', () => ({ default: prismaMock }))
vi.mock('@/lib/auth/auth', () => ({ auth: authMock }))
vi.mock('@/lib/auth/rbac', () => ({ hasControlAccess: hasControlAccessMock }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
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
