'use server'

import { cache } from 'react'
import { auth } from '@/lib/auth/auth'
import prisma from '@/lib/db/prisma'
import { UserRole, ClientType, AdministradoraType } from '@prisma/client'
import {
  createClientSchema,
  createEmployeeSchema,
  updateClientSchema,
  toggleClientStatusSchema,
  addClientNoteSchema,
  deleteClientNoteSchema,
  assignEmployeeToCompanySchema,
  removeEmployeeFromCompanySchema,
  getCompanyEmployeesSchema,
  legalRepresentativeSchema,
  type CreateClientInput,
  type CreateEmployeeInput,
  type UpdateClientInput,
  type LegalRepresentativeInput,
} from '@/lib/validations/client.schema'
import type { SafeClient, ClientWithRelations, ClientNote, LegalRepresentative, CompanyEmployee } from '@/lib/types/client.types'
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
 * Get all clients
 */
export const getClients = cache(async (): Promise<ActionResponse<SafeClient[]>> => {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const clients = await prisma.client.findMany({
      where: {
        status: { not: 'ELIMINADO' },
      },
      select: {
        id: true,
        fullName: true,
        identificationType: true,
        identificationNumber: true,
        clientType: true,
        employeeType: true,
        workDaysRange: true,
        email: true,
        phone: true,
        status: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        companyId: true,
        company: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return {
      success: true,
      data: clients,
    }
  } catch (error) {
    console.error('Get clients error:', error)
    return {
      success: false,
      error: 'Error al obtener clientes',
    }
  }
})

/**
 * Get client by ID with relations
 */
export const getClientById = cache(async (id: string): Promise<ActionResponse<ClientWithRelations>> => {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const client = await prisma.client.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        identificationType: true,
        identificationNumber: true,
        clientType: true,
        employeeType: true,
        workDaysRange: true,
        email: true,
        phone: true,
        status: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        companyId: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        // Company relation (for employees)
        company: {
          select: {
            id: true,
            fullName: true,
            identificationType: true,
            identificationNumber: true,
            clientType: true,
            employeeType: true,
            workDaysRange: true,
            email: true,
            phone: true,
            status: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            companyId: true,
          },
        },
        // Employees relation (for companies)
        employees: {
          select: {
            id: true,
            fullName: true,
            identificationType: true,
            identificationNumber: true,
            clientType: true,
            employeeType: true,
            workDaysRange: true,
            email: true,
            phone: true,
            status: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            companyId: true,
          },
          orderBy: {
            fullName: 'asc',
          },
        },
        notes: {
          select: {
            id: true,
            content: true,
            clientId: true,
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
        documents: {
          select: {
            id: true,
            fileName: true,
            fileUrl: true,
            fileType: true,
            fileSize: true,
            s3Key: true,
            category: true,
            clientId: true,
            uploadedById: true,
            createdAt: true,
            uploadedBy: {
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
        credentials: {
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
        },
        // Address and additional info
        address: true,
        additionalInfo: {
          select: {
            id: true,
            clientId: true,
            actividadComercial: true,
            salario: true,
            fechaIngreso: true,
            fechaRetiro: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        beneficiaries: {
          orderBy: {
            createdAt: 'desc',
          },
        },
        legalRepresentative: true,
        // Administradoras
        eps: { select: { id: true, name: true, code: true, type: true } },
        afp: { select: { id: true, name: true, code: true, type: true } },
        arl: { select: { id: true, name: true, code: true, type: true } },
        arlRiskLevel: true,
        ccf: { select: { id: true, name: true, code: true, type: true } },
        // Phase 2: active employments from the join table (for client-info-panel)
        employmentsAsEmployee: {
          where: { isActive: true },
          select: {
            id: true,
            employeeType: true,
            workDaysRange: true,
            startDate: true,
            company: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
        },
      },
    })

    if (!client) {
      return {
        success: false,
        error: 'Cliente no encontrado',
      }
    }

    // Convert Decimal to number for additionalInfo.salario
    const clientData = {
      ...client,
      additionalInfo: client.additionalInfo
        ? {
            ...client.additionalInfo,
            salario: client.additionalInfo.salario ? Number(client.additionalInfo.salario) : null,
          }
        : null,
    }

    return {
      success: true,
      // Double-cast: Prisma select omits encryptedPassword/createdById from credentials
      // (intentionally, for security) so the structural types don't fully overlap.
      data: clientData as unknown as ClientWithRelations,
    }
  } catch (error) {
    console.error('Get client error:', error)
    return {
      success: false,
      error: 'Error al obtener cliente',
    }
  }
})

/**
 * Create a new client
 */
export async function createClient(
  data: CreateClientInput | CreateEmployeeInput
): Promise<ActionResponse<SafeClient>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    // Sanitize: convert null values to undefined for Zod optional fields
    const sanitizedData = Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, value === null ? undefined : value])
    )

    // Validate input
    const clientValidation = createClientSchema.safeParse(sanitizedData)

    if (!clientValidation.success) {
      const firstError = clientValidation.error.errors[0]?.message || 'Datos inválidos'
      return {
        success: false,
        error: firstError,
      }
    }

    const { fullName, identificationType, identificationNumber, clientType, email, phone, employeeType, workDaysRange, legalRepresentative } = clientValidation.data

    // Check if identification number already exists
    const existingClient = await prisma.client.findUnique({
      where: { identificationNumber },
    })

    if (existingClient) {
      return {
        success: false,
        error: 'Ya existe un cliente con este número de identificación',
      }
    }

    // Create client with legal representative if it's a company
    const client = await prisma.client.create({
      data: {
        fullName,
        identificationType,
        identificationNumber,
        clientType,
        email,
        phone,
        employeeType: employeeType || null,
        workDaysRange: workDaysRange || null,
        createdById: authCheck.userId!,
        // Create legal representative if client is a company
        ...(clientType === ClientType.EMPRESA && legalRepresentative && {
          legalRepresentative: {
            create: {
              fullName: legalRepresentative.fullName,
              identificationType: legalRepresentative.identificationType,
              identificationNumber: legalRepresentative.identificationNumber,
              email: legalRepresentative.email || null,
              phone: legalRepresentative.phone || null,
            },
          },
        }),
      },
      select: {
        id: true,
        fullName: true,
        identificationType: true,
        identificationNumber: true,
        clientType: true,
        employeeType: true,
        workDaysRange: true,
        email: true,
        phone: true,
        status: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        companyId: true,
      },
    })

    revalidatePath('/dashboard/clients')

    return {
      success: true,
      message: 'Cliente creado exitosamente',
      data: client,
    }
  } catch (error) {
    console.error('Create client error:', error)
    return {
      success: false,
      error: 'Error al crear cliente',
    }
  }
}

/**
 * Update client
 */
export async function updateClient(
  id: string,
  data: UpdateClientInput
): Promise<ActionResponse<SafeClient>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    // Validate input
    const validatedFields = updateClientSchema.safeParse(data)
    if (!validatedFields.success) {
      return {
        success: false,
        error: 'Datos inválidos',
      }
    }

    // Check if client exists
    const existingClient = await prisma.client.findUnique({
      where: { id },
    })

    if (!existingClient) {
      return {
        success: false,
        error: 'Cliente no encontrado',
      }
    }

    // If identification number is being updated, check it's not taken
    if (data.identificationNumber && data.identificationNumber !== existingClient.identificationNumber) {
      const identificationTaken = await prisma.client.findUnique({
        where: { identificationNumber: data.identificationNumber },
      })

      if (identificationTaken) {
        return {
          success: false,
          error: 'Este número de identificación ya está en uso',
        }
      }
    }

    // Clean up conditional fields
    const updateData = { ...validatedFields.data }
    if (updateData.employeeType && updateData.employeeType !== 'TIEMPO_PARCIAL') {
      updateData.workDaysRange = null
    }
    if (updateData.clientType && updateData.clientType !== 'EMPLEADO') {
      updateData.employeeType = null
      updateData.workDaysRange = null
    }

    // Update client
    const updatedClient = await prisma.client.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        fullName: true,
        identificationType: true,
        identificationNumber: true,
        clientType: true,
        employeeType: true,
        workDaysRange: true,
        email: true,
        phone: true,
        status: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        companyId: true,
      },
    })

    revalidatePath('/dashboard/clients')
    revalidatePath(`/dashboard/clients/${id}`)

    return {
      success: true,
      message: 'Cliente actualizado exitosamente',
      data: updatedClient,
    }
  } catch (error) {
    console.error('Update client error:', error)
    return {
      success: false,
      error: 'Error al actualizar cliente',
    }
  }
}

