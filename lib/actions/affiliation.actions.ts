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
import { UserRole, AffiliationSubProcessStatus, AffiliationStatus, ClientType } from '@prisma/client'
import { decryptPassword } from '@/lib/encryption/credentials'
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
import {
  sendAffiliationEmailSchema,
  type SendAffiliationEmailInput,
} from '@/lib/validations/send-affiliation-email.schema'
import { sendAffiliationCompletedEmail } from '@/lib/email'
import { render } from '@react-email/render'
import AffiliationCompletedEmail from '@/emails/affiliation-completed-email'
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
  EmailComposeData,
  SentEmailData,
} from '@/lib/types/affiliation.types'
import {
  SubProcessTypeLabels,
  AffiliationProcessTypeLabels,
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
      where: {
        status: { not: AffiliationStatus.ARCHIVED },
      },
      select: {
        id: true,
        affiliationNumber: true,
        clientId: true,
        processType: true,
        processTypeOther: true,
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
        processType: true,
        processTypeOther: true,
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
        processType: data.processType,
        processTypeOther: data.processTypeOther ?? null,
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
        processType: true,
        processTypeOther: true,
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
            image: true,
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
        processType: true,
        processTypeOther: true,
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

// ========================================
// EMAIL OPERATIONS
// ========================================

/**
 * Get email compose data for an affiliation
 * Pre-populates the email compose modal with default values
 */
export async function getAffiliationEmailData(
  affiliationId: string
): Promise<ActionResponse<EmailComposeData>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const affiliation = await prisma.affiliation.findUnique({
      where: { id: affiliationId },
      select: {
        affiliationNumber: true,
        processType: true,
        processTypeOther: true,
        status: true,
        client: {
          select: {
            fullName: true,
            email: true,
            phone: true,
            identificationType: true,
            identificationNumber: true,
            clientType: true,
            companyId: true,
            company: {
              select: {
                fullName: true,
                identificationType: true,
                identificationNumber: true,
                phone: true,
                email: true,
                credentials: {
                  select: {
                    administratorName: true,
                    administratorType: true,
                    username: true,
                    encryptedPassword: true,
                    notes: true,
                  },
                },
              },
            },
            address: {
              select: {
                direccion: true,
                departamento: true,
                municipio: true,
              },
            },
            additionalInfo: {
              select: {
                salario: true,
                fechaIngreso: true,
                actividadComercial: true,
              },
            },
            credentials: {
              select: {
                administratorName: true,
                administratorType: true,
                username: true,
                encryptedPassword: true,
                notes: true,
              },
            },
          },
        },
        subProcesses: {
          select: {
            id: true,
            type: true,
            status: true,
            employeeId: true,
            employee: {
              select: {
                fullName: true,
                identificationType: true,
                identificationNumber: true,
                phone: true,
                email: true,
                address: {
                  select: {
                    direccion: true,
                    departamento: true,
                    municipio: true,
                  },
                },
                additionalInfo: {
                  select: {
                    salario: true,
                    fechaIngreso: true,
                    actividadComercial: true,
                  },
                },
              },
            },
            documents: {
              select: {
                id: true,
                fileName: true,
                fileType: true,
                fileSize: true,
                s3Key: true,
              },
            },
          },
        },
      },
    })

    if (!affiliation) {
      return { success: false, error: 'Afiliación no encontrada' }
    }

    const client = affiliation.client
    if (!client) {
      return { success: false, error: 'Cliente no encontrado' }
    }

    const processTypeLabel = affiliation.processType
      ? AffiliationProcessTypeLabels[affiliation.processType] || affiliation.processType
      : affiliation.processTypeOther || 'Sin tipo'

    const subProcesses = affiliation.subProcesses.map((sp) => ({
      id: sp.id,
      type: sp.type,
      label: SubProcessTypeLabels[sp.type] || sp.type,
    }))

    const documents = affiliation.subProcesses.flatMap((sp) =>
      sp.documents.map((doc) => ({
        id: doc.id,
        fileName: doc.fileName,
        fileType: doc.fileType,
        fileSize: doc.fileSize,
        s3Key: doc.s3Key,
        subProcessType: sp.type,
        subProcessLabel: SubProcessTypeLabels[sp.type] || sp.type,
      }))
    )

    // Build email body and subject
    const emailBody = buildAffiliationEmailBody(affiliation, processTypeLabel)
    const subject = buildAffiliationSubject(affiliation, processTypeLabel)

    return {
      success: true,
      data: {
        to: client.email,
        subject,
        emailBody,
        clientName: client.fullName,
        affiliationNumber: affiliation.affiliationNumber,
        processTypeLabel,
        subProcesses,
        documents,
      },
    }
  } catch (error) {
    console.error('Error getting affiliation email data:', error)
    return { success: false, error: 'Error al obtener datos de la afiliación' }
  }
}

