/**
 * Validaciones del módulo Control (libro de caja interno).
 *
 * Estas reglas están DUPLICADAS a propósito con los CHECK constraints de la
 * migración 20260827010000_add_control_module. No es redundancia: Zod da el
 * mensaje que el operador entiende, la base garantiza que la regla no se pueda
 * violar ni desde un cliente de SQL. Si alguna vez difieren, manda la base.
 *
 * FECHAS: entran como string "YYYY-MM-DD", no como Date. Un Date arrastra
 * hora y zona horaria, y este libro es un calendario de America/Bogotá: un
 * movimiento del 31 a las 20:00 no puede terminar en el mes siguiente. El
 * formulario formatea con date-fns antes de enviar.
 */

import { z } from 'zod'
import {
  TipoBolsillo,
  TipoContraparte,
  TipoMovimiento,
  GrupoCategoria,
} from '@prisma/client'

// ---------------------------------------------------------------------------
// Piezas reutilizables
// ---------------------------------------------------------------------------

const cuid = (mensaje: string) => z.string().cuid(mensaje)

const fechaCalendario = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener formato AAAA-MM-DD')
  .refine((valor) => !Number.isNaN(Date.parse(valor)), 'La fecha no es válida')

/**
 * Un monto de cero o negativo no existe en este libro. La dirección la da
 * `tipo` (INGRESO / EGRESO / TRASLADO), nunca el signo — montos con signo son
 * la puerta de entrada a que una resta quede sumando.
 */
const monto = z
  .number({ required_error: 'El monto es requerido', invalid_type_error: 'El monto debe ser un número' })
  .positive('El monto debe ser mayor a cero')
  .max(99_999_999_999.99, 'El monto excede el máximo permitido')
  .refine(
    (valor) => Number.isInteger(Math.round(valor * 100)),
    'El monto no puede tener más de dos decimales'
  )

/** Igual que `monto` pero admite cero: un servicio puede facturarse en cero. */
const montoNoNegativo = z
  .number({ required_error: 'El valor es requerido', invalid_type_error: 'El valor debe ser un número' })
  .min(0, 'El valor no puede ser negativo')
  .max(99_999_999_999.99, 'El valor excede el máximo permitido')

const periodo = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'El periodo debe tener formato AAAA-MM')

const notas = z
  .string()
  .max(2000, 'Las notas no pueden exceder 2000 caracteres')
  .optional()
  .nullable()

// ---------------------------------------------------------------------------
// Catálogos
// ---------------------------------------------------------------------------

export const createBolsilloSchema = z.object({
  nombre: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(60, 'El nombre no puede exceder 60 caracteres')
    .transform((v) => v.trim()),
  tipo: z.nativeEnum(TipoBolsillo, { required_error: 'El tipo es requerido' }),
  orden: z.number().int().min(0).default(0),
})

export const createCategoriaSchema = z.object({
  nombre: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(80, 'El nombre no puede exceder 80 caracteres')
    .transform((v) => v.trim()),
  grupo: z.nativeEnum(GrupoCategoria, { required_error: 'El grupo es requerido' }),
})

export const createTipoServicioSchema = z.object({
  nombre: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(60, 'El nombre no puede exceder 60 caracteres')
    .transform((v) => v.trim()),
  /**
   * Obligatoria. Antes se resolvía por coincidencia de nombre entre el tipo y
   * la categoría, y cuando no coincidían — "Mensajería" vs "Servicio de
   * mensajería" — caía en un fallback que elegía cualquiera del grupo. Los
   * movimientos quedaban mal categorizados sin que nada avisara.
   */
  categoriaId: cuid('Seleccioná la categoría con la que se registra el servicio'),
})

/**
 * Activar o desactivar una entrada de catálogo.
 *
 * No hay borrado: los movimientos históricos apuntan a estas filas y tienen
 * que poder seguir existiendo. Un bolsillo que se deja de usar se cierra, no
 * se elimina — ver JOSE Q, que sale de circulación en enero-2026 pero cuyos
 * movimientos siguen contando.
 */