/**
 * Toggle client active status (soft delete)
 */
export async function toggleClientStatus(
  clientId: string,
  isActive: boolean
): Promise<ActionResponse> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    // Validate input
    const validatedFields = toggleClientStatusSchema.safeParse({ clientId, isActive })
    if (!validatedFields.success) {
      return { success: false, error: 'Datos inválidos' }
    }

    // Check if client exists
    const client = await prisma.client.findUnique({ where: { id: clientId } })
    if (!client) {
      return { success: false, error: 'Cliente no encontrado' }
    }

    // Update status
    await prisma.client.update({
      where: { id: clientId },
      data: { isActive },
    })

    revalidatePath('/dashboard/clients')
    revalidatePath(`/dashboard/clients/${clientId}`)

    return {
      success: true,
      message: `Cliente ${isActive ? 'activado' : 'desactivado'} exitosamente`,
    }
  } catch (error) {
    console.error('Toggle client status error:', error)
    return { success: false, error: 'Error al cambiar status del cliente' }
  }
}

/**
 * Soft delete a client (sets isActive to false and marks as deleted)
 */
export async function deleteClient(clientId: string): Promise<ActionResponse> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const client = await prisma.client.findUnique({ where: { id: clientId } })
    if (!client) {
      return { success: false, error: 'Cliente no encontrado' }
    }

    await prisma.client.update({
      where: { id: clientId },
      data: {
        isActive: false,
        status: 'ELIMINADO',
      },
    })

    revalidatePath('/dashboard/clients')

    return {
      success: true,
      message: 'Cliente eliminado exitosamente',
    }
  } catch (error) {
    console.error('Delete client error:', error)
    return { success: false, error: 'Error al eliminar el cliente' }
  }
}

