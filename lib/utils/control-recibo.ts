/**
 * Lógica pura del recibo de pago (módulo Control).
 *
 * Igual que `control-ledger.ts`: sin Prisma, sin sesión, sin I/O. Acá viven las
 * reglas de emisión, el formato del número, el monto en letras y el modelo de
 * vista que luego pinta el PDF. Los server actions solo orquestan.
 *
 * A receipt is a Control-owned document for an income charged without an
 * Alegra invoice. It never goes to Alegra or DIAN.
 */

import { sumarMontos } from '@/lib/utils/control-ledger'

/** Key of the `Consecutivo` row that numbers receipts. */
export const CLAVE_CONSECUTIVO_RECIBO = 'RECIBO_PAGO'

// ---------------------------------------------------------------------------
// Número
// ---------------------------------------------------------------------------

/** 1 → "RP-0001". Numbers above 9999 keep all their digits ("RP-12345"). */
export function formatearNumeroRecibo(numero: number): string {
  return `RP-${String(numero).padStart(4, '0')}`
}

// ---------------------------------------------------------------------------
// Monto en letras
// ---------------------------------------------------------------------------

const MAXIMO_EN_LETRAS = 999_999_999_999

const HASTA_VEINTINUEVE = [
  'CERO', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO',
  'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS',
  'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIUNO', 'VEINTIDÓS',
  'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE',
  'VEINTIOCHO', 'VEINTINUEVE',
]

const DECENAS = [
  '', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA',
  'OCHENTA', 'NOVENTA',
]

const CENTENAS = [
  '', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS',
  'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS',
]

/**
 * Words for 1..999. With `apocope` a trailing UNO / VEINTIUNO becomes UN /
 * VEINTIÚN, which is what Spanish requires before MIL, MILLÓN(ES) and PESOS.
 */
function menorAMil(n: number, apocope: boolean): string {
  if (n === 100) return 'CIEN'

  const partes: string[] = []
  const centena = Math.floor(n / 100)
  const resto = n % 100
  if (centena > 0) partes.push(CENTENAS[centena]!)

  if (resto > 0) {
    if (resto < 30) {
      partes.push(HASTA_VEINTINUEVE[resto]!)
    } else {
      const unidad = resto % 10
      const decena = DECENAS[Math.floor(resto / 10)]!
      partes.push(unidad === 0 ? decena : `${decena} Y ${HASTA_VEINTINUEVE[unidad]!}`)
    }
  }

  const texto = partes.join(' ')
  if (!apocope) return texto
  return texto.replace(/VEINTIUNO$/, 'VEINTIÚN').replace(/UNO$/, 'UN')
}

/** Words for 1..999,999 (the part below one million). */
function menorAMillon(n: number, apocope: boolean): string {
  const miles = Math.floor(n / 1000)
  const resto = n % 1000

  const partes: string[] = []
  if (miles === 1) partes.push('MIL')
  else if (miles > 1) partes.push(`${menorAMil(miles, true)} MIL`)
  if (resto > 0) partes.push(menorAMil(resto, apocope))
  return partes.join(' ')
}

/**
 * Amount in Colombian pesos, in words and uppercase.
 *
 *   1250000 → "UN MILLÓN DOSCIENTOS CINCUENTA MIL PESOS M/CTE"
 *   2000000 → "DOS MILLONES DE PESOS M/CTE"
 *   1000.5  → "MIL PESOS CON 50/100 M/CTE"
 *
 * Throws on negative, non-finite or too large input: a receipt must never
 * print a made-up figure.
 */
