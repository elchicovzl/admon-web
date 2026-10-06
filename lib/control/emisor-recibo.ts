import prisma from '@/lib/db/prisma'
import {
  CONFIGURACION_EMPRESA_ID,
  PLACEHOLDER_EMISOR,
  type EmisorRecibo,
} from '@/lib/config/recibo-emisor'

const CAMPOS: ReadonlyArray<keyof EmisorRecibo> = [
  'razonSocial',
  'nit',
  'direccion',
  'ciudad',
  'telefono',
  'email',
]

/**
 * Resolves the issuer printed on the receipt from `configuracion_empresa`.
 * Falls back to PLACEHOLDER_EMISOR field by field when the row is missing or a
 * field is blank, so the PDF can still be produced (flagged as incomplete).
 */
export async function obtenerEmisorRecibo(): Promise<EmisorRecibo> {
  const fila = await prisma.configuracionEmpresa.findUnique({
    where: { id: CONFIGURACION_EMPRESA_ID },
  })

  const emisor = {} as EmisorRecibo
  for (const campo of CAMPOS) {
    const valor = fila?.[campo]?.trim()
    emisor[campo] = valor ? valor : PLACEHOLDER_EMISOR
  }
  return emisor
}
