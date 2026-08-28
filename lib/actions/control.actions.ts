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
/**
 * Único punto donde Control mira hacia Alegra.
 *
 * No rompe la separación de los dos libros: acá NO se suman totales de uno con
 * el otro. Se lee un documento de Alegra para poder registrar, en Control, el
 * ingreso de plata que ese documento originó. La referencia queda guardada en
 * `Movimiento.alegraEstimateId`, que es un puntero, no una consolidación.
 */
import {
  getCachedEstimate,
  getCachedEstimatesInRange,
  getCachedInvoice,
  getCachedInvoices,
  getCachedItems,
} from '@/lib/alegra/cache'
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
  type ServicioAlegraListItem,
  type SincronizacionServiciosResultado,
  type MovimientoListItem,
  type PrestamoListItem,
  type ServicioReferenciadoListItem,
  type CierreMensualView,
  type ResumenPeriodo,
  type ReporteAnual,
  type MovimientosPaginados,
  type FilaAgrupada,
  type CotizacionParaIngreso,
  type CotizacionesDelPeriodo,
  type FacturaParaIngreso,
  type FacturasDelPeriodo,
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
  contrastarIntermediados,
  ingresoPorServicio,
  ingresosPorNaturaleza,
  repartirEntreServicios,
  sumarMontos,
  type LineaDeDocumento,
  type DetalleParaReporte,
  type MovimientoParaContraste,
  type MovimientoParaNaturaleza,
  type MovimientoParaSaldo,
} from '@/lib/utils/control-ledger'
import {
  createBolsilloSchema,
  createCategoriaSchema,
  createTipoServicioSchema,
  toggleCatalogoSchema,
  toggleServicioEnTransitoSchema,
  asignarCategoriaEgresoSchema,
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
  type CreateBolsilloInput,
  type CreateCategoriaInput,
  type CreateTipoServicioInput,
  type ToggleCatalogoInput,
  type ToggleServicioEnTransitoInput,
  type AsignarCategoriaEgresoInput,
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
  // Con solo el id, la fila sabe que hay un préstamo pero no cuál. Si a la
  // misma persona se le prestó dos veces, un abono no se puede rastrear.
  prestamo: {
    select: {
      id: true,
      concepto: true,
      fechaDesembolso: true,
      contraparte: { select: { nombre: true } },
    },
  },
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
    prestamo: row.prestamo
      ? {
          id: row.prestamo.id,
          concepto: row.prestamo.concepto,
          fechaDesembolso: row.prestamo.fechaDesembolso,
          contraparte: row.prestamo.contraparte.nombre,
        }
      : null,
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
  async (incluirInactivas = false): Promise<ActionResponse<CategoriaListItem[]>> => {
    const auth = await requireControlAuth()
    if (!auth.authorized) return sinAutorizacion(auth.error)

    const categorias = await prisma.categoriaMovimiento.findMany({
      where: incluirInactivas ? undefined : { isActive: true },
      orderBy: [{ grupo: 'asc' }, { nombre: 'asc' }],
      select: { id: true, nombre: true, grupo: true, isActive: true },
    })

    return { success: true, data: categorias }
  }
)

