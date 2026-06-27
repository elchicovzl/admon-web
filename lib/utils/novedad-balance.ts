import { NovedadType } from '@prisma/client'
import { businessDaysBetween } from './colombian-holidays'

/**
 * Días hábiles de vacaciones por año (Art. 186 CST). Se reinician cada 1 de
 * enero — las vacaciones no se acumulan entre años (política interna).
 */
export const ANNUAL_VACATION_DAYS = 15

/**
 * Umbral de horas a partir del cual un permiso descuenta un día de vacaciones.
 * Permisos de MÁS de 3 horas restan 1 día; permisos de 3 horas o menos no.
 */
export const PERMIT_HOURS_THRESHOLD = 3

export interface DeductionInput {
  type: NovedadType
  startDate: Date
  endDate: Date
  hours?: number | null
}

/**
 * Calcula cuántos días hábiles de vacaciones descuenta una novedad.
 *
 * Reglas (ley colombiana + política interna):
 * - VACACIONES → días hábiles del rango (excluye fines de semana y festivos).
 * - PERMISO    → 1 día solo si supera 3 horas; en caso contrario, 0.
 * - CALAMIDAD  → siempre 0 (la calamidad doméstica no descuenta vacaciones).
 */
export function computeVacationDeduction(input: DeductionInput): number {
  switch (input.type) {
    case NovedadType.VACACIONES:
      return businessDaysBetween(input.startDate, input.endDate)
    case NovedadType.PERMISO:
      return (input.hours ?? 0) > PERMIT_HOURS_THRESHOLD ? 1 : 0
    case NovedadType.CALAMIDAD:
      return 0
    default:
      return 0
  }
}

/**
 * Saldo de días de vacaciones disponibles para un año dado, a partir del total
 * descontado en ese año.
 */
export function vacationBalance(totalDeducted: number): number {
  return Math.max(0, ANNUAL_VACATION_DAYS - totalDeducted)
}