export const toggleCatalogoSchema = z.object({
  id: cuid('Registro inválido'),
  isActive: z.boolean(),
})

export type ToggleCatalogoInput = z.infer<typeof toggleCatalogoSchema>

/**
 * Marca un servicio de Alegra como plata en tránsito.
 *
 * Va aparte de `toggleCatalogoSchema` porque no es lo mismo apagar un registro
 * que declarar que su plata no es ingreso: el primero es higiene de catálogo,
 * el segundo cambia lo que el libro considera ganado.
 */
export const toggleServicioEnTransitoSchema = z.object({
  id: cuid('Servicio inválido'),
  enTransito: z.boolean(),
})

export type ToggleServicioEnTransitoInput = z.infer<typeof toggleServicioEnTransitoSchema>

/**
 * Marca una categoría como costo de nómina.
 *
 * Va aparte del toggle genérico por lo mismo que `enTransito`: apagar un
 * registro es higiene de catálogo, declarar que algo es nómina cambia lo que
 * la empresa cree que le cuesta su equipo.
 */
export const toggleEsNominaSchema = z.object({
  id: cuid('Categoría inválida'),
  esNomina: z.boolean(),
})

export type ToggleEsNominaInput = z.infer<typeof toggleEsNominaSchema>

/**
 * Ata un servicio en tránsito con la categoría por la que su plata sale.
 *
 * `null` es un valor válido y significativo: desatar el vínculo deja el
 * contraste sin lado de egreso, que es exactamente lo que hay que ver cuando a
 * esa plata no se le registra la salida.
 */
export const asignarCategoriaEgresoSchema = z.object({
  id: cuid('Servicio inválido'),
  categoriaEgresoId: cuid('Categoría inválida').nullable(),
})

export type AsignarCategoriaEgresoInput = z.infer<typeof asignarCategoriaEgresoSchema>

export type CreateBolsilloInput = z.infer<typeof createBolsilloSchema>
export type CreateCategoriaInput = z.infer<typeof createCategoriaSchema>
export type CreateTipoServicioInput = z.infer<typeof createTipoServicioSchema>

// ---------------------------------------------------------------------------
// Contrapartes
// ---------------------------------------------------------------------------

export const createContraparteSchema = z.object({
  nombre: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(120, 'El nombre no puede exceder 120 caracteres')
    .transform((v) => v.trim()),
  tipo: z.nativeEnum(TipoContraparte, { required_error: 'El tipo es requerido' }),

  /**
   * Solo dígitos, SIN dígito de verificación: el NIT 901485874-1 se guarda
   * como "901485874". El DV se calcula con el algoritmo DIAN cuando hay que
   * mostrarlo, y guardarlo sería dato redundante que se desincroniza.
   */
  documento: z
    .string()
    .regex(/^\d{5,15}$/, 'El documento debe tener entre 5 y 15 dígitos, sin puntos ni guiones')
    .optional()
    .nullable(),

  userId: cuid('Usuario inválido').optional().nullable(),
  clientId: cuid('Cliente inválido').optional().nullable(),
  notas,
})

export type CreateContraparteInput = z.infer<typeof createContraparteSchema>

// ---------------------------------------------------------------------------
// Movimientos
// ---------------------------------------------------------------------------

