'use server'

import { cache } from 'react'
import { auth } from '@/lib/auth/auth'
import prisma from '@/lib/db/prisma'
import { UserRole } from '@prisma/client'
import {
  createDisabilitySchema,
  updateDisabilitySchema,
  toggleDisabilityStatusSchema,
  addDisabilityObservationSchema,
  deleteDisabilityObservationSchema,
  type CreateDisabilityInput,
  type UpdateDisabilityInput,
} from '@/lib/validations/disability.schema'
import type {
  SafeDisability,
  DisabilityWithRelations,
  DisabilityObservation,
} from '@/lib/types/disability.types'
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
 * Get all disabilities
 */
export const getDisabilities = cache(async (): Promise<ActionResponse<SafeDisability[]>> => {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const disabilities = await prisma.disability.findMany({
      select: {
        id: true,
        receptionDate: true,
        status: true,
        clientId: true,
        employeeId: true,
        administrator: true,
        startDate: true,
        endDate: true,
        bankRegistry: true,
        transcription: true,
        filing: true,
        proofFileUrl: true,
        proofS3Key: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        receptionDate: 'desc',
      },
    })

    return {
      success: true,
      data: disabilities,
    }
  } catch (error) {
    console.error('Get disabilities error:', error)
    return {
      success: false,
      error: 'Error al obtener incapacidades',
    }
  }
})

/**
 * Get disability by ID with relations
 */
export const getDisabilityById = cache(async (
  id: string
): Promise<ActionResponse<DisabilityWithRelations>> => {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const disability = await prisma.disability.findUnique({
      where: { id },
      select: {
        id: true,
        receptionDate: true,
        status: true,
        clientId: true,
        employeeId: true,
        administrator: true,
        startDate: true,
        endDate: true,
        bankRegistry: true,
        transcription: true,
        filing: true,
        proofFileUrl: true,
        proofS3Key: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        client: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        employee: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        observations: {
          select: {
            id: true,
            content: true,
            disabilityId: true,
            createdById: true,
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
        },
      },
    })

    if (!disability) {
      return {
        success: false,
        error: 'Incapacidad no encontrada',
      }
    }

    return {
      success: true,
      data: disability,
    }
  } catch (error) {
    console.error('Get disability error:', error)
    return {
      success: false,
      error: 'Error al obtener incapacidad',
    }
  }
})

/**
 * Create a new disability
 */
export async function createDisability(
  data: CreateDisabilityInput
): Promise<ActionResponse<SafeDisability>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    // Validate input
    const validatedFields = createDisabilitySchema.safeParse(data)
    if (!validatedFields.success) {
      return {
        success: false,
        error: 'Datos inválidos',
      }
    }

    const {
      receptionDate,
      status,
      clientId,
      employeeId,
      administrator,
      startDate,
      endDate,
      bankRegistry,
      transcription,
      filing,
      proofFileUrl,
    } = validatedFields.data

    // Validate client exists
    const client = await prisma.client.findUnique({ where: { id: clientId } })
    if (!client) {
      return { success: false, error: 'Cliente no encontrado' }
    }

    // Validate employee exists
    const employee = await prisma.client.findUnique({ where: { id: employeeId } })
    if (!employee) {
      return { success: false, error: 'Empleado no encontrado' }
    }

    // Create disability
    const disability = await prisma.disability.create({
      data: {
        receptionDate,
        status,
        clientId,
        employeeId,
        administrator,
        startDate,
        endDate,
        bankRegistry,
        transcription,
        filing,
        proofFileUrl: proofFileUrl || null,
        createdById: authCheck.userId!,
      },
      select: {
        id: true,
        receptionDate: true,
        status: true,
        clientId: true,
        employeeId: true,
        administrator: true,
        startDate: true,
        endDate: true,
        bankRegistry: true,
        transcription: true,
        filing: true,
        proofFileUrl: true,
        proofS3Key: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    revalidatePath('/dashboard/disabilities')

    return {
      success: true,
      message: 'Incapacidad creada exitosamente',
      data: disability,
    }
  } catch (error) {
    console.error('Create disability error:', error)
    return {
      success: false,
      error: 'Error al crear incapacidad',
    }
  }
}

/**
 * Update disability
 */
export async function updateDisability(
  id: string,
  data: UpdateDisabilityInput
): Promise<ActionResponse<SafeDisability>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    // Validate input
    const validatedFields = updateDisabilitySchema.safeParse(data)
    if (!validatedFields.success) {
      return {
        success: false,
        error: 'Datos inválidos',
      }
    }

    // Check if disability exists
    const existingDisability = await prisma.disability.findUnique({
      where: { id },
    })

    if (!existingDisability) {
      return {
        success: false,
        error: 'Incapacidad no encontrada',
      }
    }

    // If clientId is being updated, validate it exists
    if (data.clientId) {
      const client = await prisma.client.findUnique({ where: { id: data.clientId } })
      if (!client) {
        return { success: false, error: 'Cliente no encontrado' }
      }
    }

    // If employeeId is being updated, validate it exists
    if (data.employeeId) {
      const employee = await prisma.client.findUnique({ where: { id: data.employeeId } })
      if (!employee) {
        return { success: false, error: 'Empleado no encontrado' }
      }
    }

    // Update disability
    const updatedDisability = await prisma.disability.update({
      where: { id },
      data: validatedFields.data,
      select: {
        id: true,
        receptionDate: true,
        status: true,
        clientId: true,
        employeeId: true,
        administrator: true,
        startDate: true,
        endDate: true,
        bankRegistry: true,
        transcription: true,
        filing: true,
        proofFileUrl: true,
        proofS3Key: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    revalidatePath('/dashboard/disabilities')
    revalidatePath(`/dashboard/disabilities/${id}`)

    return {
      success: true,
      message: 'Incapacidad actualizada exitosamente',
      data: updatedDisability,
    }
  } catch (error) {
    console.error('Update disability error:', error)
    return {
      success: false,
      error: 'Error al actualizar incapacidad',
    }
  }
}

/**
 * Toggle disability active status (soft delete)
 */
export async function toggleDisabilityStatus(
  disabilityId: string,
  isActive: boolean
): Promise<ActionResponse> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    // Validate input
    const validatedFields = toggleDisabilityStatusSchema.safeParse({ disabilityId, isActive })
    if (!validatedFields.success) {
      return { success: false, error: 'Datos inválidos' }
    }

    // Check if disability exists
    const disability = await prisma.disability.findUnique({ where: { id: disabilityId } })
    if (!disability) {
      return { success: false, error: 'Incapacidad no encontrada' }
    }

    // Update status
    await prisma.disability.update({
      where: { id: disabilityId },
      data: { isActive },
    })

    revalidatePath('/dashboard/disabilities')
    revalidatePath(`/dashboard/disabilities/${disabilityId}`)

    return {
      success: true,
      message: `Incapacidad ${isActive ? 'activada' : 'desactivada'} exitosamente`,
    }
  } catch (error) {
    console.error('Toggle disability status error:', error)
    return { success: false, error: 'Error al cambiar status de la incapacidad' }
  }
}

