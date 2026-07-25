'use server'

import { auth } from '@/lib/auth/auth'
import { revalidatePath } from 'next/cache'
import prisma from '@/lib/db/prisma'
import { ClientType, UserRole } from '@prisma/client'
import {
  createEmploymentSchema,
  deactivateEmploymentSchema,
  type CreateEmploymentInput,
  type DeactivateEmploymentInput,
} from '@/lib/validations/employment.schema'
import type { Employment } from '@/lib/types/client.types'
import type { ActionResponse } from '@/lib/types/auth.types'

// ---------------------------------------------------------------------------
// Auth helper — same pattern as client.actions.ts
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// createEmployment
// Covers REQ-1 (1.1–1.7) and REQ-2 (2.1–2.2)
// ---------------------------------------------------------------------------

/**
 * Create (or reactivate via upsert) an Employment relationship.
 * Guards:
 *   - Self-employment (employeeId === companyId) → REQ-1.4
 *   - Company must exist and be ClientType.EMPRESA → REQ-1.5 / 1.x
 *   - Employee must exist → REQ-1.x
 *   - Duplicate active employment → REQ-1.3
 *   - Re-hire (inactive employment exists) → upsert reactivates → REQ-1.7
 */
export async function createEmployment(
  input: CreateEmploymentInput
): Promise<ActionResponse<Employment>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    // Validate with Zod (includes self-employment refine)
    const parsed = createEmploymentSchema.safeParse(input)
    if (!parsed.success) {
      // Propagate the self-employment refine message as a specific error
      const selfEmpIssue = parsed.error.issues.find(
        (issue) => issue.message === 'Un cliente no puede ser empleado de sí mismo'
      )
      return {
        success: false,
        error: selfEmpIssue ? 'Un cliente no puede ser empleado de sí mismo' : 'Datos inválidos',
      }
    }

    const { employeeId, companyId, employeeType, workDaysRange } = parsed.data

    // Verify company exists and is of type EMPRESA
    const company = await prisma.client.findUnique({ where: { id: companyId } })
    if (!company) {
      return { success: false, error: 'Empresa no encontrada' }
    }
    if (company.clientType !== ClientType.EMPRESA) {
      return {
        success: false,
        error: 'Solo clientes tipo EMPRESA pueden tener empleados asignados',
      }
    }

    // Verify employee exists
    const employee = await prisma.client.findUnique({ where: { id: employeeId } })
    if (!employee) {
      return { success: false, error: 'Empleado no encontrado' }
    }

    // Reject if an active Employment already exists for this pair (REQ-1.3)
    const existing = await prisma.employment.findUnique({
      where: { employeeId_companyId: { employeeId, companyId } },
    })
    if (existing?.isActive) {
      return {
        success: false,
        error: 'Este cliente ya está activamente empleado en esta empresa',
      }
    }

    // Upsert: handles both new Employment (create) and re-hire (update isActive=true) — REQ-1.7
    const employment = await prisma.employment.upsert({
      where: { employeeId_companyId: { employeeId, companyId } },
      update: { isActive: true, employeeType: employeeType ?? null, workDaysRange: workDaysRange ?? null },
      create: {
        employeeId,
        companyId,
        employeeType: employeeType ?? null,
        workDaysRange: workDaysRange ?? null,
        isActive: true,
      },
    })

    revalidatePath('/dashboard/clients')
    revalidatePath(`/dashboard/clients/${employeeId}`)
    revalidatePath(`/dashboard/clients/${companyId}`)

    return { success: true, data: employment as unknown as Employment }
  } catch (error) {
    console.error('Create employment error:', error)
    return { success: false, error: 'Error al crear la relación de empleo' }
  }
}

// ---------------------------------------------------------------------------
// deactivateEmployment
// Covers REQ-5 (5.1–5.4)
// ---------------------------------------------------------------------------

/**
 * Deactivate (soft-delete) an Employment row by setting isActive = false.
 * Guards:
 *   - Employment must exist → REQ-5.2
 *   - Employment must be currently active → REQ-5.3
 *   - Only the specific (employeeId, companyId) pair is affected → REQ-5.4
 */
export async function deactivateEmployment(
  input: DeactivateEmploymentInput
): Promise<ActionResponse<void>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const parsed = deactivateEmploymentSchema.safeParse(input)
    if (!parsed.success) {
      return { success: false, error: 'Datos inválidos' }
    }

    const { employeeId, companyId } = parsed.data

    // Check employment exists
    const employment = await prisma.employment.findUnique({
      where: { employeeId_companyId: { employeeId, companyId } },
    })

    if (!employment) {
      return { success: false, error: 'Relación de empleo no encontrada' }
    }

    if (!employment.isActive) {
      return { success: false, error: 'Esta relación de empleo ya se encuentra inactiva' }
    }

    await prisma.employment.update({
      where: { employeeId_companyId: { employeeId, companyId } },
      data: { isActive: false },
    })

    revalidatePath('/dashboard/clients')
    revalidatePath(`/dashboard/clients/${employeeId}`)
    revalidatePath(`/dashboard/clients/${companyId}`)

    return { success: true }
  } catch (error) {
    console.error('Deactivate employment error:', error)
    return { success: false, error: 'Error al desactivar la relación de empleo' }
  }
}
