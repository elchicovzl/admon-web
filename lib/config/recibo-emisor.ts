/**
 * Issuer data printed on the payment receipt (Recibo de pago).
 *
 * The legal values are not known yet, so they are explicit placeholders. The
 * feature must not be released while `emisorReciboCompleto()` returns false.
 * Do not invent a NIT, address or phone: replace 'PENDIENTE' with the literal
 * values provided by the company.
 */

export const PLACEHOLDER_EMISOR = 'PENDIENTE'

export const EMISOR_RECIBO = {
  razonSocial: PLACEHOLDER_EMISOR,
  nit: PLACEHOLDER_EMISOR,
  direccion: PLACEHOLDER_EMISOR,
  ciudad: PLACEHOLDER_EMISOR,
  telefono: PLACEHOLDER_EMISOR,
  email: 'contacto@administracionsegura.co',
  // Relative to the project root. PNG on purpose: react-pdf cannot render webp.
  logoPath: 'public/images/logo-wordmark.png',
} as const

/**
 * True only when no issuer field is still the 'PENDIENTE' placeholder.
 * The issuer is injectable so the check is testable independent of the
 * release state of `EMISOR_RECIBO`.
 */
export function emisorReciboCompleto(
  emisor: Readonly<Record<string, string>> = EMISOR_RECIBO
): boolean {
  return Object.values(emisor).every((valor) => valor !== PLACEHOLDER_EMISOR)
}
