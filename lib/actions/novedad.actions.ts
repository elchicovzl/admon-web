'use server'

import { cache } from 'react'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth/auth'
import prisma from '@/lib/db/prisma'
import { NovedadType, UserRole } from '@prisma/client'
import type { ActionResponse } from '@/lib/types/auth.types'
import type {
  NovedadListItem,
  EmployeeVacationStats,
  NovedadEmployeeDetail,
} from '@/lib/types/novedad.types'
import {
  createNovedadSchema,
  updateNovedadSchema,
  toggleNovedadStatusSchema,
  type CreateNovedadInput,
  type UpdateNovedadInput,
} from '@/lib/validations/novedad.schema'
import {
  computeVacationDeduction,
  vacationBalance,
  ANNUAL_VACATION_DAYS,
} from '@/lib/utils/novedad-balance'

/**
 * Solo SUPER_ADMIN o MANAGER pueden gestionar novedades.
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
 * Pin de una fecha a medianoche UTC tomando su día calendario UTC. Garantiza
 * que el conteo de días hábiles (que opera en UTC) lea siempre el día correcto.
 */
function normalizeUtcDate(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

const currentYear = () => new Date().getUTCFullYear()

/** Campos que componen un NovedadListItem. */
const novedadSelect = {
  id: true,
  type: true,
  unit: true,
  startDate: true,
  endDate: true,
  hours: true,
  vacationDaysDeducted: true,
  year: true,
  observation: true,
  isActive: true,
  createdAt: true,
  user: { select: { id: true, name: true, email: true } },
  createdBy: { select: { name: true, email: true } },
} as const

/**
 * Lista de novedades de un año (solo activas), más reciente primero.
 */
export const getNovedades = cache(
  async (year?: number): Promise<ActionResponse<NovedadListItem[]>> => {
    try {
      const authCheck = await requireManagerOrAdmin()
      if (!authCheck.authorized) {
        return { success: false, error: authCheck.error }
      }

      const novedades = await prisma.novedad.findMany({
        where: { isActive: true, ...(year ? { year } : {}) },
        select: novedadSelect,
        orderBy: { startDate: 'desc' },
      })

      return { success: true, data: novedades as NovedadListItem[] }
    } catch (error) {
      console.error('Get novedades error:', error)
      return { success: false, error: 'Error al obtener las novedades' }
    }
  }
)

/**
 * Una novedad por ID (para editar).
 */
export const getNovedadById = cache(
  async (id: string): Promise<ActionResponse<NovedadListItem>> => {
    try {
      const authCheck = await requireManagerOrAdmin()
      if (!authCheck.authorized) {
        return { success: false, error: authCheck.error }
      }

      const novedad = await prisma.novedad.findUnique({
        where: { id },
        select: novedadSelect,
      })

      if (!novedad) {
        return { success: false, error: 'Novedad no encontrada' }
      }

      return { success: true, data: novedad as NovedadListItem }
    } catch (error) {
      console.error('Get novedad error:', error)
      return { success: false, error: 'Error al obtener la novedad' }
    }
  }
)

/** Construye las estadísticas de un empleado a partir de sus novedades. */
function buildStats(
  user: { id: string; name: string | null; email: string },
  novedades: {
    type: NovedadType
    hours: number | null
    vacationDaysDeducted: number
  }[],
  year: number
): EmployeeVacationStats {
  let usedDays = 0
  let vacacionesCount = 0
  let permisosCount = 0
  let permisosHours = 0
  let calamidadCount = 0

  for (const n of novedades) {
    usedDays += n.vacationDaysDeducted
    if (n.type === NovedadType.VACACIONES) vacacionesCount++
    if (n.type === NovedadType.PERMISO) {
      permisosCount++
      permisosHours += n.hours ?? 0
    }
    if (n.type === NovedadType.CALAMIDAD) calamidadCount++
  }

  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    year,
    annualDays: ANNUAL_VACATION_DAYS,
    usedDays,
    availableDays: vacationBalance(usedDays),
    vacacionesCount,
    permisosCount,
    permisosHours,
    calamidadCount,
  }
}

/**
 * Tablero: estadísticas de vacaciones/novedades de cada empleado en un año.
 */
export const getEmployeesVacationStats = cache(
  async (year?: number): Promise<ActionResponse<EmployeeVacationStats[]>> => {
    try {
      const authCheck = await requireManagerOrAdmin()
      if (!authCheck.authorized) {
        return { success: false, error: authCheck.error }
      }

      const targetYear = year ?? currentYear()

      const [users, novedades] = await Promise.all([
        prisma.user.findMany({
          where: { isActive: true },
          select: { id: true, name: true, email: true },
          orderBy: { name: 'asc' },
        }),
        prisma.novedad.findMany({
          where: { isActive: true, year: targetYear },
          select: { userId: true, type: true, hours: true, vacationDaysDeducted: true },
        }),
      ])

      const byUser = new Map<string, typeof novedades>()
      for (const n of novedades) {
        const list = byUser.get(n.userId) ?? []
        list.push(n)
        byUser.set(n.userId, list)
      }

      const data = users.map((u) =>
        buildStats(u, byUser.get(u.id) ?? [], targetYear)
      )

      return { success: true, data }
    } catch (error) {
      console.error('Get employees vacation stats error:', error)
      return { success: false, error: 'Error al obtener las estadísticas' }
    }
  }
)

/**
 * Detalle del tablero de un empleado: estadísticas + novedades del año, y la
 * lista de años con registros para el selector.
 */