const movimientoBaseSchema = z.object({
  fecha: fechaCalendario,
  tipo: z.nativeEnum(TipoMovimiento, { required_error: 'El tipo es requerido' }),
  monto,
  concepto: z
    .string()
    .min(3, 'El concepto debe tener al menos 3 caracteres')
    .max(200, 'El concepto no puede exceder 200 caracteres')
    .transform((v) => v.trim()),

  bolsilloId: cuid('Seleccioná un bolsillo'),
  bolsilloDestinoId: cuid('Bolsillo destino inválido').optional().nullable(),
  categoriaId: cuid('Seleccioná una categoría'),
  contraparteId: cuid('Contraparte inválida').optional().nullable(),
  prestamoId: cuid('Préstamo inválido').optional().nullable(),

  /**
   * Servicio de Alegra por el que se cobró. Solo tiene sentido en un INGRESO.
   *
   * El catálogo de Alegra es un catálogo de VENTAS. Un egreso —nómina,
   * papelería, un almuerzo— no vendió nada, y colgarle un servicio ensuciaría
   * el reporte: al sumar por servicio aparecerían egresos mezclados con
   * ingresos y el número dejaría de querer decir algo.
   */
  servicioAlegraId: cuid('Servicio inválido').optional().nullable(),

  notas,
})

/** El destino existe si y solo si es un TRASLADO. */
const destinoSoloEnTraslado = (data: {
  tipo: TipoMovimiento
  bolsilloDestinoId?: string | null
}) =>
  data.tipo === TipoMovimiento.TRASLADO
    ? Boolean(data.bolsilloDestinoId)
    : !data.bolsilloDestinoId

/** El catálogo de Alegra es de ventas: un egreso no vendió nada. */
const servicioSoloEnIngreso = (data: {
  tipo: TipoMovimiento
  servicioAlegraId?: string | null
}) => !data.servicioAlegraId || data.tipo === TipoMovimiento.INGRESO

/** Un traslado a sí mismo no mueve plata pero ensucia el saldo del periodo. */
const bolsillosDistintos = (data: {
  bolsilloId: string
  bolsilloDestinoId?: string | null
}) => !data.bolsilloDestinoId || data.bolsilloDestinoId !== data.bolsilloId

export const createMovimientoSchema = movimientoBaseSchema
  .refine(destinoSoloEnTraslado, {
    message: 'Solo un traslado lleva bolsillo destino, y un traslado siempre lo exige',
    path: ['bolsilloDestinoId'],
  })
  .refine(bolsillosDistintos, {
    message: 'El bolsillo destino debe ser distinto al de origen',
    path: ['bolsilloDestinoId'],
  })
  .refine(servicioSoloEnIngreso, {
    message: 'El servicio de Alegra solo aplica a un ingreso',
    path: ['servicioAlegraId'],
  })

export type CreateMovimientoInput = z.infer<typeof createMovimientoSchema>

/**
 * Anulación. No se edita ni se borra el original: se crea su espejo.
 * El motivo es obligatorio — una anulación sin explicación es exactamente el
 * agujero que dejaba el Excel.
 */
export const anularMovimientoSchema = z.object({
  movimientoId: cuid('Movimiento inválido'),
  motivo: z
    .string()
    .min(5, 'Explicá por qué se anula (mínimo 5 caracteres)')
    .max(500, 'El motivo no puede exceder 500 caracteres')
    .transform((v) => v.trim()),
  fecha: fechaCalendario.optional(),
})

export type AnularMovimientoInput = z.infer<typeof anularMovimientoSchema>

// ---------------------------------------------------------------------------
// Préstamos
// ---------------------------------------------------------------------------

export const createPrestamoSchema = z.object({
  contraparteId: cuid('Seleccioná a quién se le presta'),
  fechaDesembolso: fechaCalendario,
  montoOriginal: monto,
  concepto: z
    .string()
    .min(3, 'El concepto debe tener al menos 3 caracteres')
    .max(200, 'El concepto no puede exceder 200 caracteres')
    .transform((v) => v.trim()),
  bolsilloOrigenId: cuid('Seleccioná de qué bolsillo sale'),
  notas,
})

export type CreatePrestamoInput = z.infer<typeof createPrestamoSchema>

/** Abono a un préstamo. Genera un movimiento de INGRESO ligado al préstamo. */
export const abonarPrestamoSchema = z.object({
  prestamoId: cuid('Préstamo inválido'),
  fecha: fechaCalendario,
  monto,
  bolsilloId: cuid('Seleccioná a qué bolsillo entra'),
  concepto: z
    .string()
    .max(200, 'El concepto no puede exceder 200 caracteres')
    .optional(),
  notas,
})