export function montoEnLetras(monto: number): string {
  if (!Number.isFinite(monto) || monto < 0) {
    throw new Error(`Monto inválido para convertir a letras: ${monto}`)
  }

  const centavosTotales = Math.round(monto * 100)
  const pesos = Math.floor(centavosTotales / 100)
  const centavos = centavosTotales % 100
  if (pesos > MAXIMO_EN_LETRAS) {
    throw new Error(`Monto demasiado grande para convertir a letras: ${monto}`)
  }

  const millones = Math.floor(pesos / 1_000_000)
  const resto = pesos % 1_000_000

  const partes: string[] = []
  if (millones === 1) partes.push('UN MILLÓN')
  else if (millones > 1) partes.push(`${menorAMillon(millones, true)} MILLONES`)
  if (resto > 0) partes.push(menorAMillon(resto, true))
  if (pesos === 0) partes.push('CERO')

  // "DOS MILLONES DE PESOS", but "DOS MILLONES QUINIENTOS MIL PESOS".
  const exactoEnMillones = millones > 0 && resto === 0
  partes.push(exactoEnMillones ? 'DE PESOS' : pesos === 1 ? 'PESO' : 'PESOS')

  const sufijoCentavos =
    centavos > 0 ? ` CON ${String(centavos).padStart(2, '0')}/100` : ''
  return `${partes.join(' ')}${sufijoCentavos} M/CTE`
}

// ---------------------------------------------------------------------------
// Reglas de emisión
// ---------------------------------------------------------------------------

export interface EntradaValidarEmisionRecibo {
  tipo: string
  monto: number
  alegraInvoiceId: string | null
  alegraEstimateId: string | null
  alegraPaymentId: string | null
  tieneRecibo: boolean
  cliente: { nombre: string } | null
  lineas: Array<{ monto: number }>
}

export type ResultadoValidacionRecibo = { ok: true } | { ok: false; error: string }

/**
 * Checks, in order, whether a receipt can be issued for an income. The first
 * broken rule wins, so the user sees one actionable message at a time.
 */
export function validarEmisionRecibo(
  input: EntradaValidarEmisionRecibo
): ResultadoValidacionRecibo {
  if (input.tipo !== 'INGRESO') {
    return { ok: false, error: 'Solo se puede emitir recibo para un ingreso.' }
  }
  if (input.alegraInvoiceId || input.alegraEstimateId || input.alegraPaymentId) {
    return {
      ok: false,
      error: 'Este ingreso viene de un documento de Alegra y no admite recibo de pago.',
    }
  }
  if (input.tieneRecibo) {
    return { ok: false, error: 'Este ingreso ya tiene un recibo de pago.' }
  }
  if (!input.cliente) {
    return { ok: false, error: 'El recibo requiere un cliente.' }
  }
  if (input.lineas.length === 0) {
    return { ok: false, error: 'El recibo requiere al menos un servicio.' }
  }
  if (input.lineas.some((linea) => !(linea.monto > 0))) {
    return { ok: false, error: 'Cada servicio del recibo debe tener un monto mayor a cero.' }
  }
  if (sumarMontos(input.lineas.map((linea) => linea.monto)) !== input.monto) {
    return {
      ok: false,
      error: 'La suma de los servicios debe ser igual al monto del ingreso.',
    }
  }
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Modelo de vista del PDF
// ---------------------------------------------------------------------------

export interface EntradaArmarDatosRecibo {
  numero: number
  fecha: Date
  clienteNombre: string
  clienteDocumento: string | null
  lineas: Array<{ servicio: string; referencia: string | null; monto: number }>
  /** Movement amount; must equal the sum of the lines. */
  monto: number
  bolsilloNombre: string
  concepto: string
  anulado: boolean
}

export interface DatosRecibo {
  numeroFormateado: string
  fecha: Date
  cliente: { nombre: string; documento: string | null }
  lineas: Array<{ servicio: string; referencia: string | null; monto: number }>
  total: number
  totalEnLetras: string
  medioDePago: string
  concepto: string
  anulado: boolean
}

/** Builds the plain view model the PDF renders. No Prisma types, no I/O. */
export function armarDatosRecibo(input: EntradaArmarDatosRecibo): DatosRecibo {
  return {
    numeroFormateado: formatearNumeroRecibo(input.numero),
    fecha: input.fecha,
    cliente: { nombre: input.clienteNombre, documento: input.clienteDocumento },
    lineas: input.lineas.map((l) => ({
      servicio: l.servicio,
      referencia: l.referencia,
      monto: l.monto,
    })),
    total: input.monto,
    totalEnLetras: montoEnLetras(input.monto),
    medioDePago: input.bolsilloNombre,
    concepto: input.concepto,
    anulado: input.anulado,
  }
}
