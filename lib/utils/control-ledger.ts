/**
 * Cálculos del libro de caja (módulo Control).
 *
 * Todo acá es PURO: sin Prisma, sin sesión, sin I/O. Esa es la razón de que
 * exista como módulo aparte — son las reglas que el Excel tenía como fórmulas
 * frágiles (y con rangos mal puestos), y merecen tests propios en vez de
 * quedar escondidas dentro de un Server Action.
 *
 * Nada de lo que se calcula acá se guarda como columna. El saldo de un
 * préstamo, el margen de un servicio y el cierre de un mes se derivan siempre
 * de los movimientos. Guardarlos es cómo se desincronizan.
 */

import { TipoMovimiento, GrupoCategoria } from '@prisma/client'

// ---------------------------------------------------------------------------
// Aritmética de dinero
// ---------------------------------------------------------------------------

/**
 * Suma montos acumulando en centavos enteros.
 *
 * Sumar decimales en punto flotante arrastra error (0.1 + 0.2 !== 0.3). En
 * pesos colombianos casi todos los montos son enteros y no se notaría, pero
 * `Decimal(14,2)` admite centavos y un libro de caja no es lugar para
 * "casi nunca falla".
 */
export function sumarMontos(montos: number[]): number {
  const centavos = montos.reduce((acc, monto) => acc + Math.round(monto * 100), 0)
  return centavos / 100
}

/** Redondea a 2 decimales, la precisión de la columna en la base. */
export function redondearMonto(monto: number): number {
  return Math.round(monto * 100) / 100
}

// ---------------------------------------------------------------------------
// Fechas y periodos
// ---------------------------------------------------------------------------

/**
 * Convierte "2026-08-27" en una fecha fijada a medianoche UTC.
 *
 * El libro es un calendario de America/Bogotá (UTC-5), no una línea de tiempo.
 * Si se construyera con `new Date("2026-08-27")` en hora local, un movimiento
 * del 31 a las 20:00 se guardaría como 1° del mes siguiente y caería en el
 * periodo equivocado — un error que solo aparece a fin de mes y que nadie
 * relaciona con zonas horarias.
 */
export function parseFechaCalendario(fecha: string): Date {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  return new Date(Date.UTC(anio, mes - 1, dia))
}

/**
 * Deriva el periodo "YYYY-MM" de una fecha.
 *
 * `periodo` NUNCA es input del usuario: siempre sale de acá al escribir. Por
 * eso el CHECK en la base solo valida el formato — la garantía de que
 * coincide con la fecha es esta función.
 */
export function periodoDeFecha(fecha: Date): string {
  const anio = fecha.getUTCFullYear()
  const mes = String(fecha.getUTCMonth() + 1).padStart(2, '0')
  return `${anio}-${mes}`
}