/**
 * Build the subject line based on affiliation type
 */
function buildAffiliationSubject(
  affiliation: {
    processType: string | null
    processTypeOther: string | null
    client: {
      fullName: string
      clientType: string
      company?: { fullName: string } | null
    } | null
    subProcesses: { employee?: { fullName: string } | null }[]
  },
  processTypeLabel: string
): string {
  const client = affiliation.client
  if (!client) return 'Afiliación Completada'

  if (client.clientType === ClientType.EMPRESA) {
    // For empresa: "EMPLOYER / EMPLOYEE"
    const employees = affiliation.subProcesses
      .map((sp) => sp.employee?.fullName)
      .filter(Boolean)
    const uniqueEmployees = [...new Set(employees)]
    if (uniqueEmployees.length > 0) {
      return `${client.fullName} / ${uniqueEmployees.join(', ')}`
    }
    return client.fullName
  }

  // For independiente: "PROCESS_TYPE / CLIENT_NAME"
  return `${processTypeLabel} / ${client.fullName}`
}

/**
 * Safely decrypt a password, returning fallback on error
 */
function safeDecrypt(encrypted: string): string {
  try {
    return decryptPassword(encrypted)
  } catch {
    return '***'
  }
}

/**
 * Build the structured email body based on client data
 */
function buildAffiliationEmailBody(
  affiliation: {
    processType: string | null
    client: {
      fullName: string
      identificationType: string
      identificationNumber: string
      phone: string
      email: string
      clientType: string
      company?: {
        fullName: string
        identificationType: string
        identificationNumber: string
        phone: string
        email: string
        credentials: {
          administratorName: string
          administratorType: string
          username: string
          encryptedPassword: string
          notes: string | null
        }[]
      } | null
      address?: {
        direccion: string
        departamento: string
        municipio: string
      } | null
      additionalInfo?: {
        salario: unknown
        fechaIngreso: Date | null
        actividadComercial: string | null
      } | null
      credentials: {
        administratorName: string
        administratorType: string
        username: string
        encryptedPassword: string
        notes: string | null
      }[]
    } | null
    subProcesses: {
      type: string
      employee?: {
        fullName: string
        identificationType: string
        identificationNumber: string
        phone: string
        email: string
        address?: {
          direccion: string
          departamento: string
          municipio: string
        } | null
        additionalInfo?: {
          salario: unknown
          fechaIngreso: Date | null
          actividadComercial: string | null
        } | null
      } | null
    }[]
  },
  processTypeLabel: string
): string {
  const client = affiliation.client
  if (!client) return 'Cordial saludo,\n\nAdjunto enviamos certificados de afiliación solicitados.\n\nCordialmente;'

  const lines: string[] = []
  lines.push('Cordial saludo,')
  lines.push('')
  lines.push('Adjunto enviamos certificados de afiliación solicitados:')
  lines.push('')

  const isEmpresa = client.clientType === ClientType.EMPRESA

  if (isEmpresa && client.company) {
    // Employer section
    const employer = client.company
    lines.push(`EMPLEADOR: ${employer.fullName}`)
    lines.push(`${employer.identificationType} ${employer.identificationNumber}`)
    lines.push(`CEL ${employer.phone}`)

    // Employer credentials
    for (const cred of employer.credentials) {
      const password = safeDecrypt(cred.encryptedPassword)
      if (cred.administratorType === 'PILA_OPERATOR') {
        lines.push(`CLAVE ${cred.administratorName}: ${password}`)
      } else {
        lines.push(`${cred.administratorName}: ${cred.username} CLAVE: ${password}`)
      }
    }
    lines.push('')

    // Employee sections
    const employees = affiliation.subProcesses
      .map((sp) => sp.employee)
      .filter(Boolean)
    const uniqueEmployees = new Map<string, typeof employees[0]>()
    for (const emp of employees) {
      if (emp && !uniqueEmployees.has(emp.identificationNumber)) {
        uniqueEmployees.set(emp.identificationNumber, emp)
      }
    }

    for (const emp of uniqueEmployees.values()) {
      if (!emp) continue
      lines.push(`EMPLEADO: ${emp.fullName}`)
      lines.push(`${emp.identificationType} ${emp.identificationNumber}`)
      if (emp.address) {
        lines.push(`Dirección: ${emp.address.direccion}`)
        if (emp.address.departamento || emp.address.municipio) {
          lines.push(`${emp.address.municipio}${emp.address.departamento ? `, ${emp.address.departamento}` : ''}`)
        }
      }
      lines.push(`Celular: ${emp.phone}`)
      if (emp.additionalInfo?.salario) {
        lines.push(`SALARIO: $${Number(emp.additionalInfo.salario).toLocaleString('es-CO')}`)
      }
      if (emp.additionalInfo?.fechaIngreso) {
        lines.push(`Fecha de ingreso: ${new Date(emp.additionalInfo.fechaIngreso).toLocaleDateString('es-CO')}`)
      }
      if (emp.additionalInfo?.actividadComercial) {
        lines.push(`Ocupación: ${emp.additionalInfo.actividadComercial}`)
      }
      lines.push(`Correo: ${emp.email}`)
      lines.push('')
    }

    // If no employee sub-processes, show the main client as employee
    if (uniqueEmployees.size === 0) {
      appendClientDetails(lines, client)
    }
  } else {
    // Independent / single client
    lines.push(`${client.fullName}`)
    lines.push(`${client.identificationType} ${client.identificationNumber}`)
    lines.push(`CEL ${client.phone}`)

    // Client credentials (portal passwords)
    for (const cred of client.credentials) {
      const password = safeDecrypt(cred.encryptedPassword)
      if (cred.administratorType === 'PILA_OPERATOR') {
        lines.push(`CLAVE ${cred.administratorName}: ${password}`)
      } else {
        lines.push(`${cred.administratorName}: ${cred.username} CLAVE: ${password}`)
      }
    }

    if (client.address) {
      lines.push(`Dirección: ${client.address.direccion}`)
      if (client.address.departamento || client.address.municipio) {
        lines.push(`${client.address.municipio}${client.address.departamento ? `, ${client.address.departamento}` : ''}`)
      }
    }
    lines.push(`Correo: ${client.email}`)
    if (client.additionalInfo?.salario) {
      lines.push(`SALARIO: $${Number(client.additionalInfo.salario).toLocaleString('es-CO')}`)
    }
    if (client.additionalInfo?.fechaIngreso) {
      lines.push(`FECHA DE INGRESO: ${new Date(client.additionalInfo.fechaIngreso).toLocaleDateString('es-CO')}`)
    }
    if (client.additionalInfo?.actividadComercial) {
      lines.push(`OCUPACIÓN: ${client.additionalInfo.actividadComercial}`)
    }
    lines.push('')
  }

  // Entity affiliations (from credentials)
  const allCreds = isEmpresa && client.company
    ? [...client.company.credentials, ...client.credentials]
    : client.credentials
  const entityLines: string[] = []
  const entityCreds = allCreds.filter((c) =>
    ['EPS', 'AFP', 'ARL', 'CCF'].includes(c.administratorType)
  )
  for (const cred of entityCreds) {
    const typeLabel =
      cred.administratorType === 'AFP' ? 'PENSIÓN' :
      cred.administratorType === 'CCF' ? 'CCF' :
      cred.administratorType
    entityLines.push(`${typeLabel}: ${cred.administratorName}`)
  }
  if (entityLines.length > 0) {
    lines.push(...entityLines)
    lines.push('')
  }

  // Payment instructions (standard text)
  lines.push('')
  lines.push('PUNTOS PARA PAGO DE LA PLANILLA PRESENCIAL')
  lines.push('Puedes acudir a puntos de pago como Efecty, utilizando el convenio 113237.')
  lines.push('Bancos del Grupo Aval, Puntos Vía, Almacenes Éxito, Carulla, Surtimax y Pago Cerca, utilizando el convenio 113237.')
  lines.push('Además, para pagos inmediatos, puedes usar Reval o Puntored, con el convenio 1225739 y el PIN de tu planilla.')
  lines.push('')
  lines.push('PARA PAGO VIRTUAL:')
  lines.push('1. https://pagosimple.com/pagodigitalsimple/')
  lines.push('2. CLIC EN INICIAR PAGO')
  lines.push('')
  lines.push('RECUERDE: si va a dejar de pagar, es muy importante marcar la novedad de RETIRO en el operador para que no quede en MORA.')
  lines.push('')
  lines.push('')
  lines.push('Cordialmente;')

  return lines.join('\n')
}

