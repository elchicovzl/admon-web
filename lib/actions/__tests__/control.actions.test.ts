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
import { TipoMovimiento, GrupoCategoria } from '@prisma/client'

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
    categoriaMovimiento: { findFirst: vi.fn() },
    prestamo: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    bolsillo: { findMany: vi.fn() },
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
    prismaMock.movimiento.findMany.mockResolvedValue(
      opts.movimientos.map((m) => ({
        tipo: m.tipo,
        monto: dec(m.monto),
        bolsilloId: EFECTIVO,
        bolsilloDestinoId: m.destino ?? null,
      }))
    )
    prismaMock.cierreMensual.findMany.mockResolvedValue([
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
    ])
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
