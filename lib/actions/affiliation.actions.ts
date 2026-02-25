/**
 * Server Actions for Affiliation Module
 * Afiliaciones a Seguridad Social
 */

'use server'

import { cache } from 'react'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth/auth'
import prisma from '@/lib/db/prisma'
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { UserRole, AffiliationSubProcessStatus, AffiliationStatus } from '@prisma/client'
import {
  createAffiliationSchema,
  updateAffiliationSchema,
  getAffiliationSchema,
  toggleAffiliationStatusSchema,
  updateSubProcessStatusSchema,
  assignSubProcessSchema,
  getSubProcessSchema,
  addSubProcessesSchema,
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
  type AddSubProcessesInput,
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

async function generateAffiliationNumber(): Promise<string> {
  const last = await prisma.affiliation.findFirst({
    where: { affiliationNumber: { startsWith: 'PROC-' } },
    orderBy: { affiliationNumber: 'desc' },
    select: { affiliationNumber: true },
  })

  const lastNumber = last ? parseInt(last.affiliationNumber.replace('PROC-', ''), 10) : 0
  return `PROC-${String(lastNumber + 1).padStart(5, '0')}`
}

// ========================================
// AFFILIATION CRUD OPERATIONS
// ========================================

/**
 * Get all affiliations with client and sub-processes info
 */
export const getAffiliations = cache(async (): Promise<ActionResponse<AffiliationWithRelations[]>> => {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const affiliations = await prisma.affiliation.findMany({
      select: {
        id: true,
        affiliationNumber: true,
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
            employeeId: true,
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
            employee: {
              select: {
                id: true,
                fullName: true,
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
})

/**
 * Get affiliation by ID with all relations
 */
export const getAffiliationById = cache(async (id: string): Promise<ActionResponse<AffiliationWithRelations>> => {
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
        affiliationNumber: true,
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
            employeeId: true,
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
            employee: {
              select: {
                id: true,
                fullName: true,
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
})

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

    // Verify all employees belong to this company (for EMPRESA clients)
    const employeeIds = data.subProcesses
      .map((sp) => sp.employeeId)
      .filter((id): id is string => id !== null && id !== undefined)

    const uniqueEmployeeIds = [...new Set(employeeIds)]

    if (uniqueEmployeeIds.length > 0) {
      if (client.clientType !== 'EMPRESA') {
        return { success: false, error: 'Solo clientes tipo EMPRESA pueden tener empleados en sub-procesos' }
      }

      const employees = await prisma.client.findMany({
        where: {
          id: { in: uniqueEmployeeIds },
          companyId: data.clientId,
          clientType: 'EMPLEADO',
          isActive: true,
        },
      })

      if (employees.length !== uniqueEmployeeIds.length) {
        return { success: false, error: 'Uno o más empleados no son válidos o no pertenecen a esta empresa' }
      }
    }

    // Generate sequential number
    const affiliationNumber = await generateAffiliationNumber()

    // Create affiliation with sub-processes
    const affiliation = await prisma.affiliation.create({
      data: {
        affiliationNumber,
        clientId: data.clientId,
        createdById: authCheck.userId,
        subProcesses: {
          create: data.subProcesses.map((sp) => ({
            type: sp.type,
            status: AffiliationSubProcessStatus.NOT_STARTED,
            assignedToId: sp.assignedToId,
            employeeId: sp.employeeId ?? null,
          })),
        },
      },
      select: {
        id: true,
        affiliationNumber: true,
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
export const getAffiliationStats = cache(async (): Promise<ActionResponse<AffiliationStats>> => {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    // Optimized: 4 queries instead of 6, no full table scan
    const [basicStats, subProcessStats, statusStats, completionStats] = await Promise.all([
      // Query 1: Basic counts (3 counts efficiently)
      Promise.all([
        prisma.affiliation.count(),
        prisma.affiliation.count({ where: { isActive: true } }),
        prisma.affiliation.count({ where: { isActive: false } }),
      ]),

      // Query 2: Subprocess type stats
      prisma.affiliationSubProcess.groupBy({
        by: ['type'],
        _count: true,
      }),

      // Query 3: Subprocess status stats
      prisma.affiliationSubProcess.groupBy({
        by: ['status'],
        _count: true,
      }),

      // Query 4: Completed/InProgress using SQL aggregation (NO loading all affiliations)
      prisma.$queryRaw<[{ completed: number; in_progress: number }]>`
        SELECT
          COUNT(DISTINCT a.id) FILTER (
            WHERE NOT EXISTS (
              SELECT 1 FROM affiliation_subprocesses asp
              WHERE asp."affiliationId" = a.id AND asp.status != 'COMPLETED'
            ) AND EXISTS (
              SELECT 1 FROM affiliation_subprocesses asp
              WHERE asp."affiliationId" = a.id
            )
          )::int as completed,
          COUNT(DISTINCT a.id) FILTER (
            WHERE EXISTS (
              SELECT 1 FROM affiliation_subprocesses asp
              WHERE asp."affiliationId" = a.id
              AND asp.status IN ('IN_PROGRESS', 'IN_REVIEW')
            )
          )::int as in_progress
        FROM affiliations a
      `,
    ])

    const stats: AffiliationStats = {
      total: basicStats[0],
      active: basicStats[1],
      inactive: basicStats[2],
      completed: completionStats[0].completed,
      inProgress: completionStats[0].in_progress,
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
})

// ========================================
// SUB-PROCESS OPERATIONS
// ========================================

/**
 * Get sub-process by ID with all relations
 */
export const getSubProcessById = cache(async (
  id: string
): Promise<ActionResponse<AffiliationSubProcessWithRelations>> => {
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
        employeeId: true,
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
        employee: {
          select: {
            id: true,
            fullName: true,
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
})

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
          employeeId: true,
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
        employeeId: true,
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
 * Add sub-processes to an existing affiliation
 */
export async function addSubProcesses(
  data: AddSubProcessesInput
): Promise<ActionResponse<SafeAffiliationSubProcess[]>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const validation = addSubProcessesSchema.safeParse(data)
    if (!validation.success) {
      return { success: false, error: validation.error.errors[0].message }
    }

    // Verify affiliation exists and is active
    const affiliation = await prisma.affiliation.findUnique({
      where: { id: data.affiliationId },
      include: { client: true },
    })

    if (!affiliation) {
      return { success: false, error: 'Afiliación no encontrada' }
    }

    if (affiliation.status !== AffiliationStatus.ACTIVE) {
      return { success: false, error: 'Solo se pueden agregar sub-procesos a afiliaciones activas' }
    }

    // Verify managers
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

    // Verify employees (for EMPRESA clients)
    const employeeIds = data.subProcesses
      .map((sp) => sp.employeeId)
      .filter((id): id is string => id !== null && id !== undefined)

    const uniqueEmployeeIds = [...new Set(employeeIds)]

    if (uniqueEmployeeIds.length > 0) {
      if (affiliation.client.clientType !== 'EMPRESA') {
        return { success: false, error: 'Solo clientes tipo EMPRESA pueden tener empleados en sub-procesos' }
      }

      const employees = await prisma.client.findMany({
        where: {
          id: { in: uniqueEmployeeIds },
          companyId: affiliation.clientId,
          clientType: 'EMPLEADO',
          isActive: true,
        },
      })

      if (employees.length !== uniqueEmployeeIds.length) {
        return { success: false, error: 'Uno o más empleados no son válidos o no pertenecen a esta empresa' }
      }
    }

    // Create sub-processes
    const created = await prisma.$transaction(
      data.subProcesses.map((sp) =>
        prisma.affiliationSubProcess.create({
          data: {
            affiliationId: data.affiliationId,
            type: sp.type,
            status: AffiliationSubProcessStatus.NOT_STARTED,
            assignedToId: sp.assignedToId ?? null,
            employeeId: sp.employeeId ?? null,
          },
          select: {
            id: true,
            affiliationId: true,
            type: true,
            status: true,
            assignedToId: true,
            employeeId: true,
            statusReason: true,
            createdAt: true,
            updatedAt: true,
          },
        })
      )
    )

    revalidatePath('/dashboard/affiliations')
    revalidatePath(`/dashboard/affiliations/${data.affiliationId}`)

    return {
      success: true,
      data: created,
      message: `${created.length} sub-proceso${created.length !== 1 ? 's' : ''} agregado${created.length !== 1 ? 's' : ''} exitosamente`,
    }
  } catch (error) {
    console.error('Error adding sub-processes:', error)
    return { success: false, error: 'Error al agregar sub-procesos' }
  }
}

/**
 * Get manager's assigned sub-processes
 */
export const getMyAssignments = cache(async (
  statusFilter?: AffiliationSubProcessStatus
): Promise<ActionResponse<AffiliationSubProcessWithRelations[]>> => {
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
        employeeId: true,
        statusReason: true,
        createdAt: true,
        updatedAt: true,
        affiliation: {
          select: {
            id: true,
            affiliationNumber: true,
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
        employee: {
          select: {
            id: true,
            fullName: true,
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
})

/**
 * Get my assignments stats
 */
export const getMyAssignmentsStats = cache(async (): Promise<ActionResponse<MyAssignmentsStats>> => {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    // Optimized: 2 queries instead of 6
    const [statusGroups, total] = await Promise.all([
      // Query 1: Group by status to get counts for each status
      prisma.affiliationSubProcess.groupBy({
        by: ['status'],
        where: {
          assignedToId: authCheck.userId,
          affiliation: { isActive: true },
        },
        _count: true,
      }),
      // Query 2: Total count
      prisma.affiliationSubProcess.count({
        where: {
          assignedToId: authCheck.userId,
          affiliation: { isActive: true },
        },
      }),
    ])

    // Map grouped results to stats object
    const stats: MyAssignmentsStats = {
      total,
      notStarted: statusGroups.find(g => g.status === 'NOT_STARTED')?._count || 0,
      inProgress: statusGroups.find(g => g.status === 'IN_PROGRESS')?._count || 0,
      inReview: statusGroups.find(g => g.status === 'IN_REVIEW')?._count || 0,
      completed: statusGroups.find(g => g.status === 'COMPLETED')?._count || 0,
      returned: statusGroups.find(g => g.status === 'RETURNED')?._count || 0,
    }

    return { success: true, data: stats }
  } catch (error) {
    console.error('Error fetching my assignments stats:', error)
    return { success: false, error: 'Error al obtener las estadísticas' }
  }
})

/**
 * Get all sub-processes for Kanban view
 * Returns minimal data optimized for Kanban board display
 */
export const getSubProcessesForKanban = cache(async (): Promise<ActionResponse<SubProcessKanbanItem[]>> => {
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
        employeeId: true,
        createdAt: true,
        updatedAt: true,
        affiliation: {
          select: {
            affiliationNumber: true,
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
        employee: {
          select: {
            id: true,
            fullName: true,
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
      affiliationNumber: sp.affiliation.affiliationNumber,
      employeeId: sp.employeeId,
      createdAt: sp.createdAt,
      updatedAt: sp.updatedAt,
      client: sp.affiliation.client,
      employee: sp.employee,
      assignedTo: sp.assignedTo,
      _count: sp._count,
    }))

    return { success: true, data: kanbanItems }
  } catch (error) {
    console.error('Error fetching sub-processes for kanban:', error)
    return { success: false, error: 'Error al obtener los sub-procesos' }
  }
})

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
export const getArchivedAffiliations = cache(async (): Promise<ActionResponse<AffiliationWithRelations[]>> => {
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
        affiliationNumber: true,
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
            employeeId: true,
            statusReason: true,
            createdAt: true,
            updatedAt: true,
            employee: {
              select: {
                id: true,
                fullName: true,
              },
            },
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
})

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

function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('Cloudflare R2 credentials not configured')
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  })
}

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

    // Delete from R2
    try {
      const r2Client = getR2Client()
      const command = new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: document.s3Key,
      })
      await r2Client.send(command)
    } catch (r2Error) {
      console.error('R2 deletion error:', r2Error)
      // Continue with DB deletion even if R2 fails
    }

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
