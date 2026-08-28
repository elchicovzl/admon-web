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
import type {
  ContrasteIntermediado,
  EstadoPrestamo,
  EstadoServicio,
  IngresoDeNaturaleza,
  IngresosPorNaturaleza,
} from '@/lib/utils/control-ledger'

export type {
  ContrasteIntermediado,
  EstadoPrestamo,
  EstadoServicio,
  IngresoDeNaturaleza,
  IngresosPorNaturaleza,
}

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

export interface ServicioAlegraListItem {
  id: string
  /** Id del item en Alegra. Es la identidad real, no el nombre. */
  alegraItemId: string
  nombre: string
  /** "01", "02", "05" — el código corto con el que el negocio los nombra. */
  referencia: string | null
  descripcion: string | null
  /**
   * El dinero de este servicio no es ingreso: entra y vuelve a salir.
   * "Recaudo para Terceros" es el caso.
   */
  enTransito: boolean
  /**
   * Categoría por la que esa plata vuelve a salir. `null` en un servicio en
   * tránsito NO es un error de configuración: es el hallazgo de que su salida
   * nunca se registró.
   */
  categoriaEgreso: { id: string; nombre: string } | null
  isActive: boolean
  sincronizadoEn: Date | null
}

/** Resultado de sincronizar el catálogo contra Alegra. */
export interface SincronizacionServiciosResultado {
  creados: number
  actualizados: number
  desactivados: number
  /** Items de Alegra descartados por no ser `type: 'service'`. */
  descartados: number
  /**
   * El catálogo ya sincronizado.
   *
   * Viaja en la misma respuesta a propósito: `revalidatePath` refresca el
   * Server Component, pero la pantalla guarda la lista en estado local y
   * `useState` no se reinicializa con las props nuevas. Devolverla evita un
   * segundo round trip para ver lo que se acaba de escribir.
   */
  servicios: ServicioAlegraListItem[]
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
  /**
   * El préstamo al que pertenece, cuando lo hay.
   *
   * Va con el concepto y la contraparte y no solo con el id: una persona puede
   * tener más de un préstamo abierto, y "abono a préstamo" sin decir a cuál no
   * se puede rastrear.
   */
  prestamo: {
    id: string
    concepto: string
    fechaDesembolso: Date
    contraparte: string
  } | null
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
/**
 * Cuánto de lo que entró es ingreso de verdad.
 *
 * No todo lo que entra se gana: en las facturas de venta viaja el "Recaudo
 * para Terceros", que entra y vuelve a salir. Va junto a la cobertura porque
 * el desglose por servicio existe solo desde que se importa con él: sin decir
 * cuánto quedó afuera, el neto parecería exacto.
 *
 * OJO: esto NO afecta el saldo de los bolsillos. La plata entró de verdad y la
 * caja tiene que seguir cuadrando contra el extracto.
 */
export interface IngresoNeto {
  conDesglose: number
  sinDesglose: number
  enTransito: number
  netos: number
}

export interface ResumenPeriodo {
  periodo: string
  cierres: CierreMensualView[]
  totalIngresos: number
  totalEgresos: number
  /**
   * Los ingresos abiertos por naturaleza: cotización (C), factura (F) y el
   * resto. Para el negocio C y F son cosas distintas, y sumarlos en un solo
   * número pierde media razón de ser del módulo.
   */
  ingresos: IngresosPorNaturaleza
  ingresoNeto: IngresoNeto
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
  /**
   * Lo que entró por cada vía, en BRUTO.
   *
   * Acá no se descuenta la plata en tránsito a propósito: esta tabla es un
   * flujo de caja y su columna `neto` significa ingresos − egresos. Netear el
   * tránsito solo en una columna cambiaría en silencio lo que significa la
   * otra. El ingreso real vive en su propia tarjeta, con su cobertura al lado.
   */
  ingresosCotizacion: number
  ingresosFactura: number
  /**
   * Ingresos que no son ni C ni F: abonos a préstamos, devoluciones, cargas
   * manuales. Va en su propia columna cuando existe, porque si no
   * `ingresosCotizacion + ingresosFactura - egresos` no daría `neto` y la
   * tabla dejaría de sumar a la vista.
   */
  ingresosOtros: number
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
  /**
   * Corte por servicio de Alegra: por qué entró la plata.
   *
   * Es el único corte que NO cubre todo el libro — solo los movimientos que
   * tienen desglose. `ingresoNeto.sinDesglose` dice cuánto queda afuera.
   */
  porServicio: FilaAgrupada[]
  /**
   * Lo que entró contra lo que salió, por cada servicio en tránsito.
   *
   * Es la única vista del libro que puede desmentir un "entra y vuelve a
   * salir": si el margen da negativo todos los meses, o si un servicio no
   * tiene categoría de egreso, algo no está registrado.
   */
  intermediados: ContrasteIntermediado[]
  ingresoNeto: IngresoNeto
  /** Los ingresos del año abiertos en C, F y el resto. */
  ingresos: IngresosPorNaturaleza
  totalIngresos: number
  totalEgresos: number
  cantidadMovimientos: number
  /** Años que tienen al menos un movimiento, para el selector. */
  aniosConDatos: number[]
}

/**
 * Página de movimientos.
 *
 * Trae dos totales distintos a propósito: `sumaPagina` es lo que el operador
 * ve en pantalla y `sumaFiltrada` es todo lo que cumple el filtro. Mostrar solo
 * el primero haría que "total" cambiara al pasar de página, que es la forma más
 * rápida de que nadie vuelva a confiar en el número.
 */
export interface MovimientosPaginados {
  items: MovimientoListItem[]
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  sumaPagina: number
  sumaFiltrada: number
}

// ---------------------------------------------------------------------------
// Cotizaciones de Alegra como ingresos
// ---------------------------------------------------------------------------

/**
 * Una cotización de Alegra vista desde Control.
 *
 * Alegra NO guarda si una cotización se cobró: no tiene `status`, ni `balance`,
 * ni `totalPaid` — es un documento informativo. Así que "cobrada" acá significa
 * una sola cosa: que YA existe un movimiento de ingreso en este libro que la
 * referencia. La verdad sobre el cobro vive en Control, no en Alegra.
 */
export interface CotizacionParaIngreso {
  estimateId: string
  numero: number
  fecha: string
  cliente: string
  /**
   * El servicio por el que se cobró: "Administración", "Recaudo para
   * Terceros", "Independiente 03". Sale de las observaciones del documento.
   */
  descripcion: string | null
  total: number
  /** True si ya se registró el ingreso correspondiente. */
  yaRegistrada: boolean
  movimientoId: string | null
}

export interface CotizacionesDelPeriodo {
  periodo: string
  cotizaciones: CotizacionParaIngreso[]
  totalCotizado: number
  totalPendiente: number
  cantidadPendiente: number
  /**
   * True cuando la búsqueda en Alegra tocó el tope de páginas y puede estar
   * incompleta. Hay que avisarlo: un total que miente por lo bajo es peor que
   * no mostrarlo.
   */
  posiblementeIncompleto: boolean
}

/**
 * Una factura de venta vista desde Control.
 *
 * A diferencia de una cotización, la factura SÍ sabe cuánto se cobró:
 * `totalPaid` y `balance` son parte del documento. Por eso el ingreso se
 * registra por lo efectivamente pagado y no por el total facturado.
 */
export interface FacturaParaIngreso {
  invoiceId: string
  numero: string
  fecha: string
  cliente: string
  /** El servicio por el que se facturó. Ver CotizacionParaIngreso.descripcion. */
  descripcion: string | null
  total: number
  /** Lo efectivamente cobrado según Alegra. Es lo que entra al libro. */
  totalPagado: number
  saldo: number
  estado: string
  yaRegistrada: boolean
  movimientoId: string | null
}

export interface FacturasDelPeriodo {
  periodo: string
  facturas: FacturaParaIngreso[]
  /** Suma de `total`: lo facturado, cobrado o no. */
  totalFacturado: number
  /** Suma de `totalPaid`: lo que realmente entró. */
  totalCobrado: number
  totalPendienteDeRegistrar: number
  cantidadPendiente: number
}