/**
 * Add an observation to a disability
 */
export async function addDisabilityObservation(
  disabilityId: string,
  content: string
): Promise<ActionResponse<DisabilityObservation>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    // Validate input
    const validatedFields = addDisabilityObservationSchema.safeParse({ disabilityId, content })
    if (!validatedFields.success) {
      return { success: false, error: 'Datos inválidos' }
    }

    // Check if disability exists
    const disability = await prisma.disability.findUnique({ where: { id: disabilityId } })
    if (!disability) {
      return { success: false, error: 'Incapacidad no encontrada' }
    }

    // Create observation
    const observation = await prisma.disabilityObservation.create({
      data: {
        content,
        disabilityId,
        createdById: authCheck.userId!,
      },
      select: {
        id: true,
        content: true,
        disabilityId: true,
        createdById: true,
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

    revalidatePath(`/dashboard/disabilities/${disabilityId}`)

    return {
      success: true,
      message: 'Observación agregada exitosamente',
      data: observation,
    }
  } catch (error) {
    console.error('Add disability observation error:', error)
    return { success: false, error: 'Error al agregar observación' }
  }
}

/**
 * Delete a disability observation
 */
export async function deleteDisabilityObservation(observationId: string): Promise<ActionResponse> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    // Validate input
    const validatedFields = deleteDisabilityObservationSchema.safeParse({ observationId })
    if (!validatedFields.success) {
      return { success: false, error: 'Datos inválidos' }
    }

    // Check if observation exists
    const observation = await prisma.disabilityObservation.findUnique({
      where: { id: observationId },
    })
    if (!observation) {
      return { success: false, error: 'Observación no encontrada' }
    }

    // Only creator or SUPER_ADMIN can delete
    const session = await auth()
    if (
      session?.user.role !== UserRole.SUPER_ADMIN &&
      observation.createdById !== authCheck.userId
    ) {
      return { success: false, error: 'No puedes eliminar observaciones de otros usuarios' }
    }

    // Delete observation
    await prisma.disabilityObservation.delete({
      where: { id: observationId },
    })

    revalidatePath(`/dashboard/disabilities/${observation.disabilityId}`)

    return {
      success: true,
      message: 'Observación eliminada exitosamente',
    }
  } catch (error) {
    console.error('Delete disability observation error:', error)
    return { success: false, error: 'Error al eliminar observación' }
  }
}

/**
 * Get disabilities count and stats
 */
export const getDisabilitiesCount = cache(async (): Promise<
  ActionResponse<{
    total: number
    active: number
    inactive: number
    byStatus: { status: string; count: number }[]
  }>
> => {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const [total, active, inactive, byStatus] = await Promise.all([
      prisma.disability.count(),
      prisma.disability.count({ where: { isActive: true } }),
      prisma.disability.count({ where: { isActive: false } }),
      prisma.disability.groupBy({
        by: ['status'],
        _count: true,
        where: { isActive: true },
      }),
    ])

    const byStatusFormatted = byStatus.map((item) => ({
      status: item.status,
      count: item._count,
    }))

    return {
      success: true,
      data: {
        total,
        active,
        inactive,
        byStatus: byStatusFormatted,
      },
    }
  } catch (error) {
    console.error('Get disabilities count error:', error)
    return {
      success: false,
      error: 'Error al obtener conteo de incapacidades',
    }
  }
})
