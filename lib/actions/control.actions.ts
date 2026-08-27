'use server'

/**
 * Server Actions del módulo Control (libro de caja interno).
 *
 * Tres reglas que se repiten en todo el archivo y conviene tener presentes:
 *
 * 1. TODA action empieza con requireControlAuth(). El middleware protege la
 *    ruta, pero un Server Action se invoca directo sin pasar por ninguna ruta.
 *    Además ese check lee la base y no el token, así que un permiso revocado
 *    pega en el siguiente request y no en 30 días.
 *
 * 2. Los montos salen de acá como `number`, nunca como Prisma.Decimal. Esta es
 *    la frontera donde se convierten; un Decimal que cruce hacia un Client
 *    Component revienta el render con un error de serialización.
 *
 * 3. Nada derivado se guarda. El saldo de un préstamo, el margen de un
 *    servicio y el saldo de un cierre se calculan desde los movimientos, con
 *    las funciones puras de lib/utils/control-ledger.ts.
 */

import { cache } from 'react'
import { revalidatePath } from 'next/cache'
import prisma from '@/lib/db/prisma'
import { auth } from '@/lib/auth/auth'
import { hasControlAccess } from '@/lib/auth/rbac'
import {
  GrupoCategoria,
  TipoMovimiento,
  type Prisma,
} from '@prisma/client'
import type { ActionResponse } from '@/lib/types/auth.types'
import {
  decimalANumero,
  decimalANumeroOpcional,
  type BolsilloListItem,
  type CategoriaListItem,
  type TipoServicioListItem,
  type ContraparteListItem,
  type MovimientoListItem,
  type PrestamoListItem,
  type ServicioReferenciadoListItem,
  type CierreMensualView,
  type ResumenPeriodo,
} from '@/lib/types/control.types'
import {
  parseFechaCalendario,
  periodoDeFecha,
  calcularSaldoFinal,
  calcularDiferencia,
  saldoPrestamo,
  totalAbonado,
  estadoPrestamo,
  margenServicio,
  estadoServicio,
  contraMovimiento,
  sumarMontos,
  type MovimientoParaSaldo,
} from '@/lib/utils/control-ledger'
import {
  createContraparteSchema,
  createMovimientoSchema,
  anularMovimientoSchema,
  createPrestamoSchema,
  abonarPrestamoSchema,
  marcarIncobrableSchema,
  createServicioSchema,
  registrarPataServicioSchema,
  registrarConteoSchema,
  aperturaInicialSchema,
  cerrarPeriodoSchema,
  type CreateContraparteInput,
  type CreateMovimientoInput,
  type AnularMovimientoInput,
  type CreatePrestamoInput,
  type AbonarPrestamoInput,
  type MarcarIncobrableInput,
  type CreateServicioInput,
  type RegistrarPataServicioInput,
  type RegistrarConteoInput,
  type AperturaInicialInput,
  type CerrarPeriodoInput,
} from '@/lib/validations/control.schema'

const RUTA_CONTROL = '/dashboard/control'

// ---------------------------------------------------------------------------
// Autorización
// ---------------------------------------------------------------------------

/**
 * Autorización del módulo, en la forma `{ authorized, error }` que usa el
 * resto de las actions del proyecto. Por debajo llama a hasControlAccess(),
 * que consulta la base.
 */
async function requireControlAuth() {
  const session = await auth()

  if (!session?.user?.id) {
    return { authorized: false as const, error: 'No autenticado' }
  }

  if (!(await hasControlAccess())) {
    return { authorized: false as const, error: 'No tenés acceso al módulo Control' }
  }

  return { authorized: true as const, userId: session.user.id }
}

