/**
 * Issuer contract for the payment receipt (Recibo de pago).
 *
 * The values themselves live in the database (`configuracion_empresa`, edited
 * from Settings) and are resolved by `obtenerEmisorRecibo()`. Any field that is
 * missing falls back to the explicit 'PENDIENTE' placeholder; the feature must
 * not be released while `emisorReciboCompleto()` returns false.
 */

export const PLACEHOLDER_EMISOR = 'PENDIENTE'

/** Fixed primary key of the singleton `configuracion_empresa` row. */
export const CONFIGURACION_EMPRESA_ID = 'default'

export interface EmisorRecibo {
  razonSocial: string
  nit: string
  direccion: string
  ciudad: string
  telefono: string
  email: string
}

// Relative to the project root. PNG on purpose: react-pdf cannot render webp.
export const RECIBO_LOGO_PATH = 'public/images/logo-wordmark.png'

/** True only when no issuer field is still the 'PENDIENTE' placeholder. */
export function emisorReciboCompleto(emisor: Readonly<EmisorRecibo>): boolean {
  return Object.values(emisor).every((valor) => valor !== PLACEHOLDER_EMISOR)
}
