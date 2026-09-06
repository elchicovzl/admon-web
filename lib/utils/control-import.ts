/**
 * Importación de cobros en tandas.
 *
 * Puro: sin React, sin Prisma, sin red. Recibe la función que hace el trabajo
 * y la va llamando de a pedazos. Vive acá y no dentro del componente por la
 * misma razón que los cálculos del libro — es lógica con casos de borde
 * (tandas parciales, fallas a mitad de camino, acumulados) y merece tests
 * propios en vez de quedar escondida en un `onClick`.
 *
 * POR QUÉ EN TANDAS Y NO DE UNA
 *
 * Desde que cada documento se desglosa por servicio, importar exige pedirle a
 * Alegra el detalle de CADA uno: los `items` no vienen en la lista. Un mes con
 * 81 cotizaciones son 81 requests secuenciales. Mandarlos en una sola Server
 * Action deja un request HTTP abierto más de un minuto, y si el proxy lo corta
 * el operador no sabe qué quedó registrado y qué no.
 *
 * Partido en tandas se arreglan tres cosas a la vez:
 *
 *   1. El progreso es REAL, no una animación que finge avanzar.
 *   2. Ninguna petición vive lo suficiente como para que la corten.
 *   3. Si una tanda falla, las anteriores YA están registradas. La acción es
 *      idempotente por el índice único de `alegraEstimateId` /
 *      `alegraInvoiceId`, así que reintentar no duplica nada.
 *
 * Las tandas van UNA DETRÁS DE OTRA, nunca en paralelo: el limitador de Alegra
 * vive en el proceso del servidor y disparar cinco tandas juntas se comería la
 * cuota de 150 req/min de toda la cuenta, incluida cualquier otra integración
 * que use el mismo token.
 */

/**
 * Diez por tanda.
 *
 * Es el punto medio entre las dos cosas que se pelean: tandas chicas dan un
 * progreso más fino pero repiten el trabajo fijo de cada llamada (leer la
 * lista del mes, resolver bolsillo y categoría); tandas grandes lo amortizan
 * pero el contador se queda quieto más tiempo. Con diez, un mes de ochenta
 * documentos avanza ocho veces y ninguna petición pasa de unos segundos.
 */
export const TAMANO_TANDA = 10

export interface ResultadoTanda {
  creados: number
  /** Documentos registrados sin desglose por servicio, si aplica. */
  sinDesglose?: number
}

export interface RespuestaTanda {
  success: boolean
  error?: string
  data?: ResultadoTanda
}

export interface ProgresoImportacion {
  total: number
  procesados: number
  creados: number
  sinDesglose: number
}

export interface ResultadoImportacion {
  /**
   * Los ids que sí se procesaron.
   *
   * El que llama desmarca SOLO estos: si la tanda cuatro falló, los de la
   * cinco en adelante siguen pendientes y tienen que quedar marcados para
   * poder reintentar sin volver a elegirlos uno por uno.
   */
  completados: string[]
  error?: string
  resumen: ProgresoImportacion
}

/**
 * Corre `ejecutar` por tandas, avisando el avance después de cada una.
 *
 * Se corta en la primera tanda que falle. Seguir con las que quedan sería
 * peor: si Alegra dejó de responder o el periodo se cerró, las siguientes van
 * a fallar igual y el operador termina con una fila de errores en vez de un
 * mensaje que le diga dónde quedó.
 */
export async function correrEnTandas(
  ids: string[],
  ejecutar: (ids: string[]) => Promise<RespuestaTanda>,
  alAvanzar?: (progreso: ProgresoImportacion) => void,
  tamano: number = TAMANO_TANDA
): Promise<ResultadoImportacion> {
  const resumen: ProgresoImportacion = {
    total: ids.length,
    procesados: 0,
    creados: 0,
    sinDesglose: 0,
  }

  const completados: string[] = []

  // Un tamaño de tanda inválido convertiría el bucle en infinito.
  const paso = Math.max(1, Math.floor(tamano))

  for (let i = 0; i < ids.length; i += paso) {
    const tanda = ids.slice(i, i + paso)

    let r: RespuestaTanda
    try {
      r = await ejecutar(tanda)
    } catch (error) {
      // Una Server Action que revienta —red caída, deploy a mitad— llega acá
      // como excepción, no como `success: false`. Sin este catch, el hook
      // pierde el progreso y el operador no se entera de lo que sí entró.
      console.error('[control] tanda de importación falló:', error)
      return { completados, error: 'Se cortó la conexión durante la importación', resumen }
    }

    if (!r.success) {
      return { completados, error: r.error ?? 'No se pudo importar', resumen }
    }

    completados.push(...tanda)
    resumen.procesados += tanda.length
    resumen.creados += r.data?.creados ?? 0
    resumen.sinDesglose += r.data?.sinDesglose ?? 0
    alAvanzar?.({ ...resumen })
  }

  return { completados, resumen }
}

/** Porcentaje entero para la barra. Sin ids, no hay nada que dibujar. */
export function porcentajeDeAvance(progreso: ProgresoImportacion): number {
  if (progreso.total <= 0) return 0
  return Math.round((progreso.procesados / progreso.total) * 100)
}