/**
 * Reactivate a soft-deleted client (reverts the soft delete)
 * Restores isActive=true AND status='ACTIVO' (deleteClient sets both to the
 * deleted state, so we must reset both to fully bring the client back).
 */
export async function reactivateClient(clientId: string): Promise<ActionResponse> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const client = await prisma.client.findUnique({ where: { id: clientId } })
    if (!client) {
      return { success: false, error: 'Cliente no encontrado' }
    }

    if (client.status !== 'ELIMINADO') {
      return { success: false, error: 'El cliente no está eliminado' }
    }

    await prisma.client.update({
      where: { id: clientId },
      data: {
        isActive: true,
        status: 'ACTIVO',
      },
    })

    revalidatePath('/dashboard/clients')
    revalidatePath('/dashboard/client-history')
    revalidatePath(`/dashboard/client-history/${clientId}`)

    return {
      success: true,
      message: 'Cliente reactivado exitosamente',
    }
  } catch (error) {
    console.error('Reactivate client error:', error)
    return { success: false, error: 'Error al reactivar el cliente' }
  }
}

/**
 * Add a note to a client
 */
export async function addClientNote(
  clientId: string,
  content: string
): Promise<ActionResponse<ClientNote>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    // Validate input
    const validatedFields = addClientNoteSchema.safeParse({ clientId, content })
    if (!validatedFields.success) {
      return { success: false, error: 'Datos inválidos' }
    }

    // Check if client exists
    const client = await prisma.client.findUnique({ where: { id: clientId } })
    if (!client) {
      return { success: false, error: 'Cliente no encontrado' }
    }

    // Create note
    const note = await prisma.clientNote.create({
      data: {
        content,
        clientId,
        createdById: authCheck.userId!,
      },
      select: {
        id: true,
        content: true,
        clientId: true,
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

    revalidatePath(`/dashboard/clients/${clientId}`)

    return {
      success: true,
      message: 'Nota agregada exitosamente',
      data: note,
    }
  } catch (error) {
    console.error('Add client note error:', error)
    return { success: false, error: 'Error al agregar nota' }
  }
}

/**
 * Delete a client note
 */
export async function deleteClientNote(noteId: string): Promise<ActionResponse> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    // Validate input
    const validatedFields = deleteClientNoteSchema.safeParse({ noteId })
    if (!validatedFields.success) {
      return { success: false, error: 'Datos inválidos' }
    }

    // Check if note exists
    const note = await prisma.clientNote.findUnique({ where: { id: noteId } })
    if (!note) {
      return { success: false, error: 'Nota no encontrada' }
    }

    // Only creator or SUPER_ADMIN can delete
    const session = await auth()
    if (session?.user.role !== UserRole.SUPER_ADMIN && note.createdById !== authCheck.userId) {
      return { success: false, error: 'No puedes eliminar notas de otros usuarios' }
    }

    // Delete note
    await prisma.clientNote.delete({
      where: { id: noteId },
    })

    revalidatePath(`/dashboard/clients/${note.clientId}`)

    return {
      success: true,
      message: 'Nota eliminada exitosamente',
    }
  } catch (error) {
    console.error('Delete client note error:', error)
    return { success: false, error: 'Error al eliminar nota' }
  }
}