function sinAutorizacion(error: string): ActionResponse<never> {
  return { success: false, error }
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

/**
 * Busca la categoría de un grupo que tiene una sola opción razonable.
 *
 * Sirve para el desembolso y el abono de préstamos: son movimientos que
 * genera el sistema y donde el grupo determina la categoría sin ambigüedad.
 *
 * NO se usa para servicios referenciados. Ahí hay varias categorías en el
 * mismo grupo (mensajería, exámenes médicos…) y elegir "la primera" ponía la
 * categoría equivocada sin que nada avisara. Cada TipoServicioReferenciado
 * apunta a la suya con `categoriaId`.
 */
async function resolverCategoria(grupo: GrupoCategoria): Promise<string | null> {
  const primera = await prisma.categoriaMovimiento.findFirst({
    where: { grupo, isActive: true },
    orderBy: { nombre: 'asc' },
    select: { id: true },
  })

  return primera?.id ?? null
}

/**
 * Un periodo cerrado no admite movimientos nuevos.
 *
 * Si no se bloquea, un movimiento con fecha vieja cambia un saldo que ya se
 * dio por bueno, y el cierre siguiente arranca de un número que nadie volvió
 * a mirar.
 */
async function periodoEstaCerrado(
  periodo: string,
  bolsilloId: string
): Promise<boolean> {
  const cierre = await prisma.cierreMensual.findUnique({
    where: { periodo_bolsilloId: { periodo, bolsilloId } },
    select: { cerrado: true },
  })

  return cierre?.cerrado === true
}

const movimientoSelect = {
  id: true,
  fecha: true,
  periodo: true,
  tipo: true,
  monto: true,
  concepto: true,
  prestamoId: true,
  notas: true,
  createdAt: true,
  anulaMovimientoId: true,
  bolsillo: { select: { id: true, nombre: true } },
  bolsilloDestino: { select: { id: true, nombre: true } },
  categoria: { select: { id: true, nombre: true, grupo: true } },
  contraparte: { select: { id: true, nombre: true } },
  createdBy: { select: { name: true, email: true } },
  anuladoPor: { select: { id: true } },
} satisfies Prisma.MovimientoSelect

type MovimientoRow = Prisma.MovimientoGetPayload<{ select: typeof movimientoSelect }>

function aMovimientoListItem(row: MovimientoRow): MovimientoListItem {
  return {
    id: row.id,
    fecha: row.fecha,
    periodo: row.periodo,
    tipo: row.tipo,
    monto: decimalANumero(row.monto),
    concepto: row.concepto,
    bolsillo: row.bolsillo,
    bolsilloDestino: row.bolsilloDestino,
    categoria: row.categoria,
    contraparte: row.contraparte,
    prestamoId: row.prestamoId,
    notas: row.notas,
    createdAt: row.createdAt,
    createdBy: row.createdBy,
    anulaMovimientoId: row.anulaMovimientoId,
    estaAnulado: row.anuladoPor !== null,
  }
}

// ---------------------------------------------------------------------------
// Catálogos
// ---------------------------------------------------------------------------

export const getBolsillos = cache(
  async (incluirInactivos = false): Promise<ActionResponse<BolsilloListItem[]>> => {
    const auth = await requireControlAuth()
    if (!auth.authorized) return sinAutorizacion(auth.error)

    const bolsillos = await prisma.bolsillo.findMany({
      where: incluirInactivos ? undefined : { isActive: true },
      orderBy: [{ isActive: 'desc' }, { orden: 'asc' }],
      select: {
        id: true,
        nombre: true,
        tipo: true,
        orden: true,
        isActive: true,
        cerradoEn: true,
      },
    })

    return { success: true, data: bolsillos }
  }
)

export const getCategorias = cache(
  async (): Promise<ActionResponse<CategoriaListItem[]>> => {
    const auth = await requireControlAuth()
    if (!auth.authorized) return sinAutorizacion(auth.error)

    const categorias = await prisma.categoriaMovimiento.findMany({
      where: { isActive: true },
      orderBy: [{ grupo: 'asc' }, { nombre: 'asc' }],
      select: { id: true, nombre: true, grupo: true, isActive: true },
    })

    return { success: true, data: categorias }
  }
)

export const getTiposServicio = cache(
  async (): Promise<ActionResponse<TipoServicioListItem[]>> => {
    const auth = await requireControlAuth()
    if (!auth.authorized) return sinAutorizacion(auth.error)

    const tipos = await prisma.tipoServicioReferenciado.findMany({
      where: { isActive: true },
      orderBy: { nombre: 'asc' },
      select: {
        id: true,
        nombre: true,
        isActive: true,
        categoria: { select: { id: true, nombre: true } },
      },
    })

    return { success: true, data: tipos }
  }
)

// ---------------------------------------------------------------------------
// Contrapartes
// ---------------------------------------------------------------------------

export const getContrapartes = cache(
  async (): Promise<ActionResponse<ContraparteListItem[]>> => {
    const auth = await requireControlAuth()
    if (!auth.authorized) return sinAutorizacion(auth.error)

    const contrapartes = await prisma.contraparte.findMany({
      where: { isActive: true },
      orderBy: [{ tipo: 'asc' }, { nombre: 'asc' }],
      select: {
        id: true,
        nombre: true,
        tipo: true,
        documento: true,
        isActive: true,
        userId: true,
        clientId: true,
      },
    })

    return { success: true, data: contrapartes }
  }
)

export async function createContraparte(
  data: CreateContraparteInput
): Promise<ActionResponse<ContraparteListItem>> {
  const auth = await requireControlAuth()
  if (!auth.authorized) return sinAutorizacion(auth.error)

  const validado = createContraparteSchema.safeParse(data)
  if (!validado.success) {
    return { success: false, error: validado.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const { documento } = validado.data

  if (documento) {
    const existente = await prisma.contraparte.findUnique({
      where: { documento },
      select: { nombre: true },
    })

    if (existente) {
      return {
        success: false,
        error: `Ese documento ya está registrado para "${existente.nombre}"`,
      }
    }
  }

  const contraparte = await prisma.contraparte.create({
    data: { ...validado.data, createdById: auth.userId },
    select: {
      id: true,
      nombre: true,
      tipo: true,
      documento: true,
      isActive: true,
      userId: true,
      clientId: true,
    },
  })

  revalidatePath(RUTA_CONTROL)

  return { success: true, message: 'Contraparte creada', data: contraparte }
}

// ---------------------------------------------------------------------------
// Movimientos
// ---------------------------------------------------------------------------

export const getMovimientos = cache(
  async (filtros?: {
    periodo?: string
    bolsilloId?: string
    contraparteId?: string
  }): Promise<ActionResponse<MovimientoListItem[]>> => {
    const auth = await requireControlAuth()
    if (!auth.authorized) return sinAutorizacion(auth.error)

    const movimientos = await prisma.movimiento.findMany({
      where: {
        periodo: filtros?.periodo,
        contraparteId: filtros?.contraparteId,
        // Un traslado toca dos bolsillos, así que filtrar por bolsillo tiene
        // que mirar los dos extremos o el movimiento desaparece de la vista
        // del bolsillo destino.
        ...(filtros?.bolsilloId
          ? {
              OR: [
                { bolsilloId: filtros.bolsilloId },
                { bolsilloDestinoId: filtros.bolsilloId },
              ],
            }
          : {}),
      },
      orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
      select: movimientoSelect,
    })

    return { success: true, data: movimientos.map(aMovimientoListItem) }
  }
)

export async function createMovimiento(
  data: CreateMovimientoInput
): Promise<ActionResponse<MovimientoListItem>> {
  const auth = await requireControlAuth()
  if (!auth.authorized) return sinAutorizacion(auth.error)

  const validado = createMovimientoSchema.safeParse(data)
  if (!validado.success) {
    return { success: false, error: validado.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const entrada = validado.data
  const fecha = parseFechaCalendario(entrada.fecha)
  const periodo = periodoDeFecha(fecha)

  if (await periodoEstaCerrado(periodo, entrada.bolsilloId)) {
    return {
      success: false,
      error: `El periodo ${periodo} ya está cerrado para ese bolsillo. Reabrilo para poder registrar movimientos.`,
    }
  }

  const movimiento = await prisma.movimiento.create({
    data: {
      fecha,
      periodo,
      tipo: entrada.tipo,
      monto: entrada.monto,
      concepto: entrada.concepto,
      bolsilloId: entrada.bolsilloId,
      bolsilloDestinoId: entrada.bolsilloDestinoId ?? null,
      categoriaId: entrada.categoriaId,
      contraparteId: entrada.contraparteId ?? null,
      prestamoId: entrada.prestamoId ?? null,
      notas: entrada.notas ?? null,
      createdById: auth.userId,
    },
    select: movimientoSelect,
  })

  revalidatePath(RUTA_CONTROL)

  return {
    success: true,
    message: 'Movimiento registrado',
    data: aMovimientoListItem(movimiento),
  }
}

/**
 * Anula un movimiento creando su espejo.
 *
 * No se edita ni se borra el original: al sumar los dos, el efecto sobre el
 * bolsillo queda en cero y queda registro de que pasó. Un TRASLADO se anula
 * con otro TRASLADO en sentido contrario — ver contraMovimiento().
 */
export async function anularMovimiento(
  data: AnularMovimientoInput
): Promise<ActionResponse<MovimientoListItem>> {
  const auth = await requireControlAuth()
  if (!auth.authorized) return sinAutorizacion(auth.error)

  const validado = anularMovimientoSchema.safeParse(data)
  if (!validado.success) {
    return { success: false, error: validado.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const { movimientoId, motivo } = validado.data

  const original = await prisma.movimiento.findUnique({
    where: { id: movimientoId },
    select: {
      id: true,
      tipo: true,
      monto: true,
      concepto: true,
      bolsilloId: true,
      bolsilloDestinoId: true,
      categoriaId: true,
      contraparteId: true,
      prestamoId: true,
      anuladoPor: { select: { id: true } },
    },
  })

  if (!original) {
    return { success: false, error: 'El movimiento no existe' }
  }

  if (original.anuladoPor) {
    return { success: false, error: 'Ese movimiento ya fue anulado' }
  }

  const fecha = validado.data.fecha
    ? parseFechaCalendario(validado.data.fecha)
    : parseFechaCalendario(new Date().toISOString().slice(0, 10))
  const periodo = periodoDeFecha(fecha)

  const espejo = contraMovimiento({
    tipo: original.tipo,
    monto: decimalANumero(original.monto),
    bolsilloId: original.bolsilloId,
    bolsilloDestinoId: original.bolsilloDestinoId,
  } satisfies MovimientoParaSaldo)

  if (await periodoEstaCerrado(periodo, espejo.bolsilloId)) {
    return {
      success: false,
      error: `El periodo ${periodo} ya está cerrado. Reabrilo para poder anular.`,
    }
  }

  const anulacion = await prisma.movimiento.create({
    data: {
      fecha,
      periodo,
      tipo: espejo.tipo,
      monto: espejo.monto,
      bolsilloId: espejo.bolsilloId,
      bolsilloDestinoId: espejo.bolsilloDestinoId,
      concepto: `Anulación: ${original.concepto}`.slice(0, 200),
      // Se conservan categoría, contraparte y préstamo del original para que
      // la anulación reste exactamente donde el original sumó.
      categoriaId: original.categoriaId,
      contraparteId: original.contraparteId,
      prestamoId: original.prestamoId,
      notas: motivo,
      anulaMovimientoId: original.id,
      createdById: auth.userId,
    },
    select: movimientoSelect,
  })

  revalidatePath(RUTA_CONTROL)

  return {
    success: true,
    message: 'Movimiento anulado',
    data: aMovimientoListItem(anulacion),
  }
}

// ---------------------------------------------------------------------------
// Préstamos
// ---------------------------------------------------------------------------

export const getPrestamos = cache(
  async (contraparteId?: string): Promise<ActionResponse<PrestamoListItem[]>> => {
    const auth = await requireControlAuth()
    if (!auth.authorized) return sinAutorizacion(auth.error)

    const prestamos = await prisma.prestamo.findMany({
      where: { contraparteId },
      orderBy: { fechaDesembolso: 'desc' },
      select: {
        id: true,
        fechaDesembolso: true,
        montoOriginal: true,
        concepto: true,
        marcadoIncobrable: true,
        incobrableMotivo: true,
        notas: true,
        contraparte: { select: { id: true, nombre: true } },
        bolsilloOrigen: { select: { id: true, nombre: true } },
        movimientos: {
          select: {
            tipo: true,
            monto: true,
            categoria: { select: { grupo: true } },
          },
        },
      },
    })

    const data = prestamos.map((p): PrestamoListItem => {
      const movimientos = p.movimientos.map((m) => ({
        tipo: m.tipo,
        monto: decimalANumero(m.monto),
        grupoCategoria: m.categoria.grupo,
      }))

      const montoOriginal = decimalANumero(p.montoOriginal)
      const saldoActual = saldoPrestamo(montoOriginal, movimientos)

      return {
        id: p.id,
        contraparte: p.contraparte,
        fechaDesembolso: p.fechaDesembolso,
        montoOriginal,
        concepto: p.concepto,
        bolsilloOrigen: p.bolsilloOrigen,
        marcadoIncobrable: p.marcadoIncobrable,
        incobrableMotivo: p.incobrableMotivo,
        notas: p.notas,
        saldoActual,
        estado: estadoPrestamo({
          montoOriginal,
          saldo: saldoActual,
          marcadoIncobrable: p.marcadoIncobrable,
        }),
        totalAbonado: totalAbonado(movimientos),
        cantidadAbonos: movimientos.filter(
          (m) => m.grupoCategoria === GrupoCategoria.PRESTAMO_ABONO
        ).length,
      }
    })

    return { success: true, data }
  }
)

/**
 * Crea el préstamo y su movimiento de desembolso en una sola transacción.
 *
 * Van juntos porque un préstamo sin desembolso es un registro que dice que
 * alguien debe plata que nunca salió de ninguna caja.
 */
export async function createPrestamo(
  data: CreatePrestamoInput
): Promise<ActionResponse<{ prestamoId: string }>> {
  const auth = await requireControlAuth()
  if (!auth.authorized) return sinAutorizacion(auth.error)

  const validado = createPrestamoSchema.safeParse(data)
  if (!validado.success) {
    return { success: false, error: validado.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const entrada = validado.data
  const fecha = parseFechaCalendario(entrada.fechaDesembolso)
  const periodo = periodoDeFecha(fecha)

  const categoriaId = await resolverCategoria(GrupoCategoria.PRESTAMO_DESEMBOLSO)
  if (!categoriaId) {
    return {
      success: false,
      error: 'Falta una categoría de grupo PRESTAMO_DESEMBOLSO. Creala antes de registrar préstamos.',
    }
  }

  if (await periodoEstaCerrado(periodo, entrada.bolsilloOrigenId)) {
    return { success: false, error: `El periodo ${periodo} ya está cerrado para ese bolsillo.` }
  }

  const prestamoId = await prisma.$transaction(async (tx) => {
    const prestamo = await tx.prestamo.create({
      data: {
        contraparteId: entrada.contraparteId,
        fechaDesembolso: fecha,
        montoOriginal: entrada.montoOriginal,
        concepto: entrada.concepto,
        bolsilloOrigenId: entrada.bolsilloOrigenId,
        notas: entrada.notas ?? null,
        createdById: auth.userId,
      },
      select: { id: true },
    })

    await tx.movimiento.create({
      data: {
        fecha,
        periodo,
        tipo: TipoMovimiento.EGRESO,
        monto: entrada.montoOriginal,
        concepto: `Desembolso: ${entrada.concepto}`.slice(0, 200),
        bolsilloId: entrada.bolsilloOrigenId,
        categoriaId,
        contraparteId: entrada.contraparteId,
        prestamoId: prestamo.id,
        createdById: auth.userId,
      },
    })

    return prestamo.id
  })

  revalidatePath(RUTA_CONTROL)

  return { success: true, message: 'Préstamo registrado', data: { prestamoId } }
}

/**
 * Registra un abono como movimiento de INGRESO ligado al préstamo.
 *
 * Un abono deducido de un pago "por debajo" se registra igual: el bruto sale
 * como EGRESO y el abono entra como INGRESO. La salida neta de caja queda
 * bien y el préstamo recibe su abono, que en el Excel eran dos anotaciones en
 * hojas distintas que nunca se cruzaban.
 */
export async function abonarPrestamo(
  data: AbonarPrestamoInput
): Promise<ActionResponse<MovimientoListItem>> {
  const auth = await requireControlAuth()
  if (!auth.authorized) return sinAutorizacion(auth.error)

  const validado = abonarPrestamoSchema.safeParse(data)
  if (!validado.success) {
    return { success: false, error: validado.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const entrada = validado.data

  const prestamo = await prisma.prestamo.findUnique({
    where: { id: entrada.prestamoId },
    select: { id: true, concepto: true, contraparteId: true },
  })

  if (!prestamo) {
    return { success: false, error: 'El préstamo no existe' }
  }

  const categoriaId = await resolverCategoria(GrupoCategoria.PRESTAMO_ABONO)
  if (!categoriaId) {
    return {
      success: false,
      error: 'Falta una categoría de grupo PRESTAMO_ABONO. Creala antes de registrar abonos.',
    }
  }

  const fecha = parseFechaCalendario(entrada.fecha)
  const periodo = periodoDeFecha(fecha)

  if (await periodoEstaCerrado(periodo, entrada.bolsilloId)) {
    return { success: false, error: `El periodo ${periodo} ya está cerrado para ese bolsillo.` }
  }

  const movimiento = await prisma.movimiento.create({
    data: {
      fecha,
      periodo,
      tipo: TipoMovimiento.INGRESO,
      monto: entrada.monto,
      concepto: (entrada.concepto || `Abono: ${prestamo.concepto}`).slice(0, 200),
      bolsilloId: entrada.bolsilloId,
      categoriaId,
      contraparteId: prestamo.contraparteId,
      prestamoId: prestamo.id,
      notas: entrada.notas ?? null,
      createdById: auth.userId,
    },
    select: movimientoSelect,
  })

  revalidatePath(RUTA_CONTROL)

  return {
    success: true,
    message: 'Abono registrado',
    data: aMovimientoListItem(movimiento),
  }
}

export async function marcarIncobrable(
  data: MarcarIncobrableInput
): Promise<ActionResponse> {
  const auth = await requireControlAuth()
  if (!auth.authorized) return sinAutorizacion(auth.error)

  const validado = marcarIncobrableSchema.safeParse(data)
  if (!validado.success) {
    return { success: false, error: validado.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const { prestamoId, marcadoIncobrable, motivo } = validado.data

  await prisma.prestamo.update({
    where: { id: prestamoId },
    data: {
      marcadoIncobrable,
      incobrableMotivo: marcadoIncobrable ? (motivo ?? null) : null,
    },
  })

  revalidatePath(RUTA_CONTROL)

  return {
    success: true,
    message: marcadoIncobrable
      ? 'Préstamo marcado como incobrable'
      : 'Préstamo reactivado',
  }
}

// ---------------------------------------------------------------------------
// Servicios referenciados
// ---------------------------------------------------------------------------

export const getServicios = cache(
  async (periodo?: string): Promise<ActionResponse<ServicioReferenciadoListItem[]>> => {
    const auth = await requireControlAuth()
    if (!auth.authorized) return sinAutorizacion(auth.error)

    const servicios = await prisma.servicioReferenciado.findMany({
      where: { periodo },
      orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        fecha: true,
        periodo: true,
        valorFacturado: true,
        valorEntregado: true,
        alegraEstimateId: true,
        notas: true,
        movimientoIngresoId: true,
        movimientoEgresoId: true,
        tipoServicio: { select: { id: true, nombre: true } },
        cliente: { select: { id: true, nombre: true } },
        proveedor: { select: { id: true, nombre: true } },
      },
    })

    const data = servicios.map((s): ServicioReferenciadoListItem => {
      const valorFacturado = decimalANumero(s.valorFacturado)
      const valorEntregado = decimalANumero(s.valorEntregado)

      return {
        id: s.id,
        tipoServicio: s.tipoServicio,
        fecha: s.fecha,
        periodo: s.periodo,
        cliente: s.cliente,
        proveedor: s.proveedor,
        valorFacturado,
        valorEntregado,
        alegraEstimateId: s.alegraEstimateId,
        notas: s.notas,
        margen: margenServicio(valorFacturado, valorEntregado),
        estado: estadoServicio({
          tieneIngreso: s.movimientoIngresoId !== null,
          tieneEgreso: s.movimientoEgresoId !== null,
        }),
        movimientoIngresoId: s.movimientoIngresoId,
        movimientoEgresoId: s.movimientoEgresoId,
      }
    })

    return { success: true, data }
  }
)

export async function createServicio(
  data: CreateServicioInput
): Promise<ActionResponse<{ servicioId: string }>> {
  const auth = await requireControlAuth()
  if (!auth.authorized) return sinAutorizacion(auth.error)

  const validado = createServicioSchema.safeParse(data)
  if (!validado.success) {
    return { success: false, error: validado.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const entrada = validado.data
  const fecha = parseFechaCalendario(entrada.fecha)

  const servicio = await prisma.servicioReferenciado.create({
    data: {
      tipoServicioId: entrada.tipoServicioId,
      fecha,
      periodo: periodoDeFecha(fecha),
      clienteId: entrada.clienteId,
      proveedorId: entrada.proveedorId,
      valorFacturado: entrada.valorFacturado,
      valorEntregado: entrada.valorEntregado,
      alegraEstimateId: entrada.alegraEstimateId ?? null,
      notas: entrada.notas ?? null,
      createdById: auth.userId,
    },
    select: { id: true },
  })

  revalidatePath(RUTA_CONTROL)

  return {
    success: true,
    message: 'Servicio registrado. Falta registrar el cobro y la entrega.',
    data: { servicioId: servicio.id },
  }
}

/**
 * Registra una de las dos patas del servicio como movimiento real de caja.
 *
 * El servicio en sí no mueve plata: lo que la mueve son el cobro al cliente
 * (INGRESO) y la entrega al tercero (EGRESO). Mientras falte una de las dos,
 * el estado lo dice — y con margen cero eso es justamente lo único que
 * importa vigilar.
 */
export async function registrarPataServicio(
  data: RegistrarPataServicioInput
): Promise<ActionResponse<MovimientoListItem>> {
  const auth = await requireControlAuth()
  if (!auth.authorized) return sinAutorizacion(auth.error)

  const validado = registrarPataServicioSchema.safeParse(data)
  if (!validado.success) {
    return { success: false, error: validado.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const entrada = validado.data
  const esIngreso = entrada.pata === 'INGRESO'

  const servicio = await prisma.servicioReferenciado.findUnique({
    where: { id: entrada.servicioId },
    select: {
      id: true,
      valorFacturado: true,
      valorEntregado: true,
      clienteId: true,
      proveedorId: true,
      movimientoIngresoId: true,
      movimientoEgresoId: true,
      tipoServicio: { select: { nombre: true, categoriaId: true } },
    },
  })

  if (!servicio) {
    return { success: false, error: 'El servicio no existe' }
  }

  if (esIngreso && servicio.movimientoIngresoId) {
    return { success: false, error: 'El cobro de ese servicio ya está registrado' }
  }
  if (!esIngreso && servicio.movimientoEgresoId) {
    return { success: false, error: 'La entrega de ese servicio ya está registrada' }
  }

  // La categoría viene del tipo de servicio, no de adivinar por nombre.
  const categoriaId = servicio.tipoServicio.categoriaId

  const fecha = parseFechaCalendario(entrada.fecha)
  const periodo = periodoDeFecha(fecha)

  if (await periodoEstaCerrado(periodo, entrada.bolsilloId)) {
    return { success: false, error: `El periodo ${periodo} ya está cerrado para ese bolsillo.` }
  }

  const monto = decimalANumero(
    esIngreso ? servicio.valorFacturado : servicio.valorEntregado
  )

  if (monto <= 0) {
    return {
      success: false,
      error: esIngreso
        ? 'El servicio se facturó en cero: no hay cobro que registrar'
        : 'El servicio no entrega nada: no hay egreso que registrar',
    }
  }

  const movimiento = await prisma.$transaction(async (tx) => {
    const creado = await tx.movimiento.create({
      data: {
        fecha,
        periodo,
        tipo: esIngreso ? TipoMovimiento.INGRESO : TipoMovimiento.EGRESO,
        monto,
        concepto: `${servicio.tipoServicio.nombre} — ${esIngreso ? 'cobro' : 'entrega'}`.slice(0, 200),
        bolsilloId: entrada.bolsilloId,
        categoriaId,
        contraparteId: esIngreso ? servicio.clienteId : servicio.proveedorId,
        notas: entrada.notas ?? null,
        createdById: auth.userId,
      },
      select: movimientoSelect,
    })

    await tx.servicioReferenciado.update({
      where: { id: servicio.id },
      data: esIngreso
        ? { movimientoIngresoId: creado.id }
        : { movimientoEgresoId: creado.id },
    })

    return creado
  })

  revalidatePath(RUTA_CONTROL)

  return {
    success: true,
    message: esIngreso ? 'Cobro registrado' : 'Entrega registrada',
    data: aMovimientoListItem(movimiento),
  }
}

// ---------------------------------------------------------------------------
// Cierre mensual
// ---------------------------------------------------------------------------

/**
 * Estado de un periodo: saldo de cada bolsillo, calculado desde los
 * movimientos.
 *
 * El saldo inicial NO se lee de una columna digitada: sale del cierre del
 * periodo anterior, y si ese cierre no existe, del cálculo acumulado. Esa es
 * la invariante que el Excel no validaba y que dejó a ADMON abriendo
 * diciembre-2025 con 1.932.660 menos de lo que había cerrado noviembre.
 */
export const getResumenPeriodo = cache(
  async (periodo: string): Promise<ActionResponse<ResumenPeriodo>> => {
    const auth = await requireControlAuth()
    if (!auth.authorized) return sinAutorizacion(auth.error)

    const [bolsillos, movimientos, cierres] = await Promise.all([
      prisma.bolsillo.findMany({
        orderBy: [{ isActive: 'desc' }, { orden: 'asc' }],
        select: { id: true, nombre: true },
      }),
      prisma.movimiento.findMany({
        where: { periodo },
        select: {
          tipo: true,
          monto: true,
          bolsilloId: true,
          bolsilloDestinoId: true,
        },
      }),
      prisma.cierreMensual.findMany({
        where: { periodo },
        select: {
          id: true,
          bolsilloId: true,
          saldoInicial: true,
          saldoFinalReal: true,
          justificacion: true,
          esAperturaInicial: true,
          cerrado: true,
          cerradoEn: true,
        },
      }),
    ])

    const movs: MovimientoParaSaldo[] = movimientos.map((m) => ({
      tipo: m.tipo,
      monto: decimalANumero(m.monto),
      bolsilloId: m.bolsilloId,
      bolsilloDestinoId: m.bolsilloDestinoId,
    }))

    const porBolsillo = new Map(cierres.map((c) => [c.bolsilloId, c]))

    const vistas = bolsillos.map((bolsillo): CierreMensualView => {
      const cierre = porBolsillo.get(bolsillo.id)
      const saldoInicial = cierre ? decimalANumero(cierre.saldoInicial) : 0
      const saldoFinalCalculado = calcularSaldoFinal(saldoInicial, movs, bolsillo.id)
      const saldoFinalReal = cierre
        ? decimalANumeroOpcional(cierre.saldoFinalReal)
        : null

      return {
        id: cierre?.id ?? null,
        periodo,
        bolsillo,
        saldoInicial,
        saldoFinalCalculado,
        saldoFinalReal,
        diferencia: calcularDiferencia(saldoFinalCalculado, saldoFinalReal),
        justificacion: cierre?.justificacion ?? null,
        esAperturaInicial: cierre?.esAperturaInicial ?? false,
        cerrado: cierre?.cerrado ?? false,
        cerradoEn: cierre?.cerradoEn ?? null,
        cantidadMovimientos: movs.filter(
          (m) => m.bolsilloId === bolsillo.id || m.bolsilloDestinoId === bolsillo.id
        ).length,
      }
    })

    return {
      success: true,
      data: {
        periodo,
        cierres: vistas,
        totalIngresos: sumarMontos(
          movs.filter((m) => m.tipo === TipoMovimiento.INGRESO).map((m) => m.monto)
        ),
        totalEgresos: sumarMontos(
          movs.filter((m) => m.tipo === TipoMovimiento.EGRESO).map((m) => m.monto)
        ),
        saldoConsolidado: sumarMontos(vistas.map((v) => v.saldoFinalCalculado)),
        tieneDescuadres: vistas.some(
          (v) => v.diferencia !== null && v.diferencia !== 0 && !v.justificacion
        ),
      },
    }
  }
)

/**
 * Saldo semilla al arrancar el módulo. Es el ÚNICO saldo que se digita en
 * todo el sistema, y solo para el primer periodo de cada bolsillo.
 */
export async function registrarAperturaInicial(
  data: AperturaInicialInput
): Promise<ActionResponse> {
  const auth = await requireControlAuth()
  if (!auth.authorized) return sinAutorizacion(auth.error)

  const validado = aperturaInicialSchema.safeParse(data)
  if (!validado.success) {
    return { success: false, error: validado.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const { periodo, bolsilloId, saldoInicial } = validado.data

  const existente = await prisma.cierreMensual.findUnique({
    where: { periodo_bolsilloId: { periodo, bolsilloId } },
    select: { cerrado: true },
  })

  if (existente?.cerrado) {
    return { success: false, error: 'Ese periodo ya está cerrado para ese bolsillo' }
  }

  await prisma.cierreMensual.upsert({
    where: { periodo_bolsilloId: { periodo, bolsilloId } },
    update: { saldoInicial, esAperturaInicial: true },
    create: {
      periodo,
      bolsilloId,
      saldoInicial,
      // Se guarda igual al inicial: el valor real lo recalcula el cierre.
      saldoFinalCalculado: saldoInicial,
      esAperturaInicial: true,
      createdById: auth.userId,
    },
  })

  revalidatePath(RUTA_CONTROL)

  return { success: true, message: 'Saldo de apertura registrado' }
}

/**
 * Registra el conteo físico y lo compara contra el calculado.
 *
 * El calculado se recalcula acá y se guarda; el real es lo único que entra
 * del operador. Si difieren, la diferencia queda registrada — y la base exige
 * justificación vía el CHECK `cierres_diferencia_justificada`.
 */
export async function registrarConteo(
  data: RegistrarConteoInput
): Promise<ActionResponse<CierreMensualView>> {
  const auth = await requireControlAuth()
  if (!auth.authorized) return sinAutorizacion(auth.error)

  const validado = registrarConteoSchema.safeParse(data)
  if (!validado.success) {
    return { success: false, error: validado.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const { periodo, bolsilloId, saldoFinalReal, justificacion } = validado.data

  const resumen = await getResumenPeriodo(periodo)
  if (!resumen.success || !resumen.data) {
    return { success: false, error: resumen.error ?? 'No se pudo calcular el periodo' }
  }

  const vista = resumen.data.cierres.find((c) => c.bolsillo.id === bolsilloId)
  if (!vista) {
    return { success: false, error: 'El bolsillo no existe' }
  }

  if (vista.cerrado) {
    return { success: false, error: 'Ese periodo ya está cerrado para ese bolsillo' }
  }

  const diferencia = calcularDiferencia(vista.saldoFinalCalculado, saldoFinalReal)

  if (diferencia !== null && diferencia !== 0 && !justificacion?.trim()) {
    return {
      success: false,
      error: `El conteo no coincide con lo calculado (diferencia de ${diferencia}). Explicá a qué se debe.`,
    }
  }

  await prisma.cierreMensual.upsert({
    where: { periodo_bolsilloId: { periodo, bolsilloId } },
    update: {
      saldoFinalCalculado: vista.saldoFinalCalculado,
      saldoFinalReal,
      diferencia,
      justificacion: justificacion?.trim() || null,
    },
    create: {
      periodo,
      bolsilloId,
      saldoInicial: vista.saldoInicial,
      saldoFinalCalculado: vista.saldoFinalCalculado,
      saldoFinalReal,
      diferencia,
      justificacion: justificacion?.trim() || null,
      createdById: auth.userId,
    },
  })

  revalidatePath(RUTA_CONTROL)

  return {
    success: true,
    message: 'Conteo registrado',
    data: { ...vista, saldoFinalReal, diferencia, justificacion: justificacion ?? null },
  }
}

/**
 * Cierra un periodo para un bolsillo y siembra la apertura del siguiente.
 *
 * Sembrar el saldo inicial del mes que viene es lo que hace cumplir la
 * invariante `apertura(mes N) == cierre(mes N-1)`. En el Excel esa invariante
 * no existía y cada mes podía arrancar de cualquier número.
 */
export async function cerrarPeriodo(
  data: CerrarPeriodoInput
): Promise<ActionResponse> {
  const auth = await requireControlAuth()
  if (!auth.authorized) return sinAutorizacion(auth.error)

  const validado = cerrarPeriodoSchema.safeParse(data)
  if (!validado.success) {
    return { success: false, error: validado.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const { periodo, bolsilloId } = validado.data

  const resumen = await getResumenPeriodo(periodo)
  if (!resumen.success || !resumen.data) {
    return { success: false, error: resumen.error ?? 'No se pudo calcular el periodo' }
  }

  const vista = resumen.data.cierres.find((c) => c.bolsillo.id === bolsilloId)
  if (!vista) {
    return { success: false, error: 'El bolsillo no existe' }
  }

  if (vista.cerrado) {
    return { success: false, error: 'Ese periodo ya estaba cerrado' }
  }

  if (vista.diferencia !== null && vista.diferencia !== 0 && !vista.justificacion) {
    return {
      success: false,
      error: 'No se puede cerrar con una diferencia sin justificar',
    }
  }

  const [anio, mes] = periodo.split('-').map(Number)
  const siguiente =
    mes === 12 ? `${anio + 1}-01` : `${anio}-${String(mes + 1).padStart(2, '0')}`

  await prisma.$transaction([
    prisma.cierreMensual.upsert({
      where: { periodo_bolsilloId: { periodo, bolsilloId } },
      update: {
        saldoFinalCalculado: vista.saldoFinalCalculado,
        cerrado: true,
        cerradoEn: new Date(),
        cerradoById: auth.userId,
      },
      create: {
        periodo,
        bolsilloId,
        saldoInicial: vista.saldoInicial,
        saldoFinalCalculado: vista.saldoFinalCalculado,
        cerrado: true,
        cerradoEn: new Date(),
        cerradoById: auth.userId,
        createdById: auth.userId,
      },
    }),
    // La apertura del mes siguiente ES el cierre de este. No se digita.
    prisma.cierreMensual.upsert({
      where: { periodo_bolsilloId: { periodo: siguiente, bolsilloId } },
      update: { saldoInicial: vista.saldoFinalCalculado },
      create: {
        periodo: siguiente,
        bolsilloId,
        saldoInicial: vista.saldoFinalCalculado,
        saldoFinalCalculado: vista.saldoFinalCalculado,
        createdById: auth.userId,
      },
    }),
  ])

  revalidatePath(RUTA_CONTROL)

  return {
    success: true,
    message: `Periodo ${periodo} cerrado. La apertura de ${siguiente} quedó en ${vista.saldoFinalCalculado}.`,
  }
}