export const getTiposServicio = cache(
  async (incluirInactivos = false): Promise<ActionResponse<TipoServicioListItem[]>> => {
    const auth = await requireControlAuth()
    if (!auth.authorized) return sinAutorizacion(auth.error)

    const tipos = await prisma.tipoServicioReferenciado.findMany({
      where: incluirInactivos ? undefined : { isActive: true },
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
// Servicios de Alegra — el catálogo de "qué se vendió"
// ---------------------------------------------------------------------------
//
// Dimensión distinta de CategoriaMovimiento, no un reemplazo. La categoría
// dice qué naturaleza de plata es un movimiento; el servicio dice por qué se
// cobró. Un mismo documento de Alegra puede tener varias líneas y por lo tanto
// varios servicios, así que esto NUNCA podría vivir en el FK único de
// categoría.

const servicioAlegraSelect = {
  id: true,
  alegraItemId: true,
  nombre: true,
  referencia: true,
  descripcion: true,
  enTransito: true,
  categoriaEgreso: { select: { id: true, nombre: true } },
  isActive: true,
  sincronizadoEn: true,
} satisfies Prisma.ServicioAlegraSelect

export const getServiciosAlegra = cache(
  async (
    incluirInactivos = false
  ): Promise<ActionResponse<ServicioAlegraListItem[]>> => {
    const auth = await requireControlAuth()
    if (!auth.authorized) return sinAutorizacion(auth.error)

    const servicios = await prisma.servicioAlegra.findMany({
      where: incluirInactivos ? undefined : { isActive: true },
      orderBy: [{ isActive: 'desc' }, { nombre: 'asc' }],
      select: servicioAlegraSelect,
    })

    return { success: true, data: servicios }
  }
)

/**
 * Servicios que Alegra marca como plata en tránsito y por lo tanto NO son
 * ingreso de Admon.
 *
 * Se siembra en la primera sincronización a partir de la referencia del item.
 * Es la única heurística del archivo y está acotada a propósito: solo aplica
 * al CREAR, nunca al actualizar, así que si alguien lo cambia desde la UI la
 * sincronización siguiente respeta esa decisión.
 */
const REFERENCIAS_EN_TRANSITO = new Set([
  '02', // Recaudo para Terceros — se cobra y se gira a la EPS / pensión.
  '19', // Servicios de Mensajería — se cobra y se le paga a Fawer.
])

/**
 * Sincroniza el catálogo local contra /items de Alegra.
 *
 * Qué hace y por qué:
 *
 * - Descarta todo lo que no sea `type: 'service'`. La cuenta tiene ocho
 *   productos que no son de este negocio (`PISO PARED PIEMONTE`, `SIKA 100
 *   MORTERO`, `POLO FEM`) y no tienen nada que hacer en un catálogo de
 *   servicios cobrados.
 *
 * - Empareja por `alegraItemId`, no por nombre. El nombre se corrige desde
 *   Alegra y el vínculo no debe romperse por una tilde.
 *
 * - Lo que ya no está en Alegra se DESACTIVA, no se borra: los movimientos
 *   históricos van a apuntar acá.
 *
 * - Nunca pisa `enTransito` de un registro existente. Eso lo decide el
 *   negocio, no el catálogo de allá.
 */
export async function sincronizarServiciosAlegra(): Promise<
  ActionResponse<SincronizacionServiciosResultado>
> {
  const auth = await requireControlAuth()
  if (!auth.authorized) return sinAutorizacion(auth.error)

  // El catálogo entero entra en una página (30 items al momento de escribir
  // esto), pero se pagina igual: que hoy quepa no es una garantía, y quedarse
  // con la primera página desactivaría en silencio todo lo que quedó afuera.
  const TAMANO = 30
  const MAX_PAGINAS = 20

  const crudos: Awaited<ReturnType<typeof getCachedItems>>['data'] = []

  try {
    for (let pagina = 0; pagina < MAX_PAGINAS; pagina += 1) {
      const lote = await getCachedItems({
        start: pagina * TAMANO,
        limit: TAMANO,
      })
      crudos.push(...lote.data)
      if (lote.data.length < TAMANO) break
    }
  } catch (error) {
    console.error('[control] sincronizarServiciosAlegra:', error)
    return {
      success: false,
      error: 'No se pudo consultar el catálogo de Alegra. Volvé a intentar en un momento.',
    }
  }

  const servicios = crudos.filter((item) => item.type === 'service')
  const descartados = crudos.length - servicios.length

  if (servicios.length === 0) {
    // Sin esta guarda, una respuesta vacía o degradada de Alegra apagaría el
    // catálogo entero de un saque.
    return {
      success: false,
      error: 'Alegra no devolvió ningún servicio. No se tocó el catálogo.',
    }
  }

  const ahora = new Date()
  const existentes = await prisma.servicioAlegra.findMany({
    select: { id: true, alegraItemId: true, isActive: true },
  })
  const porItemId = new Map(existentes.map((s) => [s.alegraItemId, s]))

  let creados = 0
  let actualizados = 0

  for (const item of servicios) {
    const referencia = item.reference?.trim() || null
    const comunes = {
      nombre: item.name,
      referencia,
      descripcion: item.description?.trim() || null,
      isActive: item.status !== 'inactive',
      sincronizadoEn: ahora,
    }

    if (porItemId.has(item.id)) {
      await prisma.servicioAlegra.update({
        where: { alegraItemId: item.id },
        data: comunes,
      })
      actualizados += 1
    } else {
      await prisma.servicioAlegra.create({
        data: {
          alegraItemId: item.id,
          enTransito: referencia !== null && REFERENCIAS_EN_TRANSITO.has(referencia),
          ...comunes,
        },
      })
      creados += 1
    }
  }

  // Lo que desapareció de Alegra se apaga. Solo se cuentan los que estaban
  // encendidos para no reportar como novedad algo ya apagado.
  const vistos = new Set(servicios.map((item) => item.id))
  const aDesactivar = existentes.filter((s) => s.isActive && !vistos.has(s.alegraItemId))

  if (aDesactivar.length > 0) {
    await prisma.servicioAlegra.updateMany({
      where: { id: { in: aDesactivar.map((s) => s.id) } },
      data: { isActive: false },
    })
  }

  const catalogo = await prisma.servicioAlegra.findMany({
    orderBy: [{ isActive: 'desc' }, { nombre: 'asc' }],
    select: servicioAlegraSelect,
  })

  revalidatePath(RUTA_CONTROL)

  return {
    success: true,
    message: `${creados} nuevos, ${actualizados} actualizados`,
    data: {
      creados,
      actualizados,
      desactivados: aDesactivar.length,
      descartados,
      servicios: catalogo,
    },
  }
}

/**
 * Dice por qué categoría sale la plata de un servicio en tránsito.
 *
 * Es lo que permite contrastar, mes a mes, lo que entró contra lo que salió.
 * Sin el vínculo, "entra y vuelve a salir" es una afirmación que nadie puede
 * verificar.
 */
export async function setCategoriaEgresoDeServicio(
  data: AsignarCategoriaEgresoInput
): Promise<ActionResponse> {
  const auth = await requireControlAuth()
  if (!auth.authorized) return sinAutorizacion(auth.error)

  const validado = asignarCategoriaEgresoSchema.safeParse(data)
  if (!validado.success) return { success: false, error: 'Datos inválidos' }

  await prisma.servicioAlegra.update({
    where: { id: validado.data.id },
    data: { categoriaEgresoId: validado.data.categoriaEgresoId },
  })

  revalidatePath(RUTA_CONTROL)

  return {
    success: true,
    message: validado.data.categoriaEgresoId
      ? 'Categoría de egreso asignada'
      : 'Vínculo quitado',
  }
}

export async function setServicioAlegraActivo(
  data: ToggleCatalogoInput
): Promise<ActionResponse> {
  const auth = await requireControlAuth()
  if (!auth.authorized) return sinAutorizacion(auth.error)

  const validado = toggleCatalogoSchema.safeParse(data)
  if (!validado.success) return { success: false, error: 'Datos inválidos' }

  await prisma.servicioAlegra.update({
    where: { id: validado.data.id },
    data: { isActive: validado.data.isActive },
  })

  revalidatePath(RUTA_CONTROL)

  return { success: true, message: 'Listo' }
}

/**
 * Declara si la plata de un servicio es ingreso o solo pasa.
 *
 * Va en action propia y no en el toggle genérico porque no es higiene de
 * catálogo: cambia lo que el libro considera ganado.
 */
export async function setServicioAlegraEnTransito(
  data: ToggleServicioEnTransitoInput
): Promise<ActionResponse> {
  const auth = await requireControlAuth()
  if (!auth.authorized) return sinAutorizacion(auth.error)

  const validado = toggleServicioEnTransitoSchema.safeParse(data)
  if (!validado.success) return { success: false, error: 'Datos inválidos' }

  await prisma.servicioAlegra.update({
    where: { id: validado.data.id },
    data: { enTransito: validado.data.enTransito },
  })

  revalidatePath(RUTA_CONTROL)

  return {
    success: true,
    message: validado.data.enTransito
      ? 'Marcado como plata en tránsito'
      : 'Marcado como ingreso',
  }
}

export async function createBolsillo(
  data: CreateBolsilloInput
): Promise<ActionResponse<BolsilloListItem>> {
  const auth = await requireControlAuth()
  if (!auth.authorized) return sinAutorizacion(auth.error)

  const validado = createBolsilloSchema.safeParse(data)
  if (!validado.success) {
    return { success: false, error: validado.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const { nombre } = validado.data

  const existente = await prisma.bolsillo.findFirst({
    where: { nombre: { equals: nombre, mode: 'insensitive' } },
    select: { nombre: true },
  })

  if (existente) {
    return { success: false, error: `Ya existe un bolsillo llamado "${existente.nombre}"` }
  }

  const bolsillo = await prisma.bolsillo.create({
    data: validado.data,
    select: {
      id: true,
      nombre: true,
      tipo: true,
      orden: true,
      isActive: true,
      cerradoEn: true,
    },
  })

  revalidatePath(RUTA_CONTROL)

  return { success: true, message: 'Bolsillo creado', data: bolsillo }
}

/**
 * Cierra o reabre un bolsillo.
 *
 * Nunca se borra: sus movimientos históricos apuntan acá y tienen que poder
 * seguir existiendo. Cerrarlo solo lo saca de los selectores.
 */
export async function setBolsilloActivo(
  data: ToggleCatalogoInput
): Promise<ActionResponse> {
  const auth = await requireControlAuth()
  if (!auth.authorized) return sinAutorizacion(auth.error)

  const validado = toggleCatalogoSchema.safeParse(data)
  if (!validado.success) {
    return { success: false, error: 'Datos inválidos' }
  }

  const { id, isActive } = validado.data

  await prisma.bolsillo.update({
    where: { id },
    data: { isActive, cerradoEn: isActive ? null : new Date() },
  })

  revalidatePath(RUTA_CONTROL)

  return { success: true, message: isActive ? 'Bolsillo reabierto' : 'Bolsillo cerrado' }
}

export async function createTipoServicio(
  data: CreateTipoServicioInput
): Promise<ActionResponse<TipoServicioListItem>> {
  const auth = await requireControlAuth()
  if (!auth.authorized) return sinAutorizacion(auth.error)

  const validado = createTipoServicioSchema.safeParse(data)
  if (!validado.success) {
    return { success: false, error: validado.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const { nombre, categoriaId } = validado.data

  const existente = await prisma.tipoServicioReferenciado.findFirst({
    where: { nombre: { equals: nombre, mode: 'insensitive' } },
    select: { nombre: true },
  })

  if (existente) {
    return { success: false, error: `Ya existe un servicio llamado "${existente.nombre}"` }
  }

  const tipo = await prisma.tipoServicioReferenciado.create({
    data: { nombre, categoriaId },
    select: {
      id: true,
      nombre: true,
      isActive: true,
      categoria: { select: { id: true, nombre: true } },
    },
  })

  revalidatePath(RUTA_CONTROL)

  return { success: true, message: 'Tipo de servicio creado', data: tipo }
}

export async function setTipoServicioActivo(
  data: ToggleCatalogoInput
): Promise<ActionResponse> {
  const auth = await requireControlAuth()
  if (!auth.authorized) return sinAutorizacion(auth.error)

  const validado = toggleCatalogoSchema.safeParse(data)
  if (!validado.success) return { success: false, error: 'Datos inválidos' }

  await prisma.tipoServicioReferenciado.update({
    where: { id: validado.data.id },
    data: { isActive: validado.data.isActive },
  })

  revalidatePath(RUTA_CONTROL)

  return { success: true, message: 'Listo' }
}

export async function setCategoriaActiva(
  data: ToggleCatalogoInput
): Promise<ActionResponse> {
  const auth = await requireControlAuth()
  if (!auth.authorized) return sinAutorizacion(auth.error)

  const validado = toggleCatalogoSchema.safeParse(data)
  if (!validado.success) return { success: false, error: 'Datos inválidos' }

  await prisma.categoriaMovimiento.update({
    where: { id: validado.data.id },
    data: { isActive: validado.data.isActive },
  })

  revalidatePath(RUTA_CONTROL)

  return { success: true, message: 'Listo' }
}

export async function setContraparteActiva(
  data: ToggleCatalogoInput
): Promise<ActionResponse> {
  const auth = await requireControlAuth()
  if (!auth.authorized) return sinAutorizacion(auth.error)

  const validado = toggleCatalogoSchema.safeParse(data)
  if (!validado.success) return { success: false, error: 'Datos inválidos' }

  await prisma.contraparte.update({
    where: { id: validado.data.id },
    data: { isActive: validado.data.isActive },
  })

  revalidatePath(RUTA_CONTROL)

  return { success: true, message: 'Listo' }
}

/**
 * Crea una categoría desde el formulario de movimiento.
 *
 * El `grupo` es obligatorio y no se puede inferir del nombre: es lo único que
 * evita que el catálogo degenere. El Excel que este módulo reemplaza tenía 93
 * conceptos distintos en una columna donde nadie clasificaba nada, y por eso
 * era imposible preguntarle cuánto se gastó en transporte.
 *
 * El nombre se compara sin distinguir mayúsculas para no terminar con
 * "Papelería" y "PAPELERIA" como dos categorías.
 */
export async function createCategoria(
  data: CreateCategoriaInput
): Promise<ActionResponse<CategoriaListItem>> {
  const auth = await requireControlAuth()
  if (!auth.authorized) return sinAutorizacion(auth.error)

  const validado = createCategoriaSchema.safeParse(data)
  if (!validado.success) {
    return { success: false, error: validado.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const { nombre, grupo } = validado.data

  const existente = await prisma.categoriaMovimiento.findFirst({
    where: { nombre: { equals: nombre, mode: 'insensitive' } },
    select: { id: true, nombre: true, grupo: true, isActive: true },
  })

  if (existente) {
    // No es un error: lo que el operador quiere es usarla, y ya existe.
    // Devolverla evita que invente una variante para esquivar el mensaje.
    return {
      success: true,
      message: `"${existente.nombre}" ya existía y quedó seleccionada`,
      data: existente,
    }
  }

  const categoria = await prisma.categoriaMovimiento.create({
    data: { nombre, grupo },
    select: { id: true, nombre: true, grupo: true, isActive: true },
  })

  revalidatePath(RUTA_CONTROL)

  return { success: true, message: 'Categoría creada', data: categoria }
}

// ---------------------------------------------------------------------------
// Contrapartes
// ---------------------------------------------------------------------------

export const getContrapartes = cache(
  async (incluirInactivas = false): Promise<ActionResponse<ContraparteListItem[]>> => {
    const auth = await requireControlAuth()
    if (!auth.authorized) return sinAutorizacion(auth.error)

    const contrapartes = await prisma.contraparte.findMany({
      where: incluirInactivas ? undefined : { isActive: true },
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
    categoriaId?: string
    contraparteId?: string
    /**
     * Movimientos de UN préstamo: sus desembolsos y sus abonos.
     *
     * Es lo que hace auditable el saldo. Sin esto, la pantalla de préstamos
     * dice "Abonado $400.000 (2)" y no hay forma de ver cuáles dos.
     */
    prestamoId?: string
    /** Busca en el concepto y en las notas, sin distinguir mayúsculas. */
    buscar?: string
    page?: number
    pageSize?: number
  }): Promise<ActionResponse<MovimientosPaginados>> => {
    const auth = await requireControlAuth()
    if (!auth.authorized) return sinAutorizacion(auth.error)

    const page = Math.max(1, filtros?.page ?? 1)
    const pageSize = Math.min(200, Math.max(10, filtros?.pageSize ?? 25))
    const buscar = filtros?.buscar?.trim()

    const where: Prisma.MovimientoWhereInput = {
      periodo: filtros?.periodo,
      categoriaId: filtros?.categoriaId,
      contraparteId: filtros?.contraparteId,
      prestamoId: filtros?.prestamoId,
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
      ...(buscar
        ? {
            AND: [
              {
                OR: [
                  { concepto: { contains: buscar, mode: 'insensitive' } },
                  { notas: { contains: buscar, mode: 'insensitive' } },
                ],
              },
            ],
          }
        : {}),
    }

    const [movimientos, totalCount, agregado] = await Promise.all([
      prisma.movimiento.findMany({
        where,
        orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: movimientoSelect,
      }),
      prisma.movimiento.count({ where }),
      // Suma de TODO lo filtrado, no solo de la página. Si el total cambiara
      // al pasar de página, nadie volvería a confiar en el número.
      prisma.movimiento.aggregate({ where, _sum: { monto: true } }),
    ])

    const items = movimientos.map(aMovimientoListItem)

    return {
      success: true,
      data: {
        items,
        page,
        pageSize,
        totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
        sumaPagina: sumarMontos(items.map((m) => m.monto)),
        sumaFiltrada: agregado._sum.monto ? decimalANumero(agregado._sum.monto) : 0,
      },
    }
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
      // Un cobro manual es el caso particular del general: UNA línea de
      // desglose con el monto entero. Escribe en la misma tabla que el
      // importador de Alegra, para que haya un solo lugar del que leer.
      ...(entrada.servicioAlegraId
        ? {
            detalleServicios: {
              create: [
                { servicioAlegraId: entrada.servicioAlegraId, monto: entrada.monto },
              ],
            },
          }
        : {}),
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
      // El desglose se espeja: si no, un movimiento anulado seguiría contando
      // entero en el reporte por servicio.
      detalleServicios: { select: { servicioAlegraId: true, monto: true } },
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
      ...(original.detalleServicios.length > 0
        ? {
            detalleServicios: {
              create: original.detalleServicios.map((d) => ({
                servicioAlegraId: d.servicioAlegraId,
                monto: decimalANumero(d.monto),
              })),
            },
          }
        : {}),
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

    const [bolsillos, movimientos, cierres, aperturas, anteriores] = await Promise.all([
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
          // El grupo separa "por debajo" (C) de "por arriba" (F); el nombre
          // arma el desglose de "otros", que sin él no se puede cuadrar.
          categoria: { select: { nombre: true, grupo: true } },
          // Para separar lo ganado de lo que solo pasó. NO entra en el cálculo
          // del saldo: la plata en tránsito entró al bolsillo de verdad.
          detalleServicios: {
            select: { monto: true, servicio: { select: { enTransito: true } } },
          },
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
      // Saldo semilla de cada bolsillo: el único que se digitó alguna vez.
      prisma.cierreMensual.findMany({
        where: { esAperturaInicial: true },
        select: { bolsilloId: true, saldoInicial: true },
      }),
      /**
       * Todo lo movido ANTES de este periodo.
       *
       * Sin esto, un mes al que no se le cerró el anterior arrancaba en cero y
       * todos los saldos daban negativo. Cerrar un periodo siembra la apertura
       * del siguiente, pero eso no puede ser un requisito para poder MIRAR un
       * mes: el saldo inicial es, por definición, lo acumulado hasta ahí.
       *
       * `periodo` es "AAAA-MM", así que la comparación de textos ordena bien.
       */
      prisma.movimiento.findMany({
        where: { periodo: { lt: periodo } },
        select: {
          tipo: true,
          monto: true,
          bolsilloId: true,
          bolsilloDestinoId: true,
        },
      }),
    ])

    const movs: MovimientoParaSaldo[] = movimientos.map((m) => ({
      tipo: m.tipo,
      monto: decimalANumero(m.monto),
      bolsilloId: m.bolsilloId,
      bolsilloDestinoId: m.bolsilloDestinoId,
    }))

    const previos: MovimientoParaSaldo[] = anteriores.map((m) => ({
      tipo: m.tipo,
      monto: decimalANumero(m.monto),
      bolsilloId: m.bolsilloId,
      bolsilloDestinoId: m.bolsilloDestinoId,
    }))

    const porBolsillo = new Map(cierres.map((c) => [c.bolsilloId, c]))
    const semillas = new Map(
      aperturas.map((a) => [a.bolsilloId, decimalANumero(a.saldoInicial)])
    )

    const vistas = bolsillos.map((bolsillo): CierreMensualView => {
      const cierre = porBolsillo.get(bolsillo.id)

      /**
       * El saldo inicial se toma del registro solo cuando ese registro es una
       * verdad declarada: la apertura semilla, o un periodo ya cerrado. En
       * cualquier otro caso se calcula acumulando desde la semilla, para que
       * un mes abierto no dependa de que alguien haya cerrado el anterior.
       */
      const declarado =
        cierre && (cierre.esAperturaInicial || cierre.cerrado)
          ? decimalANumero(cierre.saldoInicial)
          : null

      const saldoInicial =
        declarado ??
        calcularSaldoFinal(semillas.get(bolsillo.id) ?? 0, previos, bolsillo.id)

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

    const totalIngresos = sumarMontos(
      movs.filter((m) => m.tipo === TipoMovimiento.INGRESO).map((m) => m.monto)
    )

    const paraNaturaleza: MovimientoParaNaturaleza[] = movimientos.map((m) => ({
      tipo: m.tipo,
      grupo: m.categoria.grupo,
      categoria: m.categoria.nombre,
      monto: decimalANumero(m.monto),
      detalles: m.detalleServicios.map((d) => ({
        monto: decimalANumero(d.monto),
        enTransito: d.servicio.enTransito,
      })),
    }))

    const detallesDelPeriodo: DetalleParaReporte[] = movimientos.flatMap((m) =>
      m.detalleServicios.map((d) => ({
        tipo: m.tipo,
        monto: decimalANumero(d.monto),
        enTransito: d.servicio.enTransito,
      }))
    )

    return {
      success: true,
      data: {
        periodo,
        cierres: vistas,
        totalIngresos,
        totalEgresos: sumarMontos(
          movs.filter((m) => m.tipo === TipoMovimiento.EGRESO).map((m) => m.monto)
        ),
        ingresos: ingresosPorNaturaleza(paraNaturaleza),
        ingresoNeto: ingresoPorServicio(totalIngresos, detallesDelPeriodo),
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

// ---------------------------------------------------------------------------
// Reporte anual
// ---------------------------------------------------------------------------

/**
 * Corta el año completo por mes, por categoría, por contraparte y por bolsillo.
 *
 * Es la vista que el Excel no podía dar. No por falta de datos, sino porque el
 * "quién" y el "qué" vivían en la misma columna: preguntarle cuánto se le
 * compró a Burbuja en el año, o cuánto se gastó en transporte, no tenía
 * respuesta posible.
 *
 * Los TRASLADOS se excluyen de ingresos y egresos a propósito: mover plata de
 * un bolsillo a otro no es ni una cosa ni la otra, y contarlos inflaría los dos
 * lados por el mismo monto.
 */
export const getReporteAnual = cache(
  async (anio: number): Promise<ActionResponse<ReporteAnual>> => {
    const auth = await requireControlAuth()
    if (!auth.authorized) return sinAutorizacion(auth.error)

    const [movimientos, todosLosPeriodos, enTransito] = await Promise.all([
      prisma.movimiento.findMany({
        where: { periodo: { startsWith: `${anio}-` } },
        select: {
          tipo: true,
          monto: true,
          periodo: true,
          bolsillo: { select: { id: true, nombre: true } },
          categoria: { select: { id: true, nombre: true, grupo: true } },
          contraparte: { select: { id: true, nombre: true } },
          // Por qué entró la plata. Solo lo tienen los movimientos importados
          // (o cargados) con desglose; el resto queda fuera de este corte y se
          // informa en `ingresoNeto.sinDesglose`.
          categoriaId: true,
          detalleServicios: {
            select: {
              monto: true,
              servicio: {
                select: { id: true, nombre: true, referencia: true, enTransito: true },
              },
            },
          },
        },
      }),
      prisma.movimiento.findMany({
        distinct: ['periodo'],
        select: { periodo: true },
        orderBy: { periodo: 'asc' },
      }),
      // Los servicios cuya plata "entra y vuelve a salir". Se leen aunque
      // estén inactivos: un servicio que se dejó de vender igual tuvo
      // movimiento en el año que se está mirando.
      prisma.servicioAlegra.findMany({
        where: { enTransito: true },
        select: {
          id: true,
          nombre: true,
          categoriaEgresoId: true,
          categoriaEgreso: { select: { nombre: true } },
        },
        orderBy: { nombre: 'asc' },
      }),
    ])

    interface Acumulador {
      nombre: string
      detalle?: string
      cantidad: number
      ingresos: number[]
      egresos: number[]
    }

    const nuevo = (nombre: string, detalle?: string): Acumulador => ({
      nombre,
      detalle,
      cantidad: 0,
      ingresos: [],
      egresos: [],
    })

    const porCategoria = new Map<string, Acumulador>()
    const porContraparte = new Map<string, Acumulador>()
    const porBolsillo = new Map<string, Acumulador>()
    const porServicio = new Map<string, Acumulador>()
    const porMes = new Map<string, Acumulador>()
    const detalles: DetalleParaReporte[] = []
    // Los ingresos C y F por mes. Van aparte del acumulador genérico porque
    // ese no distingue naturaleza: solo suma ingresos contra egresos.
    const naturalezaPorMes = new Map<string, MovimientoParaNaturaleza[]>()
    const paraNaturaleza: MovimientoParaNaturaleza[] = []
    const paraContraste: MovimientoParaContraste[] = []

    function acumular(
      mapa: Map<string, Acumulador>,
      id: string,
      nombre: string,
      tipo: TipoMovimiento,
      monto: number,
      detalle?: string
    ) {
      const acc = mapa.get(id) ?? nuevo(nombre, detalle)
      acc.cantidad++
      if (tipo === TipoMovimiento.INGRESO) acc.ingresos.push(monto)
      else if (tipo === TipoMovimiento.EGRESO) acc.egresos.push(monto)
      mapa.set(id, acc)
    }

    for (const m of movimientos) {
      const monto = decimalANumero(m.monto)

      const paraM: MovimientoParaNaturaleza = {
        tipo: m.tipo,
        grupo: m.categoria.grupo,
        categoria: m.categoria.nombre,
        monto,
        detalles: m.detalleServicios.map((d) => ({
          monto: decimalANumero(d.monto),
          enTransito: d.servicio.enTransito,
        })),
      }
      paraNaturaleza.push(paraM)
      paraContraste.push({
        periodo: m.periodo,
        tipo: m.tipo,
        monto,
        categoriaId: m.categoriaId,
        detalles: m.detalleServicios.map((d) => ({
          servicioAlegraId: d.servicio.id,
          monto: decimalANumero(d.monto),
        })),
      })
      naturalezaPorMes.set(m.periodo, [...(naturalezaPorMes.get(m.periodo) ?? []), paraM])

      acumular(porMes, m.periodo, m.periodo, m.tipo, monto)
      acumular(porBolsillo, m.bolsillo.id, m.bolsillo.nombre, m.tipo, monto)
      acumular(
        porCategoria,
        m.categoria.id,
        m.categoria.nombre,
        m.tipo,
        monto,
        m.categoria.grupo
      )
      if (m.contraparte) {
        acumular(porContraparte, m.contraparte.id, m.contraparte.nombre, m.tipo, monto)
      }

      for (const d of m.detalleServicios) {
        const parte = decimalANumero(d.monto)
        acumular(
          porServicio,
          d.servicio.id,
          d.servicio.nombre,
          m.tipo,
          parte,
          d.servicio.enTransito ? 'En tránsito' : (d.servicio.referencia ?? undefined)
        )
        detalles.push({
          tipo: m.tipo,
          monto: parte,
          enTransito: d.servicio.enTransito,
        })
      }
    }

    const aFilas = (mapa: Map<string, Acumulador>): FilaAgrupada[] =>
      [...mapa.entries()]
        .map(([id, a]) => {
          const ingresos = sumarMontos(a.ingresos)
          const egresos = sumarMontos(a.egresos)
          return {
            id,
            nombre: a.nombre,
            detalle: a.detalle,
            cantidad: a.cantidad,
            ingresos,
            egresos,
            neto: sumarMontos([ingresos, -egresos]),
          }
        })
        // De mayor a menor movimiento: lo que más pesa, primero.
        .sort((x, y) => y.ingresos + y.egresos - (x.ingresos + x.egresos))

    const meses = [...porMes.entries()]
      .map(([periodo, a]) => {
        const ingresos = sumarMontos(a.ingresos)
        const egresos = sumarMontos(a.egresos)
        // En BRUTO: esta tabla es un flujo de caja y su `neto` significa
        // ingresos − egresos. Descontar el tránsito solo en una columna
        // cambiaría en silencio lo que significa la otra.
        const delMes = ingresosPorNaturaleza(naturalezaPorMes.get(periodo) ?? [])
        return {
          periodo,
          cantidad: a.cantidad,
          ingresos,
          ingresosCotizacion: delMes.cotizacion.bruto,
          ingresosFactura: delMes.factura.bruto,
          ingresosOtros: delMes.otros.bruto,
          egresos,
          neto: sumarMontos([ingresos, -egresos]),
        }
      })
      .sort((x, y) => x.periodo.localeCompare(y.periodo))

    return {
      success: true,
      data: {
        anio,
        meses,
        porCategoria: aFilas(porCategoria),
        porContraparte: aFilas(porContraparte),
        porBolsillo: aFilas(porBolsillo),
        porServicio: aFilas(porServicio),
        intermediados: contrastarIntermediados(
          enTransito.map((s) => ({
            id: s.id,
            nombre: s.nombre,
            categoriaEgresoId: s.categoriaEgresoId,
            categoriaEgreso: s.categoriaEgreso?.nombre ?? null,
          })),
          paraContraste
        ),
        ingresoNeto: ingresoPorServicio(
          sumarMontos(meses.map((m) => m.ingresos)),
          detalles
        ),
        ingresos: ingresosPorNaturaleza(paraNaturaleza),
        totalIngresos: sumarMontos(meses.map((m) => m.ingresos)),
        totalEgresos: sumarMontos(meses.map((m) => m.egresos)),
        cantidadMovimientos: movimientos.length,
        aniosConDatos: [
          ...new Set(todosLosPeriodos.map((p) => Number(p.periodo.slice(0, 4)))),
        ].sort((a, b) => b - a),
      },
    }
  }
)

// ---------------------------------------------------------------------------
// Cotizaciones de Alegra como ingresos
// ---------------------------------------------------------------------------

/**
 * Descripción del documento: el servicio por el que se cobró.
 *
 * Ejemplos del negocio: "Administración", "Recaudo para Terceros",
 * "Independiente 03". Es lo que va a permitir preguntar cuánto se recaudó por
 * cada servicio.
 *
 * OJO: esto lee `observations` / `anotation`, que son los campos que trae la
 * LISTA, y casi siempre vienen vacíos — de 45 cotizaciones de agosto-2026,
 * solo 2 tenían `observations`. Sirve como texto para el concepto del
 * movimiento, nada más.
 *
 * El servicio DE VERDAD no está acá: está en los `items` del detalle, y es lo
 * que lee `desgloseDeDocumento`. Este texto no reemplaza a aquel dato.
 */
function descripcionDelDocumento(doc: {
  observations?: string | null
  anotation?: string | null
}): string | null {
  const texto = (doc.observations ?? doc.anotation ?? '').trim()
  return texto || null
}

/** Primer y último día de un periodo "AAAA-MM", en formato AAAA-MM-DD. */
function rangoDelPeriodo(periodo: string): { desde: string; hasta: string } {
  const [anio, mes] = periodo.split('-').map(Number)
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate()
  return {
    desde: `${periodo}-01`,
    hasta: `${periodo}-${String(ultimo).padStart(2, '0')}`,
  }
}

/**
 * A qué bolsillo entra cada tipo de cobro. Ambos confirmados con el negocio.
 *
 * Las cotizaciones —el dinero "por debajo"— entran a IVONE. Las facturas de
 * venta —"por arriba"— entran a ADMON, que es la cuenta principal.
 */
const BOLSILLO_DE_COTIZACIONES = 'IVONE'
const BOLSILLO_DE_FACTURAS = 'ADMON'

/**
 * Cotizaciones de Alegra del periodo, marcando cuáles ya se registraron como
 * ingreso en este libro.
 *
 * Alegra no sabe si una cotización se cobró — no tiene status ni balance. La
 * única verdad sobre el cobro es si existe acá un movimiento que la referencia.
 */
export const getCotizacionesDelPeriodo = cache(
  async (periodo: string): Promise<ActionResponse<CotizacionesDelPeriodo>> => {
    const auth = await requireControlAuth()
    if (!auth.authorized) return sinAutorizacion(auth.error)

    const { desde, hasta } = rangoDelPeriodo(periodo)

    let alegra
    try {
      alegra = await getCachedEstimatesInRange({ dateFrom: desde, dateTo: hasta })
    } catch (error) {
      console.error('[control] getCotizacionesDelPeriodo:', error)
      return {
        success: false,
        error: 'No se pudo consultar Alegra. Volvé a intentar en un momento.',
      }
    }

    const ids = alegra.items.map((e) => String(e.id))
    const yaRegistradas = await prisma.movimiento.findMany({
      where: { alegraEstimateId: { in: ids } },
      select: { id: true, alegraEstimateId: true },
    })
    const porEstimate = new Map(
      yaRegistradas.map((m) => [m.alegraEstimateId!, m.id])
    )

    const cotizaciones: CotizacionParaIngreso[] = alegra.items.map((e) => {
      const estimateId = String(e.id)
      const movimientoId = porEstimate.get(estimateId) ?? null
      return {
        estimateId,
        numero: Number(e.number),
        fecha: e.date,
        cliente: e.client?.name ?? 'Sin cliente',
        // El servicio por el que se cobró: "Administración", "Recaudo para
        // Terceros", "Independiente 03". Es lo que después permite preguntar
        // cuánto se recaudó por cada servicio.
        descripcion: descripcionDelDocumento(e),
        total: Number(e.total),
        yaRegistrada: movimientoId !== null,
        movimientoId,
      }
    })

    const pendientes = cotizaciones.filter((c) => !c.yaRegistrada)

    return {
      success: true,
      data: {
        periodo,
        cotizaciones,
        totalCotizado: sumarMontos(cotizaciones.map((c) => c.total)),
        totalPendiente: sumarMontos(pendientes.map((c) => c.total)),
        cantidadPendiente: pendientes.length,
        posiblementeIncompleto: alegra.truncated,
      },
    }
  }
)

/**
 * Registra cotizaciones como ingresos a IVONE.
 *
 * El bolsillo no se pregunta: el negocio confirmó que TODAS las cotizaciones
 * entran a IVONE. Si algún día eso cambia, esto pasa a ser un parámetro.
 *
 * La fecha del movimiento es la de la cotización. Es una aproximación
 * declarada: Alegra no guarda cuándo se cobró, y el día del documento es lo
 * más cercano que hay. Queda dicho en las notas de cada movimiento.
 */
/**
 * Traduce las líneas de un documento de Alegra al desglose por servicio.
 *
 * Devuelve `null` — y NO un desglose parcial — cuando algún item del documento
 * no está en el catálogo local. Es deliberado: un desglose al que le falta una
 * línea sigue sumando el monto del movimiento, porque el reparto es a
 * prorrata, y entonces le adjudica a los servicios conocidos una plata que
 * entró por otro. Un dato que miente en silencio es peor que no tenerlo.
 *
 * El caso típico de eso es un servicio nuevo dado de alta en Alegra después de
 * la última sincronización. Se resuelve apretando "Sincronizar" en Catálogos.
 */
/**
 * El catálogo local indexado por id de item de Alegra.
 *
 * Se arma UNA vez por importación y se pasa al bucle. Consultarlo por
 * documento serían ochenta queries idénticas para importar un mes.
 */
async function catalogoPorItemId(): Promise<Map<string, string>> {
  const servicios = await prisma.servicioAlegra.findMany({
    select: { id: true, alegraItemId: true },
  })
  return new Map(servicios.map((s) => [s.alegraItemId, s.id]))
}

function desgloseDeDocumento(
  items: Array<Record<string, unknown>> | undefined,
  montoCobrado: number,
  porItemId: Map<string, string>
): Array<{ servicioAlegraId: string; monto: number }> | null {
  if (!items?.length) return null

  const lineas: LineaDeDocumento[] = items.map((item) => ({
    itemId: String(item.id),
    precio: Number(item.price ?? 0),
    cantidad: Number(item.quantity ?? 0),
    descuento: Number(item.discount ?? 0),
    impuestos: Array.isArray(item.tax)
      ? (item.tax as Array<{ percentage?: unknown }>).map((t) => Number(t.percentage ?? 0))
      : [],
  }))

  const partes = repartirEntreServicios(lineas, montoCobrado)
  if (partes.length === 0) return null

  const desglose: Array<{ servicioAlegraId: string; monto: number }> = []
  for (const parte of partes) {
    const servicioAlegraId = porItemId.get(parte.itemId)
    if (!servicioAlegraId) {
      console.warn(
        `[control] item ${parte.itemId} no está en el catálogo local; ` +
          'el documento se registra sin desglose. Sincronizá Catálogos.'
      )
      return null
    }
    desglose.push({ servicioAlegraId, monto: parte.monto })
  }

  return desglose
}

export async function importarCotizacionesComoIngresos(input: {
  periodo: string
  estimateIds: string[]
}): Promise<
  ActionResponse<{ creados: number; salteados: number; sinDesglose: number }>
> {
  const auth = await requireControlAuth()
  if (!auth.authorized) return sinAutorizacion(auth.error)

  if (!input.estimateIds?.length) {
    return { success: false, error: 'No seleccionaste ninguna cotización' }
  }

  const [bolsillo, categoriaId, resumen] = await Promise.all([
    prisma.bolsillo.findFirst({
      where: { nombre: BOLSILLO_DE_COTIZACIONES },
      select: { id: true },
    }),
    resolverCategoria(GrupoCategoria.COBRO_COTIZACION),
    getCotizacionesDelPeriodo(input.periodo),
  ])

  if (!bolsillo) {
    return { success: false, error: `No existe el bolsillo "${BOLSILLO_DE_COTIZACIONES}"` }
  }
  if (!categoriaId) {
    return {
      success: false,
      error: 'Falta una categoría de grupo COBRO_COTIZACION. Creala en Catálogos.',
    }
  }
  if (!resumen.success || !resumen.data) {
    return { success: false, error: resumen.error ?? 'No se pudo leer Alegra' }
  }

  const seleccionadas = resumen.data.cotizaciones.filter(
    (c) => input.estimateIds.includes(c.estimateId) && !c.yaRegistrada
  )

  const porItemId = await catalogoPorItemId()

  let creados = 0
  let sinDesglose = 0
  for (const c of seleccionadas) {
    const fecha = parseFechaCalendario(c.fecha.slice(0, 10))
    const periodo = periodoDeFecha(fecha)

    if (await periodoEstaCerrado(periodo, bolsillo.id)) continue

    // El servicio cobrado vive en los items, y los items NO vienen en la
    // lista: hay que pedir el detalle de cada documento. Es un request por
    // cotización, secuencial, dentro del limitador del cliente de Alegra.
    let desglose: ReturnType<typeof desgloseDeDocumento> = null
    try {
      const detalle = await getCachedEstimate(c.estimateId)
      desglose = desgloseDeDocumento(
        detalle.items as Array<Record<string, unknown>> | undefined,
        c.total,
        porItemId
      )
    } catch (error) {
      // Que falle el detalle no puede impedir registrar el ingreso: la plata
      // entró igual. Se guarda sin desglose y se cuenta para avisar.
      console.warn('[control] sin detalle de cotización', c.estimateId, error)
    }
    if (!desglose) sinDesglose++

    try {
      await prisma.movimiento.create({
        data: {
          fecha,
          periodo,
          tipo: TipoMovimiento.INGRESO,
          monto: c.total,
          ...(desglose ? { detalleServicios: { create: desglose } } : {}),
          // La descripción manda si existe: dice el servicio, que es más útil
          // que repetir el número del documento.
          concepto: (c.descripcion
            ? `${c.descripcion} — ${c.cliente}`
            : `Cobro cotización #${c.numero} — ${c.cliente}`
          ).slice(0, 200),
          bolsilloId: bolsillo.id,
          categoriaId,
          notas:
            `Cotización #${c.numero}. Importado desde Alegra: la fecha es la ` +
            'del documento, porque Alegra no guarda cuándo se cobró.',
          alegraEstimateId: c.estimateId,
          createdById: auth.userId,
        },
      })
      creados++
    } catch (error) {
      // El índice único de alegraEstimateId puede rebotar una carrera entre
      // dos importaciones simultáneas. No es un error que valga la pena
      // mostrar: significa que ya está registrada.
      console.warn('[control] cotización ya registrada:', c.estimateId, error)
    }
  }

  revalidatePath(RUTA_CONTROL)

  return {
    success: true,
    message:
      `${creados} ingreso${creados === 1 ? '' : 's'} registrado${creados === 1 ? '' : 's'}` +
      (sinDesglose > 0 ? `, ${sinDesglose} sin desglose por servicio` : ''),
    data: { creados, salteados: input.estimateIds.length - creados, sinDesglose },
  }
}

// ---------------------------------------------------------------------------
// Facturas de venta como ingresos ("por arriba")
// ---------------------------------------------------------------------------

/**
 * Facturas de venta del periodo, marcando cuáles ya se registraron.
 *
 * A diferencia de las cotizaciones, acá NO hace falta recorrer páginas a mano:
 * /invoices acepta `date_after` y `date_before` como filtros del servidor, así
 * que el rango lo resuelve Alegra y no hay paginación inestable que esquivar.
 *
 * Y tampoco hay que suponer si se cobró: la factura trae `totalPaid`. Lo que
 * entra al libro es eso, no el total facturado — una factura a medio pagar
 * solo metió en caja lo que se pagó.
 */
export const getFacturasDelPeriodo = cache(
  async (periodo: string): Promise<ActionResponse<FacturasDelPeriodo>> => {
    const auth = await requireControlAuth()
    if (!auth.authorized) return sinAutorizacion(auth.error)

    const { desde, hasta } = rangoDelPeriodo(periodo)

    /**
     * Se pagina de a 30, que es el tope duro de Alegra para `limit`. Pedir más
     * no devuelve más: devuelve Bad Request.
     *
     * Acá alcanza con paginar de corrido, sin el recorrido por fecha que
     * necesitan las cotizaciones: /invoices SÍ acepta `date_after` y
     * `date_before`, así que el rango lo resuelve el servidor y no hay
     * paginación inestable que esquivar.
     */
    const TAMANO = 30
    const MAX_PAGINAS = 20

    const crudas: Awaited<ReturnType<typeof getCachedInvoices>>['data'] = []
    try {
      for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
        const respuesta = await getCachedInvoices({
          date_after: desde,
          date_before: hasta,
          start: pagina * TAMANO,
          limit: TAMANO,
          metadata: true,
        })
        crudas.push(...respuesta.data)
        if (respuesta.data.length < TAMANO) break
      }
    } catch (error) {
      console.error('[control] getFacturasDelPeriodo:', error)
      return {
        success: false,
        error: 'No se pudo consultar Alegra. Volvé a intentar en un momento.',
      }
    }

    const respuesta = { data: crudas }
    const ids = respuesta.data.map((f) => String(f.id))
    const registradas = await prisma.movimiento.findMany({
      where: { alegraInvoiceId: { in: ids } },
      select: { id: true, alegraInvoiceId: true },
    })
    const porFactura = new Map(registradas.map((m) => [m.alegraInvoiceId!, m.id]))

    const facturas: FacturaParaIngreso[] = respuesta.data.map((f) => {
      const invoiceId = String(f.id)
      const movimientoId = porFactura.get(invoiceId) ?? null
      const numero =
        typeof f.numberTemplate === 'object' && f.numberTemplate
          ? String(
              (f.numberTemplate as { fullNumber?: unknown; number?: unknown })
                .fullNumber ??
                (f.numberTemplate as { number?: unknown }).number ??
                ''
            )
          : String(f.numberTemplate ?? '')

      return {
        invoiceId,
        numero: numero || invoiceId,
        fecha: f.date,
        cliente: f.client?.name ?? 'Sin cliente',
        descripcion: descripcionDelDocumento(f),
        total: Number(f.total),
        totalPagado: Number(f.totalPaid ?? 0),
        saldo: Number(f.balance ?? 0),
        estado: String(f.status),
        yaRegistrada: movimientoId !== null,
        movimientoId,
      }
    })

    // Solo cuentan como pendientes las que efectivamente cobraron algo: una
    // factura emitida y sin pagar no movió plata en ninguna caja.
    const pendientes = facturas.filter((f) => !f.yaRegistrada && f.totalPagado > 0)

    return {
      success: true,
      data: {
        periodo,
        facturas,
        totalFacturado: sumarMontos(facturas.map((f) => f.total)),
        totalCobrado: sumarMontos(facturas.map((f) => f.totalPagado)),
        totalPendienteDeRegistrar: sumarMontos(pendientes.map((f) => f.totalPagado)),
        cantidadPendiente: pendientes.length,
      },
    }
  }
)

/**
 * Registra facturas como ingresos.
 *
 * El bolsillo SÍ se pregunta acá, al revés que en las cotizaciones. Para esas
 * el negocio confirmó que todas entran a IVONE; para las facturas —el dinero
 * "por arriba"— no hay una respuesta confirmada, y meter plata en la caja
 * equivocada descuadra dos bolsillos de una vez.
 */
export async function importarFacturasComoIngresos(input: {
  periodo: string
  invoiceIds: string[]
  bolsilloId: string
}): Promise<ActionResponse<{ creados: number; sinDesglose: number }>> {
  const auth = await requireControlAuth()
  if (!auth.authorized) return sinAutorizacion(auth.error)

  if (!input.invoiceIds?.length) {
    return { success: false, error: 'No seleccionaste ninguna factura' }
  }
  if (!input.bolsilloId) {
    return { success: false, error: 'Indicá a qué bolsillo entra la plata' }
  }

  const [bolsillo, categoriaId, resumen] = await Promise.all([
    prisma.bolsillo.findUnique({
      where: { id: input.bolsilloId },
      select: { id: true, nombre: true },
    }),
    resolverCategoria(GrupoCategoria.COBRO_FACTURA),
    getFacturasDelPeriodo(input.periodo),
  ])

  if (!bolsillo) return { success: false, error: 'El bolsillo no existe' }
  if (!categoriaId) {
    return {
      success: false,
      error: 'Falta una categoría de grupo COBRO_FACTURA. Creala en Catálogos.',
    }
  }
  if (!resumen.success || !resumen.data) {
    return { success: false, error: resumen.error ?? 'No se pudo leer Alegra' }
  }

  const elegidas = resumen.data.facturas.filter(
    (f) => input.invoiceIds.includes(f.invoiceId) && !f.yaRegistrada && f.totalPagado > 0
  )

  const porItemId = await catalogoPorItemId()

  let creados = 0
  let sinDesglose = 0
  for (const f of elegidas) {
    const fecha = parseFechaCalendario(f.fecha.slice(0, 10))
    const periodo = periodoDeFecha(fecha)

    if (await periodoEstaCerrado(periodo, bolsillo.id)) continue

    // Un request por factura para leer los items. El reparto va sobre lo
    // COBRADO, no sobre lo facturado: una factura a medio pagar metió en caja
    // solo una parte, y esa parte se distribuye con la composición del
    // documento.
    let desglose: ReturnType<typeof desgloseDeDocumento> = null
    try {
      const detalle = await getCachedInvoice(f.invoiceId)
      desglose = desgloseDeDocumento(
        detalle.items as Array<Record<string, unknown>> | undefined,
        f.totalPagado,
        porItemId
      )
    } catch (error) {
      console.warn('[control] sin detalle de factura', f.invoiceId, error)
    }
    if (!desglose) sinDesglose++

    try {
      await prisma.movimiento.create({
        data: {
          fecha,
          periodo,
          tipo: TipoMovimiento.INGRESO,
          // Lo cobrado, no lo facturado.
          monto: f.totalPagado,
          ...(desglose ? { detalleServicios: { create: desglose } } : {}),
          concepto: (f.descripcion
            ? `${f.descripcion} — ${f.cliente}`
            : `Cobro factura ${f.numero} — ${f.cliente}`
          ).slice(0, 200),
          bolsilloId: bolsillo.id,
          categoriaId,
          notas:
            `Factura ${f.numero}. Facturado ${f.total}, cobrado ${f.totalPagado}` +
            (f.saldo > 0 ? `, saldo pendiente ${f.saldo}.` : '.'),
          alegraInvoiceId: f.invoiceId,
          createdById: auth.userId,
        },
      })
      creados++
    } catch (error) {
      console.warn('[control] factura ya registrada:', f.invoiceId, error)
    }
  }

  revalidatePath(RUTA_CONTROL)

  return {
    success: true,
    message:
      `${creados} ingreso${creados === 1 ? '' : 's'} registrado${creados === 1 ? '' : 's'}` +
      (sinDesglose > 0 ? `, ${sinDesglose} sin desglose por servicio` : ''),
    data: { creados, sinDesglose },
  }
}
