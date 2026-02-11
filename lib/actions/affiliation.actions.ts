/**
 * Server Actions for Affiliation Module
 * Afiliaciones a Seguridad Social
 */

'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth/auth'
import prisma from '@/lib/db/prisma'
import { UserRole, AffiliationSubProcessStatus, AffiliationStatus } from '@prisma/client'
import {
  createAffiliationSchema,
  updateAffiliationSchema,
  getAffiliationSchema,
  toggleAffiliationStatusSchema,
  updateSubProcessStatusSchema,
  assignSubProcessSchema,
  getSubProcessSchema,
  addObservationSchema,
  deleteObservationSchema,
  getSubProcessStatusLogsSchema,
  deleteDocumentSchema,
  generateUploadUrlSchema,
  confirmUploadSchema,
  type CreateAffiliationInput,
  type UpdateAffiliationInput,
  type UpdateSubProcessStatusInput,
  type AssignSubProcessInput,
  type AddObservationInput,
  type GenerateUploadUrlInput,
  type ConfirmUploadInput,
} from '@/lib/validations/affiliation.schema'
import type {
  SafeAffiliation,
  AffiliationWithRelations,
  SafeAffiliationSubProcess,
  AffiliationSubProcessWithRelations,
  AffiliationObservationWithRelations,
  AffiliationStats,
  MyAssignmentsStats,
  SafeAffiliationDocument,
  SubProcessKanbanItem,
} from '@/lib/types/affiliation.types'
import type { ActionResponse } from '@/lib/types'

// ========================================
// HELPER FUNCTIONS
// ========================================

async function requireManagerOrAdmin() {
  const session = await auth()
  if (!session?.user) {
    return { authorized: false, error: 'No autenticado' }
  }
  if (session.user.role !== UserRole.SUPER_ADMIN && session.user.role !== UserRole.MANAGER) {
    return { authorized: false, error: 'No tienes permisos para esta acción' }
  }
  return { authorized: true, userId: session.user.id, role: session.user.role }
}

// ========================================
// AFFILIATION CRUD OPERATIONS
// ========================================

/**
 * Get all affiliations with client and sub-processes info
 */