/**
 * Get clients count
 */
export const getClientsCount = cache(async (): Promise<
  ActionResponse<{
    total: number
    active: number
    inactive: number
    byType: { type: string; count: number }[]
  }>
> => {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const [total, active, inactive, byType] = await Promise.all([
      prisma.client.count(),
      prisma.client.count({ where: { isActive: true } }),
      prisma.client.count({ where: { isActive: false } }),
      prisma.client.groupBy({
        by: ['clientType'],
        _count: true,
      }),
    ])

    const byTypeFormatted = byType.map((item) => ({
      type: item.clientType,
      count: item._count,
    }))

    return {
      success: true,
      data: {
        total,
        active,
        inactive,
        byType: byTypeFormatted,
      },
    }
  } catch (error) {
    console.error('Get clients count error:', error)
    return {
      success: false,
      error: 'Error al obtener conteo de clientes',
    }
  }
})

/**
 * Assign employee to company
 */
export async function assignEmployeeToCompany(
  employeeId: string,
  companyId: string
): Promise<ActionResponse> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    // Validate input
    const validatedFields = assignEmployeeToCompanySchema.safeParse({ employeeId, companyId })
    if (!validatedFields.success) {
      return { success: false, error: 'Datos inválidos' }
    }

    // Check if employee exists
    const employee = await prisma.client.findUnique({ where: { id: employeeId } })
    if (!employee) {
      return { success: false, error: 'Empleado no encontrado' }
    }

    // Check if employee is actually an employee type
    if (employee.clientType !== 'EMPLEADO') {
      return { success: false, error: 'Solo clientes tipo EMPLEADO pueden ser asignados a una empresa' }
    }

    // Check if employee already has a company
    if (employee.companyId) {
      return { success: false, error: 'El empleado ya está asignado a una empresa' }
    }

    // Check if company exists
    const company = await prisma.client.findUnique({ where: { id: companyId } })
    if (!company) {
      return { success: false, error: 'Empresa no encontrada' }
    }

    // Check if company is actually a company type
    if (company.clientType !== 'EMPRESA') {
      return { success: false, error: 'Solo clientes tipo EMPRESA pueden tener empleados asignados' }
    }

    // Assign employee to company
    await prisma.client.update({
      where: { id: employeeId },
      data: { companyId },
    })

    revalidatePath('/dashboard/clients')
    revalidatePath(`/dashboard/clients/${employeeId}`)
    revalidatePath(`/dashboard/clients/${companyId}`)

    return {
      success: true,
      message: 'Empleado asignado exitosamente a la empresa',
    }
  } catch (error) {
    console.error('Assign employee to company error:', error)
    return { success: false, error: 'Error al asignar empleado a la empresa' }
  }
}

