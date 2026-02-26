'use server'

import { auth } from '@/lib/auth/auth'
import prisma from '@/lib/db/prisma'
import { UserRole } from '@prisma/client'
import {
  clientAddressSchema,
  clientAdditionalInfoSchema,
  clientBeneficiarySchema,
  deleteBeneficiarySchema,
  type ClientAddressInput,
  type ClientAdditionalInfoInput,
  type ClientBeneficiaryInput,
} from '@/lib/validations/client-info.schema'
import type {
  ClientAddress,
  ClientAdditionalInfo,
  ClientBeneficiary,
} from '@/lib/types/client.types'
import type { ActionResponse } from '@/lib/types/auth.types'
import { revalidatePath } from 'next/cache'

/**
 * Check if user has SUPER_ADMIN or MANAGER role
 */
async function requireManagerOrAdmin() {
  const session = await auth()

  if (!session?.user) {
    return { authorized: false, error: 'No autenticado' }
  }

  if (session.user.role !== UserRole.SUPER_ADMIN && session.user.role !== UserRole.MANAGER) {
    return { authorized: false, error: 'No tienes permisos para esta acción' }
  }

  return { authorized: true, userId: session.user.id }
}

// ==================== CLIENT ADDRESS ACTIONS ====================

/**
 * Create or update client address
 */
export async function createOrUpdateClientAddress(
  clientId: string,
  data: ClientAddressInput
): Promise<ActionResponse<ClientAddress>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    // Validate input
    const validatedFields = clientAddressSchema.safeParse(data)
    if (!validatedFields.success) {
      return { success: false, error: 'Datos inválidos' }
    }

    // Check if client exists
    const client = await prisma.client.findUnique({ where: { id: clientId } })
    if (!client) {
      return { success: false, error: 'Cliente no encontrado' }
    }

    // Upsert address
    const address = await prisma.clientAddress.upsert({
      where: { clientId },
      update: validatedFields.data,
      create: {
        clientId,
        ...validatedFields.data,
      },
    })

    revalidatePath(`/dashboard/clients/${clientId}`)

    return {
      success: true,
      message: 'Dirección guardada exitosamente',
      data: address as ClientAddress,
    }
  } catch (error) {
    console.error('Create/update client address error:', error)
    return { success: false, error: 'Error al guardar dirección' }
  }
}

// ==================== CLIENT ADDITIONAL INFO ACTIONS ====================

/**
 * Create or update client additional info
 */
export async function createOrUpdateClientAdditionalInfo(
  clientId: string,
  data: ClientAdditionalInfoInput
): Promise<ActionResponse<ClientAdditionalInfo>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    // Validate input
    const validatedFields = clientAdditionalInfoSchema.safeParse(data)
    if (!validatedFields.success) {
      return { success: false, error: 'Datos inválidos' }
    }

    // Check if client exists
    const client = await prisma.client.findUnique({ where: { id: clientId } })
    if (!client) {
      return { success: false, error: 'Cliente no encontrado' }
    }

    const { fechaIngreso, fechaRetiro, ...rest } = validatedFields.data
    const infoData = {
      ...rest,
      fechaIngreso: fechaIngreso ? new Date(fechaIngreso) : null,
      fechaRetiro: fechaRetiro ? new Date(fechaRetiro) : null,
    }

    // Upsert additional info
    const additionalInfo = await prisma.clientAdditionalInfo.upsert({
      where: { clientId },
      update: infoData,
      create: {
        clientId,
        ...infoData,
      },
    })

    revalidatePath(`/dashboard/clients/${clientId}`)

    return {
      success: true,
      message: 'Información adicional guardada exitosamente',
      data: {
        ...additionalInfo,
        salario: additionalInfo.salario ? Number(additionalInfo.salario) : null,
      } as ClientAdditionalInfo,
    }
  } catch (error) {
    console.error('Create/update client additional info error:', error)
    return { success: false, error: 'Error al guardar información adicional' }
  }
}

// ==================== CLIENT BENEFICIARY ACTIONS ====================

/**
 * Add beneficiary to client
 */