export async function getAffiliations(): Promise<ActionResponse<AffiliationWithRelations[]>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const affiliations = await prisma.affiliation.findMany({
      select: {
        id: true,
        clientId: true,
        status: true,
        sentAt: true,
        sentById: true,
        archivedAt: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        client: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            identificationType: true,
            identificationNumber: true,
            clientType: true,
          },
        },
        subProcesses: {
          select: {
            id: true,
            affiliationId: true,
            type: true,
            status: true,
            assignedToId: true,
            statusReason: true,
            createdAt: true,
            updatedAt: true,
            assignedTo: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
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

    return { success: true, data: affiliations }
  } catch (error) {
    console.error('Error fetching affiliations:', error)
    return { success: false, error: 'Error al obtener las afiliaciones' }
  }
}

/**
 * Get affiliation by ID with all relations
 */
export async function getAffiliationById(id: string): Promise<ActionResponse<AffiliationWithRelations>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const validation = getAffiliationSchema.safeParse({ id })
    if (!validation.success) {
      return { success: false, error: validation.error.errors[0].message }
    }

    const affiliation = await prisma.affiliation.findUnique({
      where: { id },
      select: {
        id: true,
        clientId: true,
        status: true,
        sentAt: true,
        sentById: true,
        archivedAt: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        client: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            identificationType: true,
            identificationNumber: true,
            clientType: true,
          },
        },
        subProcesses: {
          select: {
            id: true,
            affiliationId: true,
            type: true,
            status: true,
            assignedToId: true,
            statusReason: true,
            createdAt: true,
            updatedAt: true,
            assignedTo: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            documents: {
              select: {
                id: true,
                subProcessId: true,
                fileName: true,
                fileUrl: true,
                fileType: true,
                fileSize: true,
                s3Key: true,
                category: true,
                createdAt: true,
              },
              orderBy: {
                createdAt: 'desc',
              },
            },
            observations: {
              select: {
                id: true,
                content: true,
                subProcessId: true,
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
            statusLogs: {
              select: {
                id: true,
                subProcessId: true,
                fromStatus: true,
                toStatus: true,
                reason: true,
                createdAt: true,
                changedBy: {
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
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    if (!affiliation) {
      return { success: false, error: 'Afiliación no encontrada' }
    }

    return { success: true, data: affiliation }
  } catch (error) {
    console.error('Error fetching affiliation:', error)
    return { success: false, error: 'Error al obtener la afiliación' }
  }
}

/**
 * Create new affiliation with sub-processes
 */
export async function createAffiliation(
  data: CreateAffiliationInput
): Promise<ActionResponse<SafeAffiliation>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const validation = createAffiliationSchema.safeParse(data)
    if (!validation.success) {
      return { success: false, error: validation.error.errors[0].message }
    }

    // Verify client exists
    const client = await prisma.client.findUnique({
      where: { id: data.clientId },
    })

    if (!client) {
      return { success: false, error: 'Cliente no encontrado' }
    }

    // Verify all assigned managers exist
    // Get unique manager IDs (same manager can be assigned to multiple sub-processes)
    const managerIds = data.subProcesses
      .map((sp) => sp.assignedToId)
      .filter((id): id is string => id !== null && id !== undefined)

    const uniqueManagerIds = [...new Set(managerIds)]

    if (uniqueManagerIds.length > 0) {
      const managers = await prisma.user.findMany({
        where: {
          id: { in: uniqueManagerIds },
          role: { in: [UserRole.MANAGER, UserRole.SUPER_ADMIN] },
          isActive: true,
        },
      })

      if (managers.length !== uniqueManagerIds.length) {
        return { success: false, error: 'Uno o más managers no son válidos' }
      }
    }

    // Create affiliation with sub-processes
    const affiliation = await prisma.affiliation.create({
      data: {
        clientId: data.clientId,
        createdById: authCheck.userId,
        subProcesses: {
          create: data.subProcesses.map((sp) => ({
            type: sp.type,
            status: AffiliationSubProcessStatus.NOT_STARTED,
            assignedToId: sp.assignedToId,
          })),
        },
      },
      select: {
        id: true,
        clientId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    revalidatePath('/dashboard/affiliations')
    revalidatePath('/dashboard')

    return {
      success: true,
      data: affiliation,
      message: 'Afiliación creada exitosamente',
    }
  } catch (error) {
    console.error('Error creating affiliation:', error)
    return { success: false, error: 'Error al crear la afiliación' }
  }
}

/**
 * Update affiliation
 */
export async function updateAffiliation(
  id: string,
  data: UpdateAffiliationInput
): Promise<ActionResponse<SafeAffiliation>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const idValidation = getAffiliationSchema.safeParse({ id })
    if (!idValidation.success) {
      return { success: false, error: idValidation.error.errors[0].message }
    }

    const dataValidation = updateAffiliationSchema.safeParse(data)
    if (!dataValidation.success) {
      return { success: false, error: dataValidation.error.errors[0].message }
    }

    const affiliation = await prisma.affiliation.findUnique({
      where: { id },
    })

    if (!affiliation) {
      return { success: false, error: 'Afiliación no encontrada' }
    }

    const updatedAffiliation = await prisma.affiliation.update({
      where: { id },
      data,
      select: {
        id: true,
        clientId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    revalidatePath('/dashboard/affiliations')
    revalidatePath(`/dashboard/affiliations/${id}`)

    return {
      success: true,
      data: updatedAffiliation,
      message: 'Afiliación actualizada exitosamente',
    }
  } catch (error) {
    console.error('Error updating affiliation:', error)
    return { success: false, error: 'Error al actualizar la afiliación' }
  }
}

/**
 * Toggle affiliation status (soft delete)
 */
export async function toggleAffiliationStatus(
  affiliationId: string,
  isActive: boolean
): Promise<ActionResponse> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const validation = toggleAffiliationStatusSchema.safeParse({ affiliationId, isActive })
    if (!validation.success) {
      return { success: false, error: validation.error.errors[0].message }
    }

    const affiliation = await prisma.affiliation.findUnique({
      where: { id: affiliationId },
    })

    if (!affiliation) {
      return { success: false, error: 'Afiliación no encontrada' }
    }

    await prisma.affiliation.update({
      where: { id: affiliationId },
      data: { isActive },
    })

    revalidatePath('/dashboard/affiliations')
    revalidatePath(`/dashboard/affiliations/${affiliationId}`)

    return {
      success: true,
      message: `Afiliación ${isActive ? 'activada' : 'desactivada'} exitosamente`,
    }
  } catch (error) {
    console.error('Error toggling affiliation status:', error)
    return { success: false, error: 'Error al cambiar el status de la afiliación' }
  }
}

/**
 * Get affiliation stats
 */
export async function getAffiliationStats(): Promise<ActionResponse<AffiliationStats>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const [total, active, inactive, subProcessStats, statusStats] = await Promise.all([
      prisma.affiliation.count(),
      prisma.affiliation.count({ where: { isActive: true } }),
      prisma.affiliation.count({ where: { isActive: false } }),
      prisma.affiliationSubProcess.groupBy({
        by: ['type'],
        _count: true,
      }),
      prisma.affiliationSubProcess.groupBy({
        by: ['status'],
        _count: true,
      }),
    ])

    // Count completed and in_progress affiliations
    const affiliations = await prisma.affiliation.findMany({
      include: {
        subProcesses: {
          select: {
            status: true,
          },
        },
      },
    })

    let completed = 0
    let inProgress = 0

    affiliations.forEach((aff) => {
      if (aff.subProcesses.length === 0) return

      const allCompleted = aff.subProcesses.every(
        (sp) => sp.status === AffiliationSubProcessStatus.COMPLETED
      )
      const someInProgress = aff.subProcesses.some(
        (sp) =>
          sp.status === AffiliationSubProcessStatus.IN_PROGRESS ||
          sp.status === AffiliationSubProcessStatus.IN_REVIEW
      )

      if (allCompleted) completed++
      else if (someInProgress) inProgress++
    })

    const stats: AffiliationStats = {
      total,
      active,
      inactive,
      completed,
      inProgress,
      bySubProcessType: subProcessStats.map((stat) => ({
        type: stat.type,
        count: stat._count,
      })),
      byStatus: statusStats.map((stat) => ({
        status: stat.status,
        count: stat._count,
      })),
    }

    return { success: true, data: stats }
  } catch (error) {
    console.error('Error fetching affiliation stats:', error)
    return { success: false, error: 'Error al obtener las estadísticas' }
  }
}

// ========================================
// SUB-PROCESS OPERATIONS
// ========================================

/**
 * Get sub-process by ID with all relations
 */
export async function getSubProcessById(
  id: string
): Promise<ActionResponse<AffiliationSubProcessWithRelations>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const validation = getSubProcessSchema.safeParse({ id })
    if (!validation.success) {
      return { success: false, error: validation.error.errors[0].message }
    }

    const subProcess = await prisma.affiliationSubProcess.findUnique({
      where: { id },
      select: {
        id: true,
        affiliationId: true,
        type: true,
        status: true,
        assignedToId: true,
        statusReason: true,
        createdAt: true,
        updatedAt: true,
        affiliation: {
          select: {
            id: true,
            clientId: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        documents: {
          select: {
            id: true,
            subProcessId: true,
            fileName: true,
            fileUrl: true,
            fileType: true,
            fileSize: true,
            s3Key: true,
            category: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        observations: {
          select: {
            id: true,
            content: true,
            subProcessId: true,
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
        statusLogs: {
          select: {
            id: true,
            subProcessId: true,
            fromStatus: true,
            toStatus: true,
            reason: true,
            createdAt: true,
            changedBy: {
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

    if (!subProcess) {
      return { success: false, error: 'Sub-proceso no encontrado' }
    }

    return { success: true, data: subProcess }
  } catch (error) {
    console.error('Error fetching sub-process:', error)
    return { success: false, error: 'Error al obtener el sub-proceso' }
  }
}

/**
 * Update sub-process status
 */
export async function updateSubProcessStatus(
  data: UpdateSubProcessStatusInput
): Promise<ActionResponse<SafeAffiliationSubProcess>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const validation = updateSubProcessStatusSchema.safeParse(data)
    if (!validation.success) {
      return { success: false, error: validation.error.errors[0].message }
    }

    const subProcess = await prisma.affiliationSubProcess.findUnique({
      where: { id: data.subProcessId },
    })

    if (!subProcess) {
      return { success: false, error: 'Sub-proceso no encontrado' }
    }

    // Verify permissions: must be assigned manager or SUPER_ADMIN
    if (
      authCheck.role !== UserRole.SUPER_ADMIN &&
      subProcess.assignedToId !== authCheck.userId
    ) {
      return {
        success: false,
        error: 'Solo el manager asignado o un SUPER_ADMIN puede cambiar el status',
      }
    }

    // Validate reason is provided for RETURNED status
    if (data.status === AffiliationSubProcessStatus.RETURNED && !data.reason) {
      return {
        success: false,
        error: 'Debe proporcionar una razón al devolver el sub-proceso',
      }
    }

    // Update status and create log
    const [updatedSubProcess] = await prisma.$transaction([
      prisma.affiliationSubProcess.update({
        where: { id: data.subProcessId },
        data: {
          status: data.status,
          statusReason: data.status === AffiliationSubProcessStatus.RETURNED ? data.reason : null,
        },
        select: {
          id: true,
          affiliationId: true,
          type: true,
          status: true,
          assignedToId: true,
          statusReason: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.affiliationStatusLog.create({
        data: {
          subProcessId: data.subProcessId,
          fromStatus: subProcess.status,
          toStatus: data.status,
          reason: data.reason,
          changedById: authCheck.userId,
        },
      }),
    ])

    revalidatePath('/dashboard/affiliations')
    revalidatePath(`/dashboard/affiliations/${subProcess.affiliationId}`)
    revalidatePath('/dashboard/affiliations/my-assignments')

    return {
      success: true,
      data: updatedSubProcess,
      message: 'Status actualizado exitosamente',
    }
  } catch (error) {
    console.error('Error updating sub-process status:', error)
    return { success: false, error: 'Error al actualizar el status del sub-proceso' }
  }
}

/**
 * Assign sub-process to manager
 */
export async function assignSubProcess(
  data: AssignSubProcessInput
): Promise<ActionResponse<SafeAffiliationSubProcess>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const validation = assignSubProcessSchema.safeParse(data)
    if (!validation.success) {
      return { success: false, error: validation.error.errors[0].message }
    }

    const subProcess = await prisma.affiliationSubProcess.findUnique({
      where: { id: data.subProcessId },
    })

    if (!subProcess) {
      return { success: false, error: 'Sub-proceso no encontrado' }
    }

    // Only SUPER_ADMIN can reassign from another manager
    if (authCheck.role !== UserRole.SUPER_ADMIN && subProcess.assignedToId !== null) {
      return {
        success: false,
        error: 'Solo un SUPER_ADMIN puede reasignar un sub-proceso ya asignado',
      }
    }

    // If assigning (not unassigning), verify manager exists
    if (data.managerId) {
      const manager = await prisma.user.findUnique({
        where: {
          id: data.managerId,
          role: { in: [UserRole.MANAGER, UserRole.SUPER_ADMIN] },
          isActive: true,
        },
      })

      if (!manager) {
        return { success: false, error: 'Manager no válido' }
      }
    }

    const updatedSubProcess = await prisma.affiliationSubProcess.update({
      where: { id: data.subProcessId },
      data: {
        assignedToId: data.managerId,
      },
      select: {
        id: true,
        affiliationId: true,
        type: true,
        status: true,
        assignedToId: true,
        statusReason: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    revalidatePath('/dashboard/affiliations')
    revalidatePath(`/dashboard/affiliations/${subProcess.affiliationId}`)
    revalidatePath('/dashboard/affiliations/my-assignments')

    return {
      success: true,
      data: updatedSubProcess,
      message: data.managerId
        ? 'Sub-proceso asignado exitosamente'
        : 'Asignación removida exitosamente',
    }
  } catch (error) {
    console.error('Error assigning sub-process:', error)
    return { success: false, error: 'Error al asignar el sub-proceso' }
  }
}

/**
 * Get manager's assigned sub-processes
 */
export async function getMyAssignments(
  statusFilter?: AffiliationSubProcessStatus
): Promise<ActionResponse<AffiliationSubProcessWithRelations[]>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const whereClause: any = {
      assignedToId: authCheck.userId,
      affiliation: {
        isActive: true,
      },
    }

    if (statusFilter) {
      whereClause.status = statusFilter
    }

    const subProcesses = await prisma.affiliationSubProcess.findMany({
      where: whereClause,
      select: {
        id: true,
        affiliationId: true,
        type: true,
        status: true,
        assignedToId: true,
        statusReason: true,
        createdAt: true,
        updatedAt: true,
        affiliation: {
          select: {
            id: true,
            clientId: true,
            client: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
                identificationType: true,
                identificationNumber: true,
                clientType: true,
              },
            },
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        documents: {
          select: {
            id: true,
            subProcessId: true,
            fileName: true,
            fileUrl: true,
            fileType: true,
            fileSize: true,
            s3Key: true,
            category: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        observations: {
          select: {
            id: true,
            content: true,
            subProcessId: true,
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
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    })

    return { success: true, data: subProcesses as any }
  } catch (error) {
    console.error('Error fetching my assignments:', error)
    return { success: false, error: 'Error al obtener las asignaciones' }
  }
}

/**
 * Get my assignments stats
 */
export async function getMyAssignmentsStats(): Promise<ActionResponse<MyAssignmentsStats>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const [
      total,
      notStarted,
      inProgress,
      inReview,
      completed,
      returned,
    ] = await Promise.all([
      prisma.affiliationSubProcess.count({
        where: {
          assignedToId: authCheck.userId,
          affiliation: { isActive: true },
        },
      }),
      prisma.affiliationSubProcess.count({
        where: {
          assignedToId: authCheck.userId,
          affiliation: { isActive: true },
          status: AffiliationSubProcessStatus.NOT_STARTED,
        },
      }),
      prisma.affiliationSubProcess.count({
        where: {
          assignedToId: authCheck.userId,
          affiliation: { isActive: true },
          status: AffiliationSubProcessStatus.IN_PROGRESS,
        },
      }),
      prisma.affiliationSubProcess.count({
        where: {
          assignedToId: authCheck.userId,
          affiliation: { isActive: true },
          status: AffiliationSubProcessStatus.IN_REVIEW,
        },
      }),
      prisma.affiliationSubProcess.count({
        where: {
          assignedToId: authCheck.userId,
          affiliation: { isActive: true },
          status: AffiliationSubProcessStatus.COMPLETED,
        },
      }),
      prisma.affiliationSubProcess.count({
        where: {
          assignedToId: authCheck.userId,
          affiliation: { isActive: true },
          status: AffiliationSubProcessStatus.RETURNED,
        },
      }),
    ])

    const stats: MyAssignmentsStats = {
      total,
      notStarted,
      inProgress,
      inReview,
      completed,
      returned,
    }

    return { success: true, data: stats }
  } catch (error) {
    console.error('Error fetching my assignments stats:', error)
    return { success: false, error: 'Error al obtener las estadísticas' }
  }
}

/**
 * Get all sub-processes for Kanban view
 * Returns minimal data optimized for Kanban board display
 */
export async function getSubProcessesForKanban(): Promise<ActionResponse<SubProcessKanbanItem[]>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const subProcesses = await prisma.affiliationSubProcess.findMany({
      where: {
        affiliation: {
          isActive: true,
          status: AffiliationStatus.ACTIVE, // Only show sub-processes from ACTIVE affiliations
        },
        status: {
          not: AffiliationSubProcessStatus.PENDING_SUPPORT, // Exclude PENDING_SUPPORT from kanban
        },
      },
      select: {
        id: true,
        type: true,
        status: true,
        affiliationId: true,
        updatedAt: true,
        affiliation: {
          select: {
            client: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            documents: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    })

    // Transform the data to match SubProcessKanbanItem interface
    const kanbanItems: SubProcessKanbanItem[] = subProcesses.map((sp) => ({
      id: sp.id,
      type: sp.type,
      status: sp.status,
      affiliationId: sp.affiliationId,
      updatedAt: sp.updatedAt,
      client: sp.affiliation.client,
      assignedTo: sp.assignedTo,
      _count: sp._count,
    }))

    return { success: true, data: kanbanItems }
  } catch (error) {
    console.error('Error fetching sub-processes for kanban:', error)
    return { success: false, error: 'Error al obtener los sub-procesos' }
  }
}

/**
 * Send affiliation to client and archive it
 * This action is irreversible - affiliation will be immediately archived
 */
export async function sendAffiliation(affiliationId: string): Promise<ActionResponse> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    // Fetch affiliation with all sub-processes
    const affiliation = await prisma.affiliation.findUnique({
      where: { id: affiliationId },
      include: {
        subProcesses: {
          select: {
            id: true,
            status: true,
          },
        },
        client: {
          select: {
            fullName: true,
            email: true,
          },
        },
      },
    })

    if (!affiliation) {
      return { success: false, error: 'Afiliación no encontrada' }
    }

    // Verify affiliation is ACTIVE
    if (affiliation.status !== AffiliationStatus.ACTIVE) {
      return {
        success: false,
        error: 'Solo se pueden enviar afiliaciones activas',
      }
    }

    // Verify all sub-processes are COMPLETED
    const allCompleted = affiliation.subProcesses.every(
      (sp) => sp.status === AffiliationSubProcessStatus.COMPLETED
    )

    if (!allCompleted) {
      return {
        success: false,
        error: 'Todos los sub-procesos deben estar completados antes de enviar la afiliación',
      }
    }

    // Update affiliation status in a transaction
    const now = new Date()
    await prisma.affiliation.update({
      where: { id: affiliationId },
      data: {
        status: AffiliationStatus.ARCHIVED,
        sentAt: now,
        sentById: authCheck.userId,
        archivedAt: now,
      },
    })

    // TODO: Send email to client
    // await sendAffiliationEmail(affiliation.client.email, affiliation.client.fullName, affiliationId)

    console.log(`✉️ Afiliación ${affiliationId} enviada a ${affiliation.client.email}`)

    revalidatePath('/dashboard/affiliations')
    revalidatePath('/dashboard/affiliations/kanban')
    revalidatePath(`/dashboard/affiliations/${affiliationId}`)

    return {
      success: true,
      message: `Afiliación enviada exitosamente a ${affiliation.client.fullName}`,
    }
  } catch (error) {
    console.error('Error sending affiliation:', error)
    return { success: false, error: 'Error al enviar la afiliación' }
  }
}

/**
 * Get archived affiliations
 * Returns affiliations with status ARCHIVED
 */
export async function getArchivedAffiliations(): Promise<ActionResponse<AffiliationWithRelations[]>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const affiliations = await prisma.affiliation.findMany({
      where: {
        status: AffiliationStatus.ARCHIVED,
      },
      select: {
        id: true,
        clientId: true,
        status: true,
        sentAt: true,
        sentById: true,
        archivedAt: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        client: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            identificationType: true,
            identificationNumber: true,
            clientType: true,
          },
        },
        sentBy: {
          select: {
            id: true,
            name: true,
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
        subProcesses: {
          select: {
            id: true,
            affiliationId: true,
            type: true,
            status: true,
            assignedToId: true,
            statusReason: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: {
        archivedAt: 'desc',
      },
    })

    return { success: true, data: affiliations }
  } catch (error) {
    console.error('Error fetching archived affiliations:', error)
    return { success: false, error: 'Error al obtener las afiliaciones archivadas' }
  }
}

// ========================================
// OBSERVATION OPERATIONS
// ========================================

/**
 * Add observation to sub-process
 */
export async function addObservation(
  data: AddObservationInput
): Promise<ActionResponse<AffiliationObservationWithRelations>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const validation = addObservationSchema.safeParse(data)
    if (!validation.success) {
      return { success: false, error: validation.error.errors[0].message }
    }

    const subProcess = await prisma.affiliationSubProcess.findUnique({
      where: { id: data.subProcessId },
    })

    if (!subProcess) {
      return { success: false, error: 'Sub-proceso no encontrado' }
    }

    const observation = await prisma.affiliationObservation.create({
      data: {
        subProcessId: data.subProcessId,
        content: data.content,
        createdById: authCheck.userId,
      },
      select: {
        id: true,
        content: true,
        subProcessId: true,
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

    revalidatePath('/dashboard/affiliations')
    revalidatePath(`/dashboard/affiliations/${subProcess.affiliationId}`)

    return {
      success: true,
      data: observation,
      message: 'Observación agregada exitosamente',
    }
  } catch (error) {
    console.error('Error adding observation:', error)
    return { success: false, error: 'Error al agregar la observación' }
  }
}

/**
 * Delete observation (only creator or SUPER_ADMIN)
 */
export async function deleteObservation(observationId: string): Promise<ActionResponse> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const validation = deleteObservationSchema.safeParse({ observationId })
    if (!validation.success) {
      return { success: false, error: validation.error.errors[0].message }
    }

    const observation = await prisma.affiliationObservation.findUnique({
      where: { id: observationId },
      include: {
        subProcess: {
          select: {
            affiliationId: true,
          },
        },
      },
    })

    if (!observation) {
      return { success: false, error: 'Observación no encontrada' }
    }

    // Only creator or SUPER_ADMIN can delete
    if (
      authCheck.role !== UserRole.SUPER_ADMIN &&
      observation.createdById !== authCheck.userId
    ) {
      return {
        success: false,
        error: 'Solo el creador o un SUPER_ADMIN puede eliminar esta observación',
      }
    }

    await prisma.affiliationObservation.delete({
      where: { id: observationId },
    })

    revalidatePath('/dashboard/affiliations')
    revalidatePath(`/dashboard/affiliations/${observation.subProcess.affiliationId}`)

    return {
      success: true,
      message: 'Observación eliminada exitosamente',
    }
  } catch (error) {
    console.error('Error deleting observation:', error)
    return { success: false, error: 'Error al eliminar la observación' }
  }
}

/**
 * Get status logs for sub-process
 */
export async function getSubProcessStatusLogs(
  subProcessId: string
): Promise<ActionResponse<AffiliationStatusLogWithRelations[]>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const validation = getSubProcessStatusLogsSchema.safeParse({ subProcessId })
    if (!validation.success) {
      return { success: false, error: validation.error.errors[0].message }
    }

    const logs = await prisma.affiliationStatusLog.findMany({
      where: { subProcessId },
      select: {
        id: true,
        subProcessId: true,
        fromStatus: true,
        toStatus: true,
        reason: true,
        createdAt: true,
        changedBy: {
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

    return { success: true, data: logs }
  } catch (error) {
    console.error('Error fetching status logs:', error)
    return { success: false, error: 'Error al obtener el historial de cambios' }
  }
}

// ========================================
// DOCUMENT OPERATIONS (using R2/S3)
// ========================================

// Note: Document upload functionality will use the same R2 pattern as client documents
// You'll need to add generateUploadUrl and confirmUpload functions similar to client.actions.ts
// For brevity, I'm adding placeholders here that you can implement following the existing pattern

export async function generateUploadUrl(
  data: GenerateUploadUrlInput
): Promise<ActionResponse<{ uploadUrl: string; s3Key: string }>> {
  // TODO: Implement following the pattern in lib/actions/document.actions.ts
  // This should generate a presigned URL for R2 upload
  return { success: false, error: 'Not implemented yet - follow client document pattern' }
}

export async function confirmUpload(
  data: ConfirmUploadInput
): Promise<ActionResponse<SafeAffiliationDocument>> {
  // TODO: Implement following the pattern in lib/actions/document.actions.ts
  // This should save the document metadata after successful upload
  return { success: false, error: 'Not implemented yet - follow client document pattern' }
}

export async function deleteDocument(documentId: string): Promise<ActionResponse> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const validation = deleteDocumentSchema.safeParse({ documentId })
    if (!validation.success) {
      return { success: false, error: validation.error.errors[0].message }
    }

    const document = await prisma.affiliationDocument.findUnique({
      where: { id: documentId },
      include: {
        subProcess: {
          select: {
            affiliationId: true,
          },
        },
      },
    })

    if (!document) {
      return { success: false, error: 'Documento no encontrado' }
    }

    // TODO: Delete from R2 using document.s3Key before deleting from database
    // Follow the pattern in client document actions

    await prisma.affiliationDocument.delete({
      where: { id: documentId },
    })

    revalidatePath('/dashboard/affiliations')
    revalidatePath(`/dashboard/affiliations/${document.subProcess.affiliationId}`)

    return {
      success: true,
      message: 'Documento eliminado exitosamente',
    }
  } catch (error) {
    console.error('Error deleting document:', error)
    return { success: false, error: 'Error al eliminar el documento' }
  }
}