/**
 * Remove employee from company
 */
export async function removeEmployeeFromCompany(employeeId: string): Promise<ActionResponse> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    // Validate input
    const validatedFields = removeEmployeeFromCompanySchema.safeParse({ employeeId })
    if (!validatedFields.success) {
      return { success: false, error: 'Datos inválidos' }
    }

    // Check if employee exists
    const employee = await prisma.client.findUnique({ where: { id: employeeId } })
    if (!employee) {
      return { success: false, error: 'Empleado no encontrado' }
    }

    // Check if employee has a company
    if (!employee.companyId) {
      return { success: false, error: 'El empleado no está asignado a ninguna empresa' }
    }

    const companyId = employee.companyId

    // Remove employee from company
    await prisma.client.update({
      where: { id: employeeId },
      data: { companyId: null },
    })

    revalidatePath('/dashboard/clients')
    revalidatePath(`/dashboard/clients/${employeeId}`)
    revalidatePath(`/dashboard/clients/${companyId}`)

    return {
      success: true,
      message: 'Empleado desasignado exitosamente de la empresa',
    }
  } catch (error) {
    console.error('Remove employee from company error:', error)
    return { success: false, error: 'Error al desasignar empleado de la empresa' }
  }
}

/**
 * Get available employee candidates for a specific company.
 * Phase 2 migration: excludes only clients already actively employed by THIS company
 * (instead of old filter: clientType=EMPLEADO + companyId=null).
 * Covers REQ-3 (3.1–3.6):
 *   - 3.1: excludes clients with an active Employment at the target company
 *   - 3.2: includes clients employed at OTHER companies (multi-employer)
 *   - 3.3: EMPRESA-type clients are now valid candidates
 *   - 3.4: EMPLEADO-type clients not constrained by companyId shadow
 *   - 3.5: the company itself is excluded (id: { not: companyId })
 *   - 3.6: clients with inactive Employment at target ARE included
 */
export const getAvailableEmployees = cache(async (companyId: string): Promise<ActionResponse<SafeClient[]>> => {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    // Validate companyId input
    const validatedFields = getCompanyEmployeesSchema.safeParse({ companyId })
    if (!validatedFields.success) {
      return { success: false, error: 'Datos inválidos' }
    }

    const employees = await prisma.client.findMany({
      where: {
        isActive: true,
        id: { not: companyId },
        NOT: { employmentsAsEmployee: { some: { companyId, isActive: true } } },
      },
      select: {
        id: true,
        fullName: true,
        identificationType: true,
        identificationNumber: true,
        clientType: true,
        email: true,
        phone: true,
        status: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        fullName: 'asc',
      },
    })

    return {
      success: true,
      data: employees as SafeClient[],
    }
  } catch (error) {
    console.error('Get available employees error:', error)
    return {
      success: false,
      error: 'Error al obtener empleados disponibles',
    }
  }
})

/**
 * Get active employees of a company via the Employment join table.
 * Phase 2 migration: reads from `employment` table instead of Client.companyId shadow.
 * Covers REQ-4 (4.1–4.3):
 *   - 4.1: returns only active Employment rows (isActive=true)
 *   - 4.2: returns [] when no active Employments exist
 *   - 4.3: employeeType/workDaysRange come from Employment, NOT from Client shadow columns
 */