export async function addClientBeneficiary(
  clientId: string,
  data: ClientBeneficiaryInput
): Promise<ActionResponse<ClientBeneficiary>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    // Validate input
    const validatedFields = clientBeneficiarySchema.safeParse(data)
    if (!validatedFields.success) {
      return { success: false, error: 'Datos inválidos' }
    }

    // Check if client exists
    const client = await prisma.client.findUnique({ where: { id: clientId } })
    if (!client) {
      return { success: false, error: 'Cliente no encontrado' }
    }

    // Check if beneficiary with same identification already exists for this client
    const existingBeneficiary = await prisma.clientBeneficiary.findFirst({
      where: {
        clientId,
        identificationNumber: validatedFields.data.identificationNumber,
      },
    })

    if (existingBeneficiary) {
      return {
        success: false,
        error: 'Ya existe un beneficiario con este número de identificación',
      }
    }

    // Create beneficiary
    const beneficiary = await prisma.clientBeneficiary.create({
      data: {
        clientId,
        ...validatedFields.data,
      },
    })

    revalidatePath(`/dashboard/clients/${clientId}`)

    return {
      success: true,
      message: 'Beneficiario agregado exitosamente',
      data: beneficiary as ClientBeneficiary,
    }
  } catch (error) {
    console.error('Add client beneficiary error:', error)
    return { success: false, error: 'Error al agregar beneficiario' }
  }
}

/**
 * Update client beneficiary
 */
export async function updateClientBeneficiary(
  beneficiaryId: string,
  data: ClientBeneficiaryInput
): Promise<ActionResponse<ClientBeneficiary>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    // Validate input
    const validatedFields = clientBeneficiarySchema.safeParse(data)
    if (!validatedFields.success) {
      return { success: false, error: 'Datos inválidos' }
    }

    // Check if beneficiary exists
    const existingBeneficiary = await prisma.clientBeneficiary.findUnique({
      where: { id: beneficiaryId },
    })

    if (!existingBeneficiary) {
      return { success: false, error: 'Beneficiario no encontrado' }
    }

    // Check if new identification number conflicts with another beneficiary
    if (validatedFields.data.identificationNumber !== existingBeneficiary.identificationNumber) {
      const conflict = await prisma.clientBeneficiary.findFirst({
        where: {
          clientId: existingBeneficiary.clientId,
          identificationNumber: validatedFields.data.identificationNumber,
          id: { not: beneficiaryId },
        },
      })

      if (conflict) {
        return {
          success: false,
          error: 'Ya existe otro beneficiario con este número de identificación',
        }
      }
    }

    // Update beneficiary
    const beneficiary = await prisma.clientBeneficiary.update({
      where: { id: beneficiaryId },
      data: validatedFields.data,
    })

    revalidatePath(`/dashboard/clients/${existingBeneficiary.clientId}`)

    return {
      success: true,
      message: 'Beneficiario actualizado exitosamente',
      data: beneficiary as ClientBeneficiary,
    }
  } catch (error) {
    console.error('Update client beneficiary error:', error)
    return { success: false, error: 'Error al actualizar beneficiario' }
  }
}

/**
 * Delete client beneficiary
 */
export async function deleteClientBeneficiary(beneficiaryId: string): Promise<ActionResponse> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    // Validate input
    const validatedFields = deleteBeneficiarySchema.safeParse({ beneficiaryId })
    if (!validatedFields.success) {
      return { success: false, error: 'Datos inválidos' }
    }

    // Check if beneficiary exists
    const beneficiary = await prisma.clientBeneficiary.findUnique({
      where: { id: beneficiaryId },
    })

    if (!beneficiary) {
      return { success: false, error: 'Beneficiario no encontrado' }
    }

    // Delete beneficiary
    await prisma.clientBeneficiary.delete({
      where: { id: beneficiaryId },
    })

    revalidatePath(`/dashboard/clients/${beneficiary.clientId}`)

    return {
      success: true,
      message: 'Beneficiario eliminado exitosamente',
    }
  } catch (error) {
    console.error('Delete client beneficiary error:', error)
    return { success: false, error: 'Error al eliminar beneficiario' }
  }
}