/**
 * Append client personal details to email body lines
 */
function appendClientDetails(
  lines: string[],
  client: {
    fullName: string
    identificationType: string
    identificationNumber: string
    phone: string
    email: string
    address?: { direccion: string; departamento: string; municipio: string } | null
    additionalInfo?: { salario: unknown; fechaIngreso: Date | null; actividadComercial: string | null } | null
  }
) {
  lines.push(`${client.fullName}`)
  lines.push(`${client.identificationType} ${client.identificationNumber}`)
  lines.push(`CEL ${client.phone}`)
  if (client.address) {
    lines.push(`Dirección: ${client.address.direccion}`)
  }
  if (client.additionalInfo?.salario) {
    lines.push(`SALARIO: $${Number(client.additionalInfo.salario).toLocaleString('es-CO')}`)
  }
  if (client.additionalInfo?.fechaIngreso) {
    lines.push(`Fecha de ingreso: ${new Date(client.additionalInfo.fechaIngreso).toLocaleDateString('es-CO')}`)
  }
  if (client.additionalInfo?.actividadComercial) {
    lines.push(`Ocupación: ${client.additionalInfo.actividadComercial}`)
  }
  lines.push(`Correo: ${client.email}`)
  lines.push('')
}

/**
 * Send affiliation email with attachments and archive the affiliation
 */
