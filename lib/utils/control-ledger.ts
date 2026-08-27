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