/** Periodo inmediatamente anterior. "2026-01" → "2025-12". */
export function periodoAnterior(periodo: string): string {
  const [anio, mes] = periodo.split('-').map(Number)
  return mes === 1
    ? `${anio - 1}-12`
    : `${anio}-${String(mes - 1).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Saldos de bolsillo
// ---------------------------------------------------------------------------

export interface MovimientoParaSaldo {
  tipo: TipoMovimiento
  monto: number
  bolsilloId: string
  bolsilloDestinoId: string | null
}

/**
 * Cuánto mueve un movimiento en un bolsillo dado. Positivo entra, negativo
 * sale, cero si el movimiento no toca ese bolsillo.
 *
 * Un TRASLADO es una sola fila que afecta a DOS bolsillos en direcciones
 * opuestas, por eso no alcanza con mirar `bolsilloId`.
 *
 * Las anulaciones no se filtran ni se tratan aparte: un contra-movimiento es
 * un movimiento normal en dirección contraria, así que al sumar se cancela
 * solo con el original. Esa es toda la gracia de anular en vez de editar.
 */
export function efectoEnBolsillo(
  movimiento: MovimientoParaSaldo,
  bolsilloId: string
): number {
  const { tipo, monto } = movimiento

  if (tipo === TipoMovimiento.TRASLADO) {
    if (movimiento.bolsilloId === bolsilloId) return -monto
    if (movimiento.bolsilloDestinoId === bolsilloId) return monto
    return 0
  }

  if (movimiento.bolsilloId !== bolsilloId) return 0

  return tipo === TipoMovimiento.INGRESO ? monto : -monto
}

/**
 * Saldo final de un bolsillo: el inicial más el efecto neto de los
 * movimientos del periodo.
 *
 * Esto es lo que en el Excel era `=SUM(K30:K41)` sobre un rango escrito a
 * mano — y que en septiembre-2026 se quedó corto por dos filas, dejando
 * 202.500 fuera del total sin que nadie lo notara. Acá el conjunto no se
 * elige: son todos los movimientos que se le pasan.
 */
export function calcularSaldoFinal(
  saldoInicial: number,
  movimientos: MovimientoParaSaldo[],
  bolsilloId: string
): number {
  const efectos = movimientos.map((m) => efectoEnBolsillo(m, bolsilloId))
  return redondearMonto(saldoInicial + sumarMontos(efectos))
}

/**
 * Diferencia entre lo contado y lo calculado. Positivo es sobrante.
 *
 * Devuelve `null` cuando no hubo conteo real: "no se contó" y "contó cero"
 * son cosas distintas, y colapsarlas es exactamente lo que hacía que los
 * descuadres del Excel se volvieran invisibles.
 */
export function calcularDiferencia(
  saldoFinalCalculado: number,
  saldoFinalReal: number | null | undefined
): number | null {
  if (saldoFinalReal === null || saldoFinalReal === undefined) return null
  return redondearMonto(saldoFinalReal - saldoFinalCalculado)
}

// ---------------------------------------------------------------------------
// Préstamos
// ---------------------------------------------------------------------------

export type EstadoPrestamo = 'ABIERTO' | 'PARCIAL' | 'CANCELADO' | 'INCOBRABLE'

export interface MovimientoDePrestamo {
  tipo: TipoMovimiento
  monto: number
  grupoCategoria: GrupoCategoria
}

/**
 * Total abonado a un préstamo.
 *
 * Solo cuentan los movimientos de grupo PRESTAMO_ABONO: el desembolso también
 * cuelga del préstamo, pero es lo que se prestó, no lo que se pagó.
 *
 * Un abono entra como INGRESO. Si se anula, el contra-movimiento es un EGRESO
 * del mismo grupo y resta — por eso el signo sale del tipo y no de una lista
 * de exclusiones.
 */
export function totalAbonado(movimientos: MovimientoDePrestamo[]): number {
  const abonos = movimientos
    .filter((m) => m.grupoCategoria === GrupoCategoria.PRESTAMO_ABONO)
    .map((m) => (m.tipo === TipoMovimiento.INGRESO ? m.monto : -m.monto))

  return sumarMontos(abonos)
}

/** Cuánto falta por pagar. Nunca baja de cero, aunque se abone de más. */
export function saldoPrestamo(
  montoOriginal: number,
  movimientos: MovimientoDePrestamo[]
): number {
  const saldo = redondearMonto(montoOriginal - totalAbonado(movimientos))
  return saldo < 0 ? 0 : saldo
}

/**
 * Estado del préstamo, derivado del saldo.
 *
 * En el Excel esto era texto libre con 178 variantes ("DESCONTADO 30/04",
 * "cancela 29/05", "RESTA 100,000", "ok") y no había forma de saber cuánto
 * debía alguien sin leer 240 filas.
 *
 * Lo único que no se puede derivar es la decisión de dar un préstamo por
 * perdido, y por eso INCOBRABLE entra como flag y pisa al resto.
 */
export function estadoPrestamo(input: {
  montoOriginal: number
  saldo: number
  marcadoIncobrable: boolean
}): EstadoPrestamo {
  if (input.marcadoIncobrable) return 'INCOBRABLE'
  if (input.saldo <= 0) return 'CANCELADO'
  if (input.saldo < input.montoOriginal) return 'PARCIAL'
  return 'ABIERTO'
}

// ---------------------------------------------------------------------------
// Servicios referenciados
// ---------------------------------------------------------------------------

/**
 * Lo que le queda a Admon por intermediar el servicio.
 *
 * Mensajería entrega el 100% y da 0; los exámenes médicos dejan la comisión.
 * Se calcula por operación y no se configura: en junio-2026 la comisión de
 * exámenes fue 10.000 en dos casos y 15.000 en otros dos.
 */
export function margenServicio(
  valorFacturado: number,
  valorEntregado: number
): number {
  return redondearMonto(valorFacturado - valorEntregado)
}

export type EstadoServicio =
  | 'PENDIENTE_COBRO'
  | 'COBRADO_SIN_ENTREGAR'
  | 'ENTREGADO_SIN_COBRAR'
  | 'COMPLETO'

/**
 * En qué punto del ciclo está el servicio.
 *
 * Con margen cero — el caso de mensajería — la rentabilidad no dice nada; lo
 * que importa es justamente esto: si entró todo lo cotizado, si salió todo lo
 * que había que entregar, y si hay plata de un tercero atascada en la caja.
 */
export function estadoServicio(input: {
  tieneIngreso: boolean
  tieneEgreso: boolean
}): EstadoServicio {
  if (input.tieneIngreso && input.tieneEgreso) return 'COMPLETO'
  if (input.tieneIngreso) return 'COBRADO_SIN_ENTREGAR'
  if (input.tieneEgreso) return 'ENTREGADO_SIN_COBRAR'
  return 'PENDIENTE_COBRO'
}

// ---------------------------------------------------------------------------
// Anulación
// ---------------------------------------------------------------------------

/**
 * Forma del contra-movimiento que anula a otro.
 *
 * Los movimientos no se editan ni se borran. Para revertir uno se crea su
 * espejo, y al sumarlos el efecto sobre el bolsillo queda en cero — sin que
 * ningún cálculo tenga que saber que hubo una anulación.
 *
 * Un TRASLADO se anula con otro TRASLADO en sentido contrario, no con un
 * INGRESO: la plata tiene que volver por donde vino.
 */
export function contraMovimiento(original: MovimientoParaSaldo): MovimientoParaSaldo {
  if (original.tipo === TipoMovimiento.TRASLADO) {
    return {
      tipo: TipoMovimiento.TRASLADO,
      monto: original.monto,
      // El destino pasa a ser el origen: la plata vuelve.
      bolsilloId: original.bolsilloDestinoId!,
      bolsilloDestinoId: original.bolsilloId,
    }
  }

  return {
    tipo:
      original.tipo === TipoMovimiento.INGRESO
        ? TipoMovimiento.EGRESO
        : TipoMovimiento.INGRESO,
    monto: original.monto,
    bolsilloId: original.bolsilloId,
    bolsilloDestinoId: null,
  }
}


// ---------------------------------------------------------------------------
// Reparto de un cobro entre los servicios que lo componen
// ---------------------------------------------------------------------------
//
// Un documento de Alegra no es una venta de una cosa: es varias líneas, y esas
// líneas son el desglose del monto. Medido contra la cuenta de producción, de
// las 25 facturas más recientes NINGUNA tiene una sola línea — todas son
// `Administracion` + `Recaudo para Terceros`, y solo la primera es lo que gana
// la empresa.
//
// Hay dos descuadres que resolver, y por eso esto es una función y no una
// asignación directa:
//
//  1. LAS LÍNEAS NO SUMAN EL TOTAL. Suman el SUBTOTAL, sin impuestos. Con
//     números reales de la factura FEAD10134:
//
//       Administracion         63.025 × 2 = 126.050  (IVA 19%)
//       Recaudo para Terceros            = 579.000  (sin IVA)
//                                          ───────
//       subtotal                           705.050
//       total                              729.000
//
//     El IVA se le imputa a la línea que lo generó, no se reparte parejo:
//     126.050 × 1,19 = 150.000, y 150.000 + 579.000 = 729.000 exacto. Repartir
//     el IVA a prorrata le adjudicaría al recaudo un impuesto que no generó.
//
//  2. AL LIBRO ENTRA LO COBRADO, NO LO FACTURADO. Una factura a medio pagar
//     metió en caja solo lo que se pagó. La composición del documento se
//     mantiene y el cobro se reparte en esa proporción.

/** Una línea del documento, tal como llega de Alegra. */
export interface LineaDeDocumento {
  /** Id del item en Alegra. Es la identidad; el nombre puede cambiar. */
  itemId: string
  precio: number
  cantidad: number
  descuento?: number
  /** Porcentajes de impuesto de ESA línea (19 para un IVA del 19%). */
  impuestos?: number[]
}

/** Cuánto del cobro le toca a cada servicio. */
export interface ParteDeServicio {
  itemId: string
  /** Lo que entró a la caja por este servicio, IVA incluido. */
  monto: number
  /**
   * La parte de `monto` que es impuesto.
   *
   * El IVA no es ingreso: se cobra para girarlo a la DIAN, igual que el
   * recaudo para terceros. Se guarda por LÍNEA y no por servicio porque no es
   * una propiedad del servicio: medido contra la cuenta, "Afiliacion
   * Dependiente" aparece con 19% en unas facturas y sin impuesto en otras.
   */
  impuesto: number
}

/**
 * Reparte un cobro entre los servicios que componen el documento.
 *
 * Las líneas del mismo item se fusionan: la factura FEAD10127 trae "Recaudo
 * para Terceros" dos veces y la cotización 1191 trae "Liquidacion Planilla"
 * diez. Para reportar por servicio son una sola cosa.
 *
 * El residuo del redondeo lo absorbe la última parte, así que la suma da
 * EXACTAMENTE `montoCobrado`. Si no cerrara, el desglose contradiría al
 * movimiento que cuelga de él.
 *
 * Devuelve `[]` si no hay nada que repartir — sin líneas, con importes en cero
 * o con un cobro no positivo. El que llama decide qué hacer con eso; acá no se
 * inventa una asignación.
 */
export function repartirEntreServicios(
  lineas: LineaDeDocumento[],
  montoCobrado: number
): ParteDeServicio[] {
  if (montoCobrado <= 0) return []

  // Bruto e impuesto por línea. Se acumulan por separado porque un mismo item
  // puede venir con impuesto en una línea y sin él en otra.
  const porItem = new Map<string, { bruto: number; impuesto: number }>()

  for (const linea of lineas) {
    const neto = linea.precio * linea.cantidad - (linea.descuento ?? 0)
    if (neto <= 0) continue

    const tasa = (linea.impuestos ?? []).reduce((acc, pct) => acc + pct / 100, 0)
    const impuesto = neto * tasa

    const acc = porItem.get(linea.itemId) ?? { bruto: 0, impuesto: 0 }
    acc.bruto += neto + impuesto
    acc.impuesto += impuesto
    porItem.set(linea.itemId, acc)
  }

  const totalBruto = [...porItem.values()].reduce((acc, v) => acc + v.bruto, 0)
  if (totalBruto <= 0) return []

  // De mayor a menor, y determinista: el residuo del redondeo lo absorbe la
  // parte más grande, que es donde menos se nota.
  const items = [...porItem.entries()].sort((a, b) => b[1].bruto - a[1].bruto)

  const partes = items
    .map(([itemId, v]) => {
      const monto = redondearMonto((v.bruto / totalBruto) * montoCobrado)
      return {
        itemId,
        monto,
        // El impuesto se prorratea con la MISMA proporción que el monto: si se
        // cobró la mitad de la factura, se cobró la mitad del IVA.
        impuesto: redondearMonto(monto * (v.impuesto / v.bruto)),
      }
    })
    // Una parte puede redondear a cero si su peso es despreciable frente al
    // cobro. Guardar un desglose de cero es ruido: no dice que se cobró ese
    // servicio. Se descartan ANTES de cuadrar, no después, porque si no el
    // ajuste se va con ellas y la suma deja de dar el monto del movimiento.
    .filter((parte) => parte.monto > 0)

  if (partes.length === 0) return []

  const residuo = redondearMonto(
    montoCobrado - partes.reduce((acc, parte) => redondearMonto(acc + parte.monto), 0)
  )
  partes[0]!.monto = redondearMonto(partes[0]!.monto + residuo)

  // El ajuste podría dejar la parte mayor en cero o negativa solo si el cobro
  // es más chico que el redondeo de las demás. En ese caso el reparto no
  // significa nada y es más honesto no devolver ninguno.
  return partes[0]!.monto > 0 ? partes : []
}


// ---------------------------------------------------------------------------
// Cuánto de lo que entró es ingreso de verdad
// ---------------------------------------------------------------------------
//
// No todo lo que entra se gana. En las facturas de venta viaja el "Recaudo
// para Terceros": plata que entra y vuelve a salir, y que en las 25 facturas
// más recientes de la cuenta va SIEMPRE junto a `Administracion`. De una
// factura de 729.000, solo 150.000 son de Admon.
//
// EL SALDO DEL BOLSILLO NO CAMBIA. Los 729.000 entraron al banco de verdad y
// la caja tiene que seguir cuadrando contra el extracto. Lo que se corrige es
// la MÉTRICA DE INGRESO, que es otra cosa.
//
// La cobertura se informa junto al número a propósito. El desglose por
// servicio existe solo desde que se importa con él, y los movimientos viejos
// no lo tienen: sin decir cuánto quedó afuera, "ingresos netos" parecería
// exacto cuando en realidad solo descontó la parte que pudo mirar.

export interface DetalleParaReporte {
  /** Tipo del MOVIMIENTO al que pertenece el detalle, no del detalle. */
  tipo: TipoMovimiento
  monto: number
  /** El servicio está marcado como plata en tránsito. */
  enTransito: boolean
}

export interface IngresoPorServicio {
  /** Ingresos que sí tienen desglose por servicio. */
  conDesglose: number
  /** Ingresos de los que no se sabe por qué servicio entraron. */
  sinDesglose: number
  /** Parte de los ingresos que es plata en tránsito: entra y vuelve a salir. */
  enTransito: number
  /** Lo que efectivamente se ganó: ingresos menos la plata en tránsito. */
  netos: number
}

/**
 * Separa, dentro de los ingresos, lo ganado de lo que solo pasó.
 *
 * Solo mira los detalles de movimientos de INGRESO. Los de EGRESO existen
 * —una anulación espeja el desglose del original— pero NO se restan acá, y es
 * deliberado: `totalIngresos` tampoco descuenta las anulaciones. Restarlas en
 * un solo número lo dejaría fuera de escala con el resto del reporte, donde
 * una anulación aparece del lado del egreso. Es la misma regla que ya rige
 * para el corte por categoría.
 */
export function ingresoPorServicio(
  totalIngresos: number,
  detalles: DetalleParaReporte[]
): IngresoPorServicio {
  const deIngresos = detalles.filter((d) => d.tipo === TipoMovimiento.INGRESO)

  const conDesglose = sumarMontos(deIngresos.map((d) => d.monto))
  const enTransito = sumarMontos(
    deIngresos.filter((d) => d.enTransito).map((d) => d.monto)
  )

  return {
    conDesglose,
    // Nunca negativo: el desglose de un movimiento suma su monto exacto, así
    // que no puede haber más desglose que ingresos. Se acota igual por si un
    // dato viejo o importado a mano se sale de esa garantía — un número
    // negativo acá se leería como un error del libro, no del dato.
    sinDesglose: Math.max(0, redondearMonto(totalIngresos - conDesglose)),
    enTransito,
    netos: redondearMonto(totalIngresos - enTransito),
  }
}


// ---------------------------------------------------------------------------
// Ingresos por naturaleza: "por debajo" (C) y "por arriba" (F)
// ---------------------------------------------------------------------------
//
// Para el negocio no son lo mismo y la base ya los separa en dos grupos de
// categoría. Sumarlos en un solo "ingresos del mes" pierde media razón de ser
// del módulo — es la misma distinción que llevó a que COBRO_COTIZACION y
// COBRO_FACTURA sean grupos distintos y no dos categorías del mismo grupo.
//
// El tercer bucket NO es relleno: un abono a préstamo o una devolución también
// son ingresos. Sin él, C + F no daría el total y las tarjetas mentirían por
// omisión.

export interface IngresoDeNaturaleza {
  /** Todo lo que entró por esta vía. */
  bruto: number
  /** Parte que es plata en tránsito: entra y vuelve a salir. */
  enTransito: number
  /**
   * IVA cobrado. Tampoco es ingreso: se cobra para girarlo a la DIAN.
   *
   * Solo aparece del lado de las facturas. Las cotizaciones no llevan IVA, y
   * lo que se cobra por debajo tampoco.
   */
  impuesto: number
  /** `bruto` menos la plata en tránsito y menos el IVA: lo que se ganó. */
  neto: number
  /**
   * De qué categorías se compone, de mayor a menor.
   *
   * Existe sobre todo por "otros": un número agregado que junta abonos a
   * préstamos, devoluciones y cargas manuales no se puede cuadrar contra nada.
   * Con el desglose al lado, sí.
   */
  porCategoria: Array<{ nombre: string; monto: number }>
}

export interface IngresosPorNaturaleza {
  /** "Por debajo": el documento es una cotización de Alegra. */
  cotizacion: IngresoDeNaturaleza
  /** "Por arriba": el documento es una factura de venta. */
  factura: IngresoDeNaturaleza
  /** Ni C ni F: abonos a préstamos, devoluciones, cargas manuales. */
  otros: IngresoDeNaturaleza
}

export interface MovimientoParaNaturaleza {
  tipo: TipoMovimiento
  grupo: GrupoCategoria
  categoria: string
  monto: number
  /** Desglose por servicio, si lo tiene. */
  detalles: Array<{ monto: number; enTransito: boolean; impuesto: number }>
}

/**
 * Separa los ingresos en cotización, factura y todo lo demás.
 *
 * Solo mira los movimientos de INGRESO. Un egreso con categoría de cobro no
 * existe en la práctica, pero si existiera —una anulación de un ingreso— no
 * tiene por qué restar acá: `totalIngresos` tampoco lo descuenta. Misma regla
 * que en `ingresoPorServicio`.
 */
export function ingresosPorNaturaleza(
  movimientos: MovimientoParaNaturaleza[]
): IngresosPorNaturaleza {
  const vacio = (): {
    montos: number[]
    transito: number[]
    impuestos: number[]
    categorias: Map<string, number[]>
  } => ({
    montos: [],
    transito: [],
    impuestos: [],
    categorias: new Map(),
  })

  const cubos = {
    cotizacion: vacio(),
    factura: vacio(),
    otros: vacio(),
  }

  for (const m of movimientos) {
    if (m.tipo !== TipoMovimiento.INGRESO) continue

    const cubo =
      m.grupo === GrupoCategoria.COBRO_COTIZACION
        ? cubos.cotizacion
        : m.grupo === GrupoCategoria.COBRO_FACTURA
          ? cubos.factura
          : cubos.otros

    cubo.montos.push(m.monto)
    cubo.categorias.set(m.categoria, [...(cubo.categorias.get(m.categoria) ?? []), m.monto])
    for (const d of m.detalles) {
      if (d.enTransito) {
        // Su monto ya sale entero; restarle además el IVA sería descontarlo
        // dos veces. En la práctica el recaudo y la mensajería van exentos.
        cubo.transito.push(d.monto)
      } else {
        cubo.impuestos.push(d.impuesto)
      }
    }
  }

  const cerrar = (c: ReturnType<typeof vacio>): IngresoDeNaturaleza => {
    const bruto = sumarMontos(c.montos)
    const enTransito = sumarMontos(c.transito)
    const impuesto = sumarMontos(c.impuestos)
    return {
      bruto,
      enTransito,
      impuesto,
      neto: redondearMonto(bruto - enTransito - impuesto),
      porCategoria: [...c.categorias.entries()]
        .map(([nombre, montos]) => ({ nombre, monto: sumarMontos(montos) }))
        .sort((a, b) => b.monto - a.monto),
    }
  }

  return {
    cotizacion: cerrar(cubos.cotizacion),
    factura: cerrar(cubos.factura),
    otros: cerrar(cubos.otros),
  }
}


// ---------------------------------------------------------------------------
// Servicios intermediados: lo que entra contra lo que sale
// ---------------------------------------------------------------------------
//
// Un servicio marcado "en tránsito" dice que su plata entra y vuelve a salir.
// Eso era, hasta ahora, una afirmación que nadie podía verificar: el ingreso
// vive en el desglose por servicio y el egreso en una categoría de movimiento,
// dos dimensiones que no se tocan. Atándolas se puede contrastar mes a mes.
//
// Medido contra los datos reales de 2026, el contraste no cierra ni de lejos:
// entraron 15.942.000 por mensajería y salieron 48.151.660 a Fawer. Por eso
// esta vista existe — un margen negativo todos los meses es información, no un
// error de la app.

export interface ServicioIntermediado {
  id: string
  nombre: string
  /** Categoría por la que sale. `null` = nunca se registró la salida. */
  categoriaEgresoId: string | null
  categoriaEgreso: string | null
}

export interface MovimientoParaContraste {
  periodo: string
  tipo: TipoMovimiento
  monto: number
  categoriaId: string
  /** Desglose por servicio del movimiento, si lo tiene. */
  detalles: Array<{ servicioAlegraId: string; monto: number }>
}

export interface MesIntermediado {
  periodo: string
  entro: number
  salio: number
  /** `entro` menos `salio`. Negativo = salió más de lo que entró. */
  margen: number
}

export interface ContrasteIntermediado {
  servicioId: string
  servicio: string
  /** `null` cuando el servicio no tiene categoría de egreso configurada. */
  categoriaEgreso: string | null
  meses: MesIntermediado[]
  totalEntro: number
  totalSalio: number
  totalMargen: number
}

/**
 * Contrasta, por mes, lo que entró por cada servicio en tránsito contra lo que
 * salió por su categoría de egreso.
 *
 * Un servicio SIN categoría de egreso igual aparece, con `salio` en cero y
 * `categoriaEgreso` en `null`. Esconderlo sería esconder el hallazgo: esa
 * plata entró al libro y su salida nunca se registró, así que está inflando el
 * saldo de los bolsillos.
 *
 * Los meses que salen son los que tuvieron movimiento de UNO de los dos lados.
 * Un mes en el que se pagó sin haber cobrado importa tanto como el inverso.
 */
export function contrastarIntermediados(
  servicios: ServicioIntermediado[],
  movimientos: MovimientoParaContraste[]
): ContrasteIntermediado[] {
  return servicios.map((servicio) => {
    const entroPorMes = new Map<string, number[]>()
    const salioPorMes = new Map<string, number[]>()

    for (const m of movimientos) {
      if (m.tipo === TipoMovimiento.INGRESO) {
        for (const d of m.detalles) {
          if (d.servicioAlegraId !== servicio.id) continue
          entroPorMes.set(m.periodo, [...(entroPorMes.get(m.periodo) ?? []), d.monto])
        }
      } else if (
        m.tipo === TipoMovimiento.EGRESO &&
        servicio.categoriaEgresoId !== null &&
        m.categoriaId === servicio.categoriaEgresoId
      ) {
        salioPorMes.set(m.periodo, [...(salioPorMes.get(m.periodo) ?? []), m.monto])
      }
    }

    const periodos = [
      ...new Set([...entroPorMes.keys(), ...salioPorMes.keys()]),
    ].sort()

    const meses = periodos.map((periodo) => {
      const entro = sumarMontos(entroPorMes.get(periodo) ?? [])
      const salio = sumarMontos(salioPorMes.get(periodo) ?? [])
      return { periodo, entro, salio, margen: sumarMontos([entro, -salio]) }
    })

    const totalEntro = sumarMontos(meses.map((m) => m.entro))
    const totalSalio = sumarMontos(meses.map((m) => m.salio))

    return {
      servicioId: servicio.id,
      servicio: servicio.nombre,
      categoriaEgreso: servicio.categoriaEgreso,
      meses,
      totalEntro,
      totalSalio,
      totalMargen: sumarMontos([totalEntro, -totalSalio]),
    }
  })
}


// ---------------------------------------------------------------------------
// Nómina: la de arriba y la de abajo, juntas
// ---------------------------------------------------------------------------
//
// Alegra NO expone nómina en su API —no hay endpoints de empleados, contratos
// ni desprendibles—, así que la nómina se reconstruye desde los EGRESOS ya
// registrados. Eso tiene una ventaja que el endpoint no daría: junta las dos
// vías por las que esta empresa paga a su gente.
//
//   "Por arriba"  el pago está en Alegra (tiene alegraPaymentId)
//   "Por debajo"  no está en Alegra: viene del Excel o se cargó a mano
//
// La distinción NO es un campo aparte: es exactamente "¿este movimiento vino
// de un pago de Alegra?". Un flag separado se desincronizaría con el hecho.

export interface MovimientoDeNomina {
  periodo: string
  monto: number
  /** Nombre con el que se identifica a quien cobró. */
  persona: string
  /** El pago vive en Alegra. Si no, es "por debajo". */
  porArriba: boolean
  categoria: string
}

export interface FilaDeNomina {
  /** Persona o proveedor al que se le pagó. */
  persona: string
  porArriba: number
  porDebajo: number
  total: number
  movs: number
}

export interface MesDeNomina {
  periodo: string
  porArriba: number
  porDebajo: number
  total: number
}

export interface ResumenNomina {
  meses: MesDeNomina[]
  personas: FilaDeNomina[]
  categorias: FilaDeNomina[]
  totalPorArriba: number
  totalPorDebajo: number
  total: number
}

/**
 * Arma el resumen de nómina desde los movimientos ya registrados.
 *
 * Las personas NO se fusionan por parecido de nombre. En estos datos conviven
 * "ANDREA" (del Excel) y "ANDREA BEDOYA" (de Alegra), y también existe
 * "DANIELA ARANGO BEDOYA": adivinar cuál es cuál mezclaría el sueldo de dos
 * personas distintas. Aparecen como filas separadas hasta que alguien las una
 * a propósito asignándoles la misma contraparte, y la pantalla lo dice.
 */
export function resumirNomina(movimientos: MovimientoDeNomina[]): ResumenNomina {
  const porMes = new Map<string, { arriba: number[]; abajo: number[] }>()
  const porPersona = new Map<string, { arriba: number[]; abajo: number[]; movs: number }>()
  const porCategoria = new Map<string, { arriba: number[]; abajo: number[]; movs: number }>()

  const vacio = () => ({ arriba: [] as number[], abajo: [] as number[], movs: 0 })

  for (const m of movimientos) {
    const mes = porMes.get(m.periodo) ?? { arriba: [], abajo: [] }
    const persona = porPersona.get(m.persona) ?? vacio()
    const categoria = porCategoria.get(m.categoria) ?? vacio()

    const lado = m.porArriba ? 'arriba' : 'abajo'
    mes[lado].push(m.monto)
    persona[lado].push(m.monto)
    categoria[lado].push(m.monto)
    persona.movs += 1
    categoria.movs += 1

    porMes.set(m.periodo, mes)
    porPersona.set(m.persona, persona)
    porCategoria.set(m.categoria, categoria)
  }

  const aFilas = (
    mapa: Map<string, { arriba: number[]; abajo: number[]; movs: number }>
  ): FilaDeNomina[] =>
    [...mapa.entries()]
      .map(([persona, v]) => {
        const porArriba = sumarMontos(v.arriba)
        const porDebajo = sumarMontos(v.abajo)
        return {
          persona,
          porArriba,
          porDebajo,
          total: sumarMontos([porArriba, porDebajo]),
          movs: v.movs,
        }
      })
      .sort((a, b) => b.total - a.total)

  const meses = [...porMes.entries()]
    .map(([periodo, v]) => {
      const porArriba = sumarMontos(v.arriba)
      const porDebajo = sumarMontos(v.abajo)
      return { periodo, porArriba, porDebajo, total: sumarMontos([porArriba, porDebajo]) }
    })
    .sort((a, b) => a.periodo.localeCompare(b.periodo))

  const totalPorArriba = sumarMontos(meses.map((m) => m.porArriba))
  const totalPorDebajo = sumarMontos(meses.map((m) => m.porDebajo))

  return {
    meses,
    personas: aFilas(porPersona),
    categorias: aFilas(porCategoria),
    totalPorArriba,
    totalPorDebajo,
    total: sumarMontos([totalPorArriba, totalPorDebajo]),
  }
}


// ---------------------------------------------------------------------------
// Egreso real: lo que gastó la empresa, sin la plata que solo pasa
// ---------------------------------------------------------------------------
//
// "Egresos del mes" mostraba todo lo que salió, y en esta empresa eso miente
// por lo alto. Julio de 2026: salieron 84.432.347, pero 63.875.000 son plata
// que había entrado para volver a salir —el recaudo para terceros y lo que se
// le paga a Fawer por mensajería—. Lo que gastó la empresa fueron 20.557.347.
//
// Un número tres veces más grande que el real no es un detalle de
// presentación: es la diferencia entre creer que se gastan 84 millones al mes
// y saber que se gastan 20.
//
// QUÉ CUENTA COMO "ENTRA Y SALE"
//
// Las categorías de egreso atadas a un ServicioAlegra marcado `enTransito`.
// No hay una lista aparte: es la MISMA configuración que alimenta la pestaña
// "Entra y sale" del reporte. Dos fuentes de verdad para lo mismo se
// desincronizan, y la primera vez que alguien marque un servicio nuevo se
// olvidaría de la otra.

export interface MovimientoParaEgreso {
  tipo: TipoMovimiento
  monto: number
  categoriaId: string
  categoria: string
  esNomina: boolean
}

export interface EgresoReal {
  /** Todo lo que salió, traslados aparte. */
  bruto: number
  /** La parte que había entrado para volver a salir. */
  enTransito: number
  /** Lo que gastó la empresa de verdad. */
  neto: number
  /** Cuánto del gasto real es el equipo. */
  nomina: number
  /** De qué categorías es la plata en tránsito, de mayor a menor. */
  porCategoriaEnTransito: Array<{ nombre: string; monto: number }>
}

/**
 * Separa, dentro de los egresos, lo gastado de lo que solo pasó.
 *
 * Los TRASLADOS no entran: mover plata entre bolsillos no es un egreso, y el
 * resto del libro ya los trata así.
 */
export function egresoRealDelPeriodo(
  movimientos: MovimientoParaEgreso[],
  categoriasEnTransito: Set<string>
): EgresoReal {
  const todos: number[] = []
  const transito: number[] = []
  const nomina: number[] = []
  const porCategoria = new Map<string, number[]>()

  for (const m of movimientos) {
    if (m.tipo !== TipoMovimiento.EGRESO) continue

    todos.push(m.monto)

    if (categoriasEnTransito.has(m.categoriaId)) {
      transito.push(m.monto)
      porCategoria.set(m.categoria, [...(porCategoria.get(m.categoria) ?? []), m.monto])
      // Un egreso en tránsito no cuenta como nómina aunque su categoría lo
      // esté: no es plata que se le pagó al equipo, es plata que pasó.
      continue
    }

    if (m.esNomina) nomina.push(m.monto)
  }

  const bruto = sumarMontos(todos)
  const enTransito = sumarMontos(transito)

  return {
    bruto,
    enTransito,
    neto: redondearMonto(bruto - enTransito),
    nomina: sumarMontos(nomina),
    porCategoriaEnTransito: [...porCategoria.entries()]
      .map(([nombre, montos]) => ({ nombre, monto: sumarMontos(montos) }))
      .sort((a, b) => b.monto - a.monto),
  }
}


// ---------------------------------------------------------------------------
// Desglose del mes: qué hay adentro de cada uno de los cuatro números
// ---------------------------------------------------------------------------
//
// Las tarjetas del resumen dicen CUÁNTO. Esto dice DE QUÉ. Sin el desglose, un
// "gastó 20.557.347" obliga a irse a Movimientos y filtrar a mano para saber si
// el mes fue caro por la nómina, por un impuesto o por un arreglo de oficina.
//
// Cada lista suma exactamente el número de su tarjeta. Si no cerrara, el
// desglose contradiría al total que tiene arriba.

export interface FilaDesglose {
  nombre: string
  monto: number
  movs: number
}

export interface DesgloseDelMes {
  /** Ingresos por cotización, abiertos por servicio. */
  cotizacion: FilaDesglose[]
  /** Ingresos por factura, abiertos por servicio y ya sin la plata en tránsito. */
  factura: FilaDesglose[]
  /** El gasto real, abierto por categoría. */
  egresos: FilaDesglose[]
  /** La nómina del mes, abierta por persona. */
  nomina: FilaDesglose[]
}

export interface MovimientoParaDesglose {
  tipo: TipoMovimiento
  monto: number
  grupo: GrupoCategoria
  categoriaId: string
  categoria: string
  esNomina: boolean
  /** Con qué nombre se identifica a quien cobró. Solo se usa en la nómina. */
  persona: string
  detalles: Array<{
    servicio: string
    monto: number
    enTransito: boolean
    impuesto: number
  }>
}

/** Etiqueta de los cobros que entraron sin desglose por servicio. */
export const SIN_DESGLOSE = 'Sin desglose por servicio'

/**
 * Abre los cuatro números del resumen en sus componentes.
 *
 * Los cobros SIN desglose por servicio no se esconden: aparecen como una fila
 * propia. Omitirlos haría que la lista sumara menos que la tarjeta, y una lista
 * que no cuadra con su total no se puede usar para nada.
 */
export function desglosarPeriodo(
  movimientos: MovimientoParaDesglose[],
  categoriasEnTransito: Set<string>
): DesgloseDelMes {
  const cotizacion = new Map<string, number[]>()
  const factura = new Map<string, number[]>()
  const egresos = new Map<string, number[]>()
  const nomina = new Map<string, number[]>()

  const sumar = (mapa: Map<string, number[]>, clave: string, monto: number) =>
    mapa.set(clave, [...(mapa.get(clave) ?? []), monto])

  for (const m of movimientos) {
    if (m.tipo === TipoMovimiento.INGRESO) {
      const destino =
        m.grupo === GrupoCategoria.COBRO_COTIZACION
          ? cotizacion
          : m.grupo === GrupoCategoria.COBRO_FACTURA
            ? factura
            : null
      if (!destino) continue

      if (m.detalles.length === 0) {
        sumar(destino, SIN_DESGLOSE, m.monto)
        continue
      }
      // La plata en tránsito se saca acá, no después: la tarjeta muestra el
      // neto y la lista tiene que sumar lo mismo.
      // La plata en tránsito Y EL IVA se sacan acá, no después: la tarjeta
      // muestra el neto y la lista tiene que sumar lo mismo.
      for (const d of m.detalles) {
        if (!d.enTransito) sumar(destino, d.servicio, redondearMonto(d.monto - d.impuesto))
      }
      continue
    }

    if (m.tipo !== TipoMovimiento.EGRESO) continue
    // Un egreso en tránsito no es gasto de la empresa ni nómina: solo pasó.
    if (categoriasEnTransito.has(m.categoriaId)) continue

    sumar(egresos, m.categoria, m.monto)
    if (m.esNomina) sumar(nomina, m.persona, m.monto)
  }

  const aFilas = (mapa: Map<string, number[]>): FilaDesglose[] =>
    [...mapa.entries()]
      .map(([nombre, montos]) => ({
        nombre,
        monto: sumarMontos(montos),
        movs: montos.length,
      }))
      .filter((f) => f.monto !== 0)
      .sort((a, b) => b.monto - a.monto)

  return {
    cotizacion: aFilas(cotizacion),
    factura: aFilas(factura),
    egresos: aFilas(egresos),
    nomina: aFilas(nomina),
  }
}