export async function sendAffiliationWithEmail(
  data: SendAffiliationEmailInput
): Promise<ActionResponse<{ sentEmailId: string }>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const validatedFields = sendAffiliationEmailSchema.safeParse(data)
    if (!validatedFields.success) {
      return { success: false, error: 'Datos inválidos' }
    }

    const { affiliationId, to, cc, subject, emailBody, selectedDocumentIds } =
      validatedFields.data

    // Fetch affiliation with all data
    const affiliation = await prisma.affiliation.findUnique({
      where: { id: affiliationId },
      include: {
        client: {
          select: { fullName: true, email: true },
        },
        subProcesses: {
          select: {
            id: true,
            type: true,
            status: true,
            documents: {
              select: {
                id: true,
                fileName: true,
                fileType: true,
                fileSize: true,
                s3Key: true,
              },
            },
          },
        },
      },
    })

    if (!affiliation) {
      return { success: false, error: 'Afiliación no encontrada' }
    }

    if (affiliation.status !== AffiliationStatus.ACTIVE) {
      return { success: false, error: 'Solo se pueden enviar afiliaciones activas' }
    }

    const allCompleted = affiliation.subProcesses.every(
      (sp) => sp.status === AffiliationSubProcessStatus.COMPLETED
    )
    if (!allCompleted) {
      return {
        success: false,
        error: 'Todos los sub-procesos deben estar completados antes de enviar la afiliación',
      }
    }

    // Get process type label
    const processTypeLabel = affiliation.processType
      ? AffiliationProcessTypeLabels[affiliation.processType] || affiliation.processType
      : affiliation.processTypeOther || 'Sin tipo'

    // Get sub-processes labels
    const subProcesses = affiliation.subProcesses.map((sp) => ({
      type: sp.type,
      label: SubProcessTypeLabels[sp.type] || sp.type,
    }))

    // Get selected documents for attachments
    const allDocuments = affiliation.subProcesses.flatMap((sp) => sp.documents)
    const selectedDocuments = selectedDocumentIds?.length
      ? allDocuments.filter((doc) => selectedDocumentIds.includes(doc.id))
      : []

    // Check total attachment size (25MB limit)
    const totalSize = selectedDocuments.reduce((sum, doc) => sum + doc.fileSize, 0)
    const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024 // 25MB
    if (totalSize > MAX_ATTACHMENT_SIZE) {
      return {
        success: false,
        error: `El tamaño total de los adjuntos (${(totalSize / 1024 / 1024).toFixed(1)}MB) excede el límite de 25MB`,
      }
    }

    // Send email
    const { html } = await sendAffiliationCompletedEmail({
      to,
      cc: cc?.length ? cc : undefined,
      subject,
      emailBody,
      hasAttachments: selectedDocuments.length > 0,
      attachmentFiles: selectedDocuments.map((doc) => ({
        fileName: doc.fileName,
        s3Key: doc.s3Key,
        fileType: doc.fileType,
      })),
    })

    // Create sent email record and archive affiliation in transaction
    const now = new Date()
    const attachmentsMetadata = selectedDocuments.map((doc) => ({
      fileName: doc.fileName,
      fileType: doc.fileType,
      fileSize: doc.fileSize,
    }))

    const sentEmail = await prisma.$transaction(async (tx) => {
      const email = await tx.sentEmail.create({
        data: {
          affiliationId,
          toEmail: to,
          ccEmails: cc?.length ? JSON.stringify(cc) : null,
          subject,
          htmlBody: html,
          attachments: attachmentsMetadata.length
            ? JSON.stringify(attachmentsMetadata)
            : null,
          sentById: authCheck.userId!,
        },
      })

      await tx.affiliation.update({
        where: { id: affiliationId },
        data: {
          status: AffiliationStatus.ARCHIVED,
          sentAt: now,
          sentById: authCheck.userId,
          archivedAt: now,
        },
      })

      return email
    })

    console.log(
      `✉️ Afiliación ${affiliationId} enviada a ${to}${cc?.length ? ` (CC: ${cc.join(', ')})` : ''}`
    )

    revalidatePath('/dashboard/affiliations')
    revalidatePath('/dashboard/affiliations/kanban')
    revalidatePath(`/dashboard/affiliations/${affiliationId}`)
    revalidatePath('/dashboard/affiliations/archived')

    return {
      success: true,
      message: `Afiliación enviada exitosamente a ${affiliation.client?.fullName || to}`,
      data: { sentEmailId: sentEmail.id },
    }
  } catch (error) {
    console.error('Error sending affiliation email:', error)
    return { success: false, error: 'Error al enviar el correo de la afiliación' }
  }
}

