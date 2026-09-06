/**
 * Formateo del módulo Control.
 *
 * Deliberadamente NO se reutiliza el formateador de lib/alegra: aquel lee la
 * moneda y el separador decimal de la configuración de la cuenta de Alegra, y
 * este libro no depende de Alegra en nada. Son dos libros separados y el
 * acoplamiento tendría que justificarse por algo más que ahorrar diez líneas.
 */

/** Pesos colombianos, sin decimales: el libro no maneja centavos en la práctica. */
const FORMATO_COP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

/** Con centavos, para cuando la diferencia de un cierre no es redonda. */
const FORMATO_COP_EXACTO = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/**
 * "$ 1.234.567". Si el monto tiene centavos los muestra, porque redondear un
 * descuadre es la forma más rápida de esconderlo.
 */
export function formatearMonto(monto: number): string {
  const tieneCentavos = Math.round(monto * 100) % 100 !== 0
  return (tieneCentavos ? FORMATO_COP_EXACTO : FORMATO_COP).format(monto)
}

/** Igual que formatearMonto pero con signo explícito. Para diferencias. */
export function formatearDiferencia(monto: number): string {
  if (monto === 0) return formatearMonto(0)
  return `${monto > 0 ? '+' : '−'}${formatearMonto(Math.abs(monto))}`
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/** "2026-08" → "agosto 2026". */
export function formatearPeriodo(periodo: string): string {
  const [anio, mes] = periodo.split('-').map(Number)
  const nombre = MESES[mes - 1]
  return nombre ? `${nombre} ${anio}` : periodo
}

/**
 * Formatea una fecha de calendario leyendo sus componentes UTC.
 *
 * Las fechas del libro se guardan como `@db.Date` fijadas a medianoche UTC. Si
 * se formatearan con los componentes locales, en Bogotá (UTC-5) toda fecha se
 * mostraría un día antes de lo que dice la base.
 */
export function formatearFecha(fecha: Date): string {
  const dia = String(fecha.getUTCDate()).padStart(2, '0')
  const mes = String(fecha.getUTCMonth() + 1).padStart(2, '0')
  return `${dia}/${mes}/${fecha.getUTCFullYear()}`
}

/** "27 de agosto de 2026", para encabezados. */
export function formatearFechaLarga(fecha: Date): string {
  return `${fecha.getUTCDate()} de ${MESES[fecha.getUTCMonth()]} de ${fecha.getUTCFullYear()}`
}

/** Fecha de hoy como "AAAA-MM-DD", el formato que esperan los schemas. */
export function hoyComoFechaCalendario(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Periodo actual como "AAAA-MM". */
export function periodoActual(): string {
  return new Date().toISOString().slice(0, 7)
}
