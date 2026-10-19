/**
 * Resolves the CRM client chosen for a receipt to the `Contraparte` the receipt
 * hangs from (`ReciboPago.contraparteId` stays required; no schema change).
 *
 * It takes the caller's transaction so a counterparty created or linked here
 * rolls back together with the receipt number if anything later fails.
 */

import { Prisma, TipoContraparte } from '@prisma/client'

export interface ContraparteDeRecibo {
  id: string
  nombre: string
  documento: string | null
}

export type ResolucionCliente =
  | { ok: true; contraparte: ContraparteDeRecibo }
  | { ok: false; error: string }

const SELECT_CONTRAPARTE = { id: true, nombre: true, documento: true } as const

/**
 * Same shape `createContraparteSchema` accepts: digits only, 5 to 15. Anything
 * else ("901.485.874-1" is reduced to digits first) that does not fit comes
 * back as `null`, so the counterparty is created without a document instead of
 * with one the Contraparte catalog would never accept.
 */
export function normalizarDocumento(identificacion: string): string | null {
  const digitos = identificacion.replace(/\D/g, '')
  return /^\d{5,15}$/.test(digitos) ? digitos : null
}

export async function resolverContraparteDeCliente(
  tx: Prisma.TransactionClient,
  clientId: string,
  userId: string
): Promise<ResolucionCliente> {
  const cliente = await tx.client.findFirst({
    where: { id: clientId, isActive: true },
    select: { id: true, fullName: true, identificationNumber: true },
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
    },
  })

  const vinculada = await tx.contraparte.findUnique({
    where: { clientId: cliente.id },
    select: SELECT_CONTRAPARTE,
  })
  if (vinculada) return delCliente(vinculada.id)

  const documento = normalizarDocumento(cliente.identificationNumber)

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