/**
 * Preview affiliation email HTML
 * Returns rendered HTML for the email preview tab
 */
export async function previewAffiliationEmail(data: {
  emailBody: string
  hasAttachments?: boolean
}): Promise<ActionResponse<string>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const html = await render(
      AffiliationCompletedEmail({
        emailBody: data.emailBody,
        hasAttachments: data.hasAttachments,
      })
    )

    return { success: true, data: html }
  } catch (error) {
    console.error('Error previewing affiliation email:', error)
    return { success: false, error: 'Error al generar la vista previa del correo' }
  }
}

/**
 * Send a test affiliation email (no DB changes, no attachments, subject prefixed with [PRUEBA])
 */
export async function sendTestAffiliationEmail(data: {
  emailBody: string
  subject: string
  to: string
}): Promise<ActionResponse<string>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    if (!data.to || !data.subject || !data.emailBody) {
      return { success: false, error: 'Faltan campos requeridos para el correo de prueba' }
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(data.to)) {
      return { success: false, error: 'El destinatario no es un email válido' }
    }

    await sendAffiliationCompletedEmail({
      to: data.to,
      subject: `[PRUEBA] ${data.subject}`,
      emailBody: data.emailBody,
      hasAttachments: false,
    })

    return {
      success: true,
      data: `Correo de prueba enviado a ${data.to}`,
      message: `Correo de prueba enviado exitosamente a ${data.to}`,
    }
  } catch (error) {
    console.error('Error sending test affiliation email:', error)
    return { success: false, error: 'Error al enviar el correo de prueba' }
  }
}

/**
 * Get sent emails for an affiliation
 */
export async function getSentEmailsByAffiliationId(
  affiliationId: string
): Promise<ActionResponse<SentEmailData[]>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const sentEmails = await prisma.sentEmail.findMany({
      where: { affiliationId },
      select: {
        id: true,
        toEmail: true,
        ccEmails: true,
        subject: true,
        htmlBody: true,
        attachments: true,
        sentAt: true,
        sentBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { sentAt: 'desc' },
    })

    const data: SentEmailData[] = sentEmails.map((email) => ({
      id: email.id,
      toEmail: email.toEmail,
      ccEmails: email.ccEmails ? JSON.parse(email.ccEmails) : [],
      subject: email.subject,
      htmlBody: email.htmlBody,
      attachments: email.attachments ? JSON.parse(email.attachments) : [],
      sentAt: email.sentAt,
      sentBy: email.sentBy,
    }))

    return { success: true, data }
  } catch (error) {
    console.error('Error fetching sent emails:', error)
    return { success: false, error: 'Error al obtener los correos enviados' }
  }
}