export const getEmployeeNovedadDetail = cache(
  async (userId: string, year?: number): Promise<ActionResponse<NovedadEmployeeDetail>> => {
    try {
      const authCheck = await requireManagerOrAdmin()
      if (!authCheck.authorized) {
        return { success: false, error: authCheck.error }
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true },
      })

      if (!user) {
        return { success: false, error: 'Empleado no encontrado' }
      }

      const targetYear = year ?? currentYear()

      const [novedades, yearsRaw] = await Promise.all([
        prisma.novedad.findMany({
          where: { userId, isActive: true, year: targetYear },
          select: novedadSelect,
          orderBy: { startDate: 'desc' },
        }),
        prisma.novedad.findMany({
          where: { userId, isActive: true },
          select: { year: true },
          distinct: ['year'],
          orderBy: { year: 'desc' },
        }),
      ])

      const novedadList = novedades as NovedadListItem[]
      const stats = buildStats(user, novedadList, targetYear)

      const availableYears = yearsRaw.map((y) => y.year)
      if (!availableYears.includes(targetYear)) {
        availableYears.unshift(targetYear)
        availableYears.sort((a, b) => b - a)
      }

      return {
        success: true,
        data: { user, year: targetYear, stats, novedades: novedadList, availableYears },
      }
    } catch (error) {
      console.error('Get employee novedad detail error:', error)
      return { success: false, error: 'Error al obtener el detalle del empleado' }
    }
  }
)

/**
 * Crea una novedad. El descuento de vacaciones y el año se calculan en el
 * servidor a partir de los datos validados (nunca se confía en el cliente).
 */
export async function createNovedad(
  data: CreateNovedadInput
): Promise<ActionResponse<NovedadListItem>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const validated = createNovedadSchema.safeParse(data)
    if (!validated.success) {
      return { success: false, error: 'Datos inválidos' }
    }

    const { userId, type, unit, observation } = validated.data
    const startDate = normalizeUtcDate(validated.data.startDate)
    const endDate = normalizeUtcDate(validated.data.endDate)
    const hours = unit === 'HORAS' ? validated.data.hours ?? null : null

    const employee = await prisma.user.findUnique({ where: { id: userId } })
    if (!employee) {
      return { success: false, error: 'Empleado no encontrado' }
    }

    const vacationDaysDeducted = computeVacationDeduction({
      type,
      startDate,
      endDate,
      hours,
    })
    const year = startDate.getUTCFullYear()

    const novedad = await prisma.novedad.create({
      data: {
        userId,
        type,
        unit,
        startDate,
        endDate,
        hours,
        vacationDaysDeducted,
        year,
        observation: observation ?? null,
        createdById: authCheck.userId!,
      },
      select: novedadSelect,
    })

    revalidatePath('/dashboard/novedades')
    revalidatePath(`/dashboard/novedades/${userId}`)

    return {
      success: true,
      message: 'Novedad registrada exitosamente',
      data: novedad as NovedadListItem,
    }
  } catch (error) {
    console.error('Create novedad error:', error)
    return { success: false, error: 'Error al registrar la novedad' }
  }
}

/**
 * Actualiza una novedad recalculando el descuento y el año.
 */
export async function updateNovedad(
  id: string,
  data: UpdateNovedadInput
): Promise<ActionResponse<NovedadListItem>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const validated = updateNovedadSchema.safeParse({ ...data, id })
    if (!validated.success) {
      return { success: false, error: 'Datos inválidos' }
    }

    const existing = await prisma.novedad.findUnique({ where: { id } })
    if (!existing) {
      return { success: false, error: 'Novedad no encontrada' }
    }

    const { userId, type, unit, observation } = validated.data
    const startDate = normalizeUtcDate(validated.data.startDate)
    const endDate = normalizeUtcDate(validated.data.endDate)
    const hours = unit === 'HORAS' ? validated.data.hours ?? null : null

    const vacationDaysDeducted = computeVacationDeduction({
      type,
      startDate,
      endDate,
      hours,
    })
    const year = startDate.getUTCFullYear()

    const novedad = await prisma.novedad.update({
      where: { id },
      data: {
        userId,
        type,
        unit,
        startDate,
        endDate,
        hours,
        vacationDaysDeducted,
        year,
        observation: observation ?? null,
      },
      select: novedadSelect,
    })

    revalidatePath('/dashboard/novedades')
    revalidatePath(`/dashboard/novedades/${userId}`)
    revalidatePath(`/dashboard/novedades/${existing.userId}`)

    return {
      success: true,
      message: 'Novedad actualizada exitosamente',
      data: novedad as NovedadListItem,
    }
  } catch (error) {
    console.error('Update novedad error:', error)
    return { success: false, error: 'Error al actualizar la novedad' }
  }
}

/**
 * Activa/desactiva una novedad (soft delete). Al desactivar, su descuento deja
 * de contar para el saldo porque el banco se calcula solo sobre activas.
 */
export async function toggleNovedadStatus(
  id: string,
  isActive: boolean
): Promise<ActionResponse> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const validated = toggleNovedadStatusSchema.safeParse({ id, isActive })
    if (!validated.success) {
      return { success: false, error: 'Datos inválidos' }
    }

    const existing = await prisma.novedad.findUnique({ where: { id } })
    if (!existing) {
      return { success: false, error: 'Novedad no encontrada' }
    }

    await prisma.novedad.update({ where: { id }, data: { isActive } })

    revalidatePath('/dashboard/novedades')
    revalidatePath(`/dashboard/novedades/${existing.userId}`)

    return {
      success: true,
      message: isActive ? 'Novedad restaurada' : 'Novedad eliminada',
    }
  } catch (error) {
    console.error('Toggle novedad status error:', error)
    return { success: false, error: 'Error al cambiar el estado de la novedad' }
  }
}