export type AbonarPrestamoInput = z.infer<typeof abonarPrestamoSchema>

/**
 * Marcar un préstamo como incobrable. Es lo único del estado que no se deriva
 * del saldo, y por eso exige motivo: es una decisión, no un cálculo.
 */
export const marcarIncobrableSchema = z.object({
  prestamoId: cuid('Préstamo inválido'),
  marcadoIncobrable: z.boolean(),
  motivo: z
    .string()
    .max(1000, 'El motivo no puede exceder 1000 caracteres')
    .optional()
    .nullable(),
}).refine(
  (data) => !data.marcadoIncobrable || Boolean(data.motivo?.trim()),
  { message: 'Dar un préstamo por perdido exige un motivo', path: ['motivo'] }
)

export type MarcarIncobrableInput = z.infer<typeof marcarIncobrableSchema>

// ---------------------------------------------------------------------------
// Servicios referenciados
// ---------------------------------------------------------------------------

export const createServicioSchema = z.object({
  tipoServicioId: cuid('Seleccioná el tipo de servicio'),
  fecha: fechaCalendario,
  clienteId: cuid('Seleccioná el cliente que paga'),
  proveedorId: cuid('Seleccioná a quién se le entrega'),
  valorFacturado: montoNoNegativo,
  valorEntregado: montoNoNegativo,
  alegraEstimateId: z
    .string()
    .max(60, 'El id de la cotización no puede exceder 60 caracteres')
    .optional()
    .nullable(),
  notas,
}).refine((data) => data.clienteId !== data.proveedorId, {
  message: 'El cliente y el proveedor no pueden ser la misma contraparte',
  path: ['proveedorId'],
})
// No se valida valorEntregado <= valorFacturado: un servicio puede cerrar en
// pérdida y el libro tiene que poder registrarlo. Una validación que impide
// anotar la realidad es peor que no tenerla.

export type CreateServicioInput = z.infer<typeof createServicioSchema>

/** Registra una de las dos patas del servicio como movimiento real de caja. */
export const registrarPataServicioSchema = z.object({
  servicioId: cuid('Servicio inválido'),
  pata: z.enum(['INGRESO', 'EGRESO'], {
    required_error: 'Indicá si es el cobro o la entrega',
  }),
  fecha: fechaCalendario,
  bolsilloId: cuid('Seleccioná el bolsillo'),
  notas,
})

export type RegistrarPataServicioInput = z.infer<typeof registrarPataServicioSchema>

// ---------------------------------------------------------------------------
// Cierre mensual
// ---------------------------------------------------------------------------

/**
 * Registra el conteo físico de un bolsillo y lo compara contra el calculado.
 *
 * `saldoFinalCalculado` NO está acá: no se digita nunca, sale de los
 * movimientos. Lo único que entra es lo que se contó, y la justificación
 * cuando no coincide.
 */
export const registrarConteoSchema = z.object({
  periodo,
  bolsilloId: cuid('Bolsillo inválido'),
  saldoFinalReal: montoNoNegativo.nullable(),
  justificacion: z
    .string()
    .max(1000, 'La justificación no puede exceder 1000 caracteres')
    .optional()
    .nullable(),
})

export type RegistrarConteoInput = z.infer<typeof registrarConteoSchema>

/** Saldo semilla al arrancar el módulo. Es el único saldo que se digita. */
export const aperturaInicialSchema = z.object({
  periodo,
  bolsilloId: cuid('Bolsillo inválido'),
  saldoInicial: montoNoNegativo,
})

export type AperturaInicialInput = z.infer<typeof aperturaInicialSchema>

export const cerrarPeriodoSchema = z.object({
  periodo,
  bolsilloId: cuid('Bolsillo inválido'),
})

export type CerrarPeriodoInput = z.infer<typeof cerrarPeriodoSchema>