export const getCompanyEmployees = cache(async (companyId: string): Promise<ActionResponse<CompanyEmployee[]>> => {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    // Validate input
    const validatedFields = getCompanyEmployeesSchema.safeParse({ companyId })
    if (!validatedFields.success) {
      return { success: false, error: 'Datos inválidos' }
    }

    // Check if company exists
    const company = await prisma.client.findUnique({ where: { id: companyId } })
    if (!company) {
      return { success: false, error: 'Empresa no encontrada' }
    }

    // Check if company is actually a company type
    if (company.clientType !== 'EMPRESA') {
      return { success: false, error: 'Solo clientes tipo EMPRESA pueden tener empleados' }
    }

    // Read from the Employment join table — role fields come from Employment, not Client shadow
    const employments = await prisma.employment.findMany({
      where: { companyId, isActive: true },
      select: {
        employeeType: true,
        workDaysRange: true,
        startDate: true,
        employee: {
          select: {
            id: true,
            fullName: true,
            identificationType: true,
            identificationNumber: true,
            clientType: true,
            email: true,
            phone: true,
            status: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { employee: { fullName: 'asc' } },
    })

    // Flatten: merge employee identity fields with per-employment role fields
    const data: CompanyEmployee[] = employments
      .filter((e) => e.employee.isActive)
      .map((e) => ({
        ...e.employee,
        employeeType: e.employeeType,
        workDaysRange: e.workDaysRange,
        startDate: e.startDate,
      }))

    return { success: true, data }
  } catch (error) {
    console.error('Get company employees error:', error)
    return {
      success: false,
      error: 'Error al obtener empleados de la empresa',
    }
  }
})

/**
 * Update or create legal representative for a company client
 */
export async function updateLegalRepresentative(
  clientId: string,
  data: LegalRepresentativeInput
): Promise<ActionResponse<LegalRepresentative>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const validatedFields = legalRepresentativeSchema.safeParse(data)
    if (!validatedFields.success) {
      return { success: false, error: 'Datos inválidos' }
    }

    const existing = await prisma.legalRepresentative.findUnique({
      where: { clientId },
    })

    let legalRep
    if (existing) {
      legalRep = await prisma.legalRepresentative.update({
        where: { clientId },
        data: validatedFields.data,
      })
    } else {
      legalRep = await prisma.legalRepresentative.create({
        data: {
          ...validatedFields.data,
          clientId,
        },
      })
    }

    revalidatePath(`/dashboard/clients/${clientId}`)

    return {
      success: true,
      message: 'Representante legal actualizado exitosamente',
      data: legalRep,
    }
  } catch (error) {
    console.error('Update legal representative error:', error)
    return {
      success: false,
      error: 'Error al actualizar representante legal',
    }
  }
}

/**
 * Get all active administradoras grouped by type
 */
export const getAdministradoras = cache(async () => {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const administradoras = await prisma.administradora.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true, type: true },
    })

    const grouped = {
      EPS: administradoras.filter((a) => a.type === AdministradoraType.EPS),
      AFP: administradoras.filter((a) => a.type === AdministradoraType.AFP),
      ARL: administradoras.filter((a) => a.type === AdministradoraType.ARL),
      CCF: administradoras.filter((a) => a.type === AdministradoraType.CCF),
    }

    return { success: true, data: grouped }
  } catch (error) {
    console.error('Get administradoras error:', error)
    return { success: false, error: 'Error al obtener administradoras' }
  }
})

/**
 * Update client administradoras (EPS, AFP, ARL, CCF)
 */
export async function updateClientAdministradoras(
  clientId: string,
  data: { epsId: string | null; afpId: string | null; arlId: string | null; arlRiskLevel?: number | null; ccfId: string | null }
): Promise<ActionResponse> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const client = await prisma.client.findUnique({ where: { id: clientId } })
    if (!client) {
      return { success: false, error: 'Cliente no encontrado' }
    }

    await prisma.client.update({
      where: { id: clientId },
      data: {
        epsId: data.epsId,
        afpId: data.afpId,
        arlId: data.arlId,
        arlRiskLevel: data.arlId ? (data.arlRiskLevel ?? null) : null,
        ccfId: data.ccfId,
      },
    })

    return {
      success: true,
      message: 'Administradoras actualizadas exitosamente',
    }
  } catch (error) {
    console.error('Update client administradoras error:', error)
    return {
      success: false,
      error: 'Error al actualizar administradoras',
    }
  }
}
