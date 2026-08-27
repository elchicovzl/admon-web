/**
 * Tipos del módulo Control (libro de caja interno).
 *
 * REGLA DEL MÓDULO: acá los montos son `number`, NUNCA `Prisma.Decimal`.
 *
 * Los Server Components no pueden serializar un Decimal hacia un Client
 * Component — el render revienta con un error de serialización que no dice
 * nada sobre dinero. La conversión se hace UNA vez, en la capa de datos
 * (lib/actions/control.actions.ts), y de ahí para arriba todo es number.
 */

import type {
  TipoBolsillo,
  TipoContraparte,
  TipoMovimiento,
  GrupoCategoria,
  Prisma,
} from '@prisma/client'
import type { EstadoPrestamo, EstadoServicio } from '@/lib/utils/control-ledger'

export type { EstadoPrestamo, EstadoServicio }

/**
 * Único punto donde un Decimal se vuelve number. Si aparece un `.toNumber()`
 * suelto en otro archivo del módulo, es una fuga de esta frontera.
 */
export function decimalANumero(valor: Prisma.Decimal): number {
  return valor.toNumber()
}

/** Igual que decimalANumero pero tolera columnas nullable. */
export function decimalANumeroOpcional(
  valor: Prisma.Decimal | null
): number | null {
  return valor === null ? null : valor.toNumber()
}

// ---------------------------------------------------------------------------
// Catálogos
// ---------------------------------------------------------------------------

export interface BolsilloListItem {
  id: string
  nombre: string
  tipo: TipoBolsillo
  orden: number
  isActive: boolean
  cerradoEn: Date | null
}

export interface CategoriaListItem {
  id: string
  nombre: string
  grupo: GrupoCategoria
  isActive: boolean
}

export interface TipoServicioListItem {
  id: string
  nombre: string
  isActive: boolean
  /**
   * Categoría con la que se registran las dos patas de movimiento de este
   * servicio. Es explícita, no se deduce del nombre: "Mensajería" (tipo) y
   * "Servicio de mensajería" (categoría) no son el mismo string.
   */
  categoria: { id: string; nombre: string }
}

export interface ContraparteListItem {
  id: string
  nombre: string
  tipo: TipoContraparte
  documento: string | null
  isActive: boolean
  /** Presente si la contraparte es además usuario del sistema. */
  userId: string | null
  /** Presente si la contraparte es además cliente registrado. */
  clientId: string | null
}

// ---------------------------------------------------------------------------
// Movimientos
// ---------------------------------------------------------------------------

export interface MovimientoListItem {
  id: string
  fecha: Date
  periodo: string
  tipo: TipoMovimiento
  monto: number
  concepto: string
  bolsillo: { id: string; nombre: string }
  bolsilloDestino: { id: string; nombre: string } | null
  categoria: { id: string; nombre: string; grupo: GrupoCategoria }
  contraparte: { id: string; nombre: string } | null
  prestamoId: string | null
  notas: string | null
  createdAt: Date
  createdBy: { name: string | null; email: string }

  /** Id del movimiento que este anula, si es un contra-movimiento. */
  anulaMovimientoId: string | null
  /**
   * True si ESTE movimiento ya fue anulado por otro. Se calcula desde la
   * relación inversa: un movimiento anulado no se borra ni se marca, sigue
   * ahí con su contra-movimiento al lado.
   */
  estaAnulado: boolean
}

// ---------------------------------------------------------------------------
// Préstamos
// ---------------------------------------------------------------------------

export interface PrestamoListItem {
  id: string
  contraparte: { id: string; nombre: string }
  fechaDesembolso: Date
  montoOriginal: number
  concepto: string
  bolsilloOrigen: { id: string; nombre: string }
  marcadoIncobrable: boolean
  incobrableMotivo: string | null
  notas: string | null

  /** Derivado de los movimientos. No existe como columna. */
  saldoActual: number
  /** Derivado del saldo (salvo INCOBRABLE, que es decisión). */
  estado: EstadoPrestamo
  totalAbonado: number
  cantidadAbonos: number
}

// ---------------------------------------------------------------------------
// Servicios referenciados
// ---------------------------------------------------------------------------

export interface ServicioReferenciadoListItem {
  id: string
  tipoServicio: { id: string; nombre: string }
  fecha: Date
  periodo: string
  cliente: { id: string; nombre: string }
  proveedor: { id: string; nombre: string }
  valorFacturado: number
  valorEntregado: number
  alegraEstimateId: string | null
  notas: string | null

  /** valorFacturado - valorEntregado. Cero en mensajería. */
  margen: number
  estado: EstadoServicio
  movimientoIngresoId: string | null
  movimientoEgresoId: string | null
}

// ---------------------------------------------------------------------------
// Cierre mensual
// ---------------------------------------------------------------------------

export interface CierreMensualView {
  id: string | null
  periodo: string
  bolsillo: { id: string; nombre: string }

  saldoInicial: number
  /** Siempre calculado desde los movimientos. Nunca se digita. */
  saldoFinalCalculado: number
  /** Conteo físico o extracto. Existe para comparar, no para reemplazar. */
  saldoFinalReal: number | null
  /** real - calculado. `null` cuando no hubo conteo. */
  diferencia: number | null
  justificacion: string | null

  esAperturaInicial: boolean
  cerrado: boolean
  cerradoEn: Date | null

  cantidadMovimientos: number
}

/** Resumen de un periodo completo, para la pantalla de cierre. */
export interface ResumenPeriodo {
  periodo: string
  cierres: CierreMensualView[]
  totalIngresos: number
  totalEgresos: number
  /** Suma de los saldos finales de todos los bolsillos. */
  saldoConsolidado: number
  /** True si algún bolsillo tiene diferencia sin justificar. */
  tieneDescuadres: boolean
}

// ---------------------------------------------------------------------------
// Reporte anual
// ---------------------------------------------------------------------------

export interface FilaAgrupada {
  id: string
  nombre: string
  /** Etiqueta secundaria: el grupo de una categoría, el tipo de una contraparte. */
  detalle?: string
  cantidad: number
  ingresos: number
  egresos: number
  /** ingresos - egresos. Negativo significa que salió más de lo que entró. */
  neto: number
}

export interface MesDelAnio {
  periodo: string
  cantidad: number
  ingresos: number
  egresos: number
  neto: number
}

/**
 * Vista anual del libro.
 *
 * Es la pregunta que el Excel no podía responder: cuánto se gastó en cada cosa
 * y cuánto se le pagó a cada quien en el año. No podía porque el "quién" y el
 * "qué" vivían en la misma columna.
 */
export interface ReporteAnual {
  anio: number
  meses: MesDelAnio[]
  porCategoria: FilaAgrupada[]
  porContraparte: FilaAgrupada[]
  porBolsillo: FilaAgrupada[]
  totalIngresos: number
  totalEgresos: number
  cantidadMovimientos: number
  /** Años que tienen al menos un movimiento, para el selector. */
  aniosConDatos: number[]
}
