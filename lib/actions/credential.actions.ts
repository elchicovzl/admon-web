'use server'

import { auth } from '@/lib/auth/auth'
import prisma from '@/lib/db/prisma'
import { UserRole } from '@prisma/client'
import { encryptPassword, decryptPassword } from '@/lib/encryption/credentials'
import {
  createCredentialSchema,
  updateCredentialSchema,
  deleteCredentialSchema,
  revealPasswordSchema,
  type CreateCredentialInput,
  type UpdateCredentialInput,
} from '@/lib/validations/credential.schema'
import type { SafeClientCredential, ClientCredentialWithPassword } from '@/lib/types/client.types'
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

/**
 * Get all credentials for a client (passwords remain encrypted)
 */
export async function getClientCredentials(
  clientId: string
): Promise<ActionResponse<SafeClientCredential[]>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const credentials = await prisma.clientCredential.findMany({
      where: { clientId },
      select: {
        id: true,
        clientId: true,
        administratorName: true,
        administratorType: true,
        username: true,
        portalUrl: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return {
      success: true,
      data: credentials,
    }
  } catch (error) {
    console.error('Get client credentials error:', error)
    return {
      success: false,
      error: 'Error al obtener credenciales',
    }
  }
}

/**
 * Create a new credential for a client
 */
export async function createCredential(
  data: CreateCredentialInput
): Promise<ActionResponse<SafeClientCredential>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    // Validate input
    const validatedFields = createCredentialSchema.safeParse(data)
    if (!validatedFields.success) {
      return {
        success: false,
        error: 'Datos inválidos',
      }
    }

    const { clientId, administratorName, administratorType, username, password, portalUrl, notes } =
      validatedFields.data

    // Check if client exists
    const client = await prisma.client.findUnique({ where: { id: clientId } })
    if (!client) {
      return { success: false, error: 'Cliente no encontrado' }
    }

    // Encrypt password before storing
    const encryptedPassword = encryptPassword(password)

    // Create credential
    const credential = await prisma.clientCredential.create({
      data: {
        clientId,
        administratorName,
        administratorType,
        username,
        encryptedPassword,
        portalUrl: portalUrl || null,
        notes: notes || null,
        createdById: authCheck.userId!,
      },
      select: {
        id: true,
        clientId: true,
        administratorName: true,
        administratorType: true,
        username: true,
        portalUrl: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    revalidatePath(`/dashboard/clients/${clientId}`)

    return {
      success: true,
      message: 'Credencial creada exitosamente',
      data: credential,
    }
  } catch (error) {
    console.error('Create credential error:', error)
    return {
      success: false,
      error: 'Error al crear credencial',
    }
  }
}

/**
 * Update an existing credential
 */
export async function updateCredential(
  credentialId: string,
  data: UpdateCredentialInput
): Promise<ActionResponse<SafeClientCredential>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    // Validate input
    const validatedFields = updateCredentialSchema.safeParse(data)
    if (!validatedFields.success) {
      return {
        success: false,
        error: 'Datos inválidos',
      }
    }

    // Check if credential exists
    const existingCredential = await prisma.clientCredential.findUnique({
      where: { id: credentialId },
    })

    if (!existingCredential) {
      return {
        success: false,
        error: 'Credencial no encontrada',
      }
    }

    // Prepare update data
    const updateData: any = { ...validatedFields.data }

    // If password is being updated, encrypt it
    if (data.password) {
      updateData.encryptedPassword = encryptPassword(data.password)
      delete updateData.password
    }

    // Handle empty portalUrl
    if (updateData.portalUrl === '') {
      updateData.portalUrl = null
    }

    // Update credential
    const updatedCredential = await prisma.clientCredential.update({
      where: { id: credentialId },
      data: updateData,
      select: {
        id: true,
        clientId: true,
        administratorName: true,
        administratorType: true,
        username: true,
        portalUrl: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    revalidatePath(`/dashboard/clients/${updatedCredential.clientId}`)

    return {
      success: true,
      message: 'Credencial actualizada exitosamente',
      data: updatedCredential,
    }
  } catch (error) {
    console.error('Update credential error:', error)
    return {
      success: false,
      error: 'Error al actualizar credencial',
    }
  }
}

/**
 * Delete a credential
 */
export async function deleteCredential(credentialId: string): Promise<ActionResponse> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    // Validate input
    const validatedFields = deleteCredentialSchema.safeParse({ credentialId })
    if (!validatedFields.success) {
      return { success: false, error: 'Datos inválidos' }
    }

    // Check if credential exists
    const credential = await prisma.clientCredential.findUnique({
      where: { id: credentialId },
    })

    if (!credential) {
      return { success: false, error: 'Credencial no encontrada' }
    }

    // Delete credential
    await prisma.clientCredential.delete({
      where: { id: credentialId },
    })

    revalidatePath(`/dashboard/clients/${credential.clientId}`)

    return {
      success: true,
      message: 'Credencial eliminada exitosamente',
    }
  } catch (error) {
    console.error('Delete credential error:', error)
    return {
      success: false,
      error: 'Error al eliminar credencial',
    }
  }
}

/**
 * Reveal (decrypt) a credential's password
 * This should only be called when explicitly requested by the user
 */
export async function revealCredentialPassword(
  credentialId: string
): Promise<ActionResponse<ClientCredentialWithPassword>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    // Validate input
    const validatedFields = revealPasswordSchema.safeParse({ credentialId })
    if (!validatedFields.success) {
      return { success: false, error: 'Datos inválidos' }
    }

    // Get credential with encrypted password
    const credential = await prisma.clientCredential.findUnique({
      where: { id: credentialId },
      select: {
        id: true,
        clientId: true,
        administratorName: true,
        administratorType: true,
        username: true,
        encryptedPassword: true,
        portalUrl: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    if (!credential) {
      return {
        success: false,
        error: 'Credencial no encontrada',
      }
    }

    // Decrypt password
    try {
      const decryptedPassword = decryptPassword(credential.encryptedPassword)

      // Return credential with decrypted password
      const { encryptedPassword, ...safeCredential } = credential

      return {
        success: true,
        data: {
          ...safeCredential,
          password: decryptedPassword,
        },
      }
    } catch (decryptError) {
      console.error('Password decryption error:', decryptError)
      return {
        success: false,
        error: 'Error al desencriptar la contraseña. La clave de encriptación puede ser incorrecta.',
      }
    }
  } catch (error) {
    console.error('Reveal credential password error:', error)
    return {
      success: false,
      error: 'Error al revelar contraseña',
    }
  }
}
