/**
 * Fechas de novedades entre la base y la UI.
 *
 * La base guarda cada fecha a medianoche UTC del día elegido. `date-fns` y el
 * calendario trabajan en hora local: en Bogotá (UTC-5), la medianoche UTC del
 * 9 es el 8 a las 7 p. m., así que sin convertir se mostraría un día antes.
 */

/** El día calendario guardado, como medianoche local de ese mismo día. */
export function fechaGuardadaComoLocal(fecha: Date | string): Date {
  const d = new Date(fecha)
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

/**
 * Medianoche local de hoy. `new Date()` a las 8 p. m. en Bogotá ya es el día
 * siguiente en UTC, y el servidor guarda el día UTC.
 */
export function hoyLocal(): Date {
  const ahora = new Date()
  return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
}
