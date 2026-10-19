/**
 * Issuer contract for the payment receipt (Recibo de pago).
 *
 * The values themselves live in the database (`configuracion_empresa`, edited
 * from Settings) and are resolved by `obtenerEmisorRecibo()`. Any field that is
 * missing is left blank, so the PDF prints nothing for it rather than a
 * placeholder; `emisorReciboCompleto()` flags that state.
 */

export const PLACEHOLDER_EMISOR = ''

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

/** True only when every issuer field has a value. */
export function emisorReciboCompleto(emisor: Readonly<EmisorRecibo>): boolean {
  return Object.values(emisor).every((valor) => valor !== PLACEHOLDER_EMISOR)
}
