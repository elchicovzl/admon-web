/**
 * Resolves the CRM client chosen for a receipt to the `Contraparte` the receipt
 * hangs from (`ReciboPago.contraparteId` stays required; no schema change).
 *
 * It takes the caller's transaction so a counterparty created or linked here
 * rolls back together with the receipt number if anything later fails.
 */

import { Prisma, TipoContraparte } from '@prisma/client'
import { etiquetaTipoDocumento } from '@/lib/utils/control-recibo'

export interface ContraparteDeRecibo {
  id: string
  nombre: string
  documento: string | null
  /** Contact snapshot copied onto the receipt; null when the CRM has none. */
  tipoDocumento: string | null
  direccion: string | null
  ciudad: string | null
  telefono: string | null
}

export type ResolucionCliente =
  | { ok: true; contraparte: ContraparteDeRecibo }
  | { ok: false; error: string }

const SELECT_CONTRAPARTE = { id: true, nombre: true, documento: true } as const

const vacioANull = (valor: string | null | undefined): string | null =>
  valor?.trim() || null

/**
 * Same shape `createContraparteSchema` accepts: digits only, 5 to 15, and a NIT
 * stored without its DIAN check digit. Only separators (dots, hyphens, spaces)
 * are stripped; anything left that is not 5-15 digits (a passport such as
 * "AB123456") comes back as `null`, so the counterparty lookup by document is
 * skipped and the counterparty is created without one rather than matching an
 * unrelated record on the digits alone.
 */
export function normalizarDocumento(
  identificacion: string,
  tipo?: string | null
): string | null {
  let valor = identificacion.trim()
  // "901.485.874-1": the trailing "-<digit>" of a NIT is the check digit.
  if (tipo === 'NIT') valor = valor.replace(/\s*-\s*\d$/, '')
  const limpio = valor.replace(/[.\-\s]/g, '')
  return /^\d{5,15}$/.test(limpio) ? limpio : null
}

export async function resolverContraparteDeCliente(
  tx: Prisma.TransactionClient,
  clientId: string,
  userId: string
): Promise<ResolucionCliente> {
  const cliente = await tx.client.findFirst({
    where: { id: clientId, isActive: true },
    select: {
      id: true,
      fullName: true,
      identificationType: true,
      identificationNumber: true,
      phone: true,
      address: { select: { direccion: true, ciudad: true, municipio: true } },
    },
  })
  if (!cliente) return { ok: false, error: 'Cliente no encontrado' }

  // The receipt prints the client as the CRM has it, even when the document
  // does not fit the counterparty catalog (which then stores it as null).
  const delCliente = (id: string): ResolucionCliente => ({
    ok: true,
    contraparte: {
      id,
      nombre: cliente.fullName,
      documento: cliente.identificationNumber.trim() || null,
      tipoDocumento: etiquetaTipoDocumento(cliente.identificationType) || null,
      direccion: vacioANull(cliente.address?.direccion),
      ciudad: vacioANull(cliente.address?.ciudad) ?? vacioANull(cliente.address?.municipio),
      telefono: vacioANull(cliente.phone),
    },
  })

  const vinculada = await tx.contraparte.findUnique({
    where: { clientId: cliente.id },
    select: SELECT_CONTRAPARTE,
  })
  if (vinculada) return delCliente(vinculada.id)

  const documento = normalizarDocumento(
    cliente.identificationNumber,
    cliente.identificationType
  )

  if (documento) {
    const mismoDocumento = await tx.contraparte.findUnique({
      where: { documento },
      select: { ...SELECT_CONTRAPARTE, clientId: true },
    })

    if (mismoDocumento?.clientId) {
      return {
        ok: false,
        error: `El documento de ${cliente.fullName} ya está registrado en la contraparte "${mismoDocumento.nombre}", que pertenece a otro cliente.`,
      }
    }

    if (mismoDocumento) {
      await tx.contraparte.update({
        where: { id: mismoDocumento.id },
        data: { clientId: cliente.id },
      })
      return delCliente(mismoDocumento.id)
    }
  }

  const creada = await tx.contraparte.create({
    data: {
      nombre: cliente.fullName,
      tipo: TipoContraparte.CLIENTE,
      documento,
      clientId: cliente.id,
      createdById: userId,
    },
    select: { id: true },
  })
  return delCliente(creada.id)
}
