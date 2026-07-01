import { z } from 'zod'
import { EmployeeType, WorkDaysRange } from '@prisma/client'

/**
 * Schema for creating a new Employment row.
 * Includes a self-employment guard (.refine) so employeeId !== companyId.
 * employeeType and workDaysRange are optional/nullable — employment rows
 * created during backfill may have null values (REQ-7.4 legacy tolerance).
 */
export const createEmploymentSchema = z
  .object({
    employeeId: z.string().cuid('ID de empleado inválido'),
    companyId: z.string().cuid('ID de empresa inválido'),
    employeeType: z.nativeEnum(EmployeeType).optional().nullable(),
    workDaysRange: z.nativeEnum(WorkDaysRange).optional().nullable(),
  })
  .refine((d) => d.employeeId !== d.companyId, {
    message: 'Un cliente no puede ser empleado de sí mismo',
    path: ['employeeId'],
  })

export type CreateEmploymentInput = z.infer<typeof createEmploymentSchema>

/**
 * Schema for deactivating an Employment row.
 * Both ids are required because a client may be employed by multiple companies.
 */
export const deactivateEmploymentSchema = z.object({
  employeeId: z.string().cuid('ID de empleado inválido'),
  companyId: z.string().cuid('ID de empresa inválido'),
})

export type DeactivateEmploymentInput = z.infer<typeof deactivateEmploymentSchema>

/**
 * Schema for querying available employees scoped to a specific company.
 */
export const getAvailableEmployeesSchema = z.object({
  companyId: z.string().cuid('ID de empresa inválido'),
})

export type GetAvailableEmployeesInput = z.infer<typeof getAvailableEmployeesSchema>
