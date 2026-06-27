import { NovedadType, NovedadUnit } from '@prisma/client'

/** Referencia mínima a un usuario embebida en una novedad. */
export interface NovedadUserRef {
  id: string
  name: string | null
  email: string
}

/** Una novedad tal como se muestra en las tablas. */
export interface NovedadListItem {
  id: string
  type: NovedadType
  unit: NovedadUnit
  startDate: Date
  endDate: Date
  hours: number | null
  vacationDaysDeducted: number
  year: number
  observation: string | null
  isActive: boolean
  createdAt: Date
  user: NovedadUserRef
  createdBy: { name: string | null; email: string }
}

/** Estadísticas de vacaciones/novedades de un empleado en un año. */
export interface EmployeeVacationStats {
  userId: string
  name: string | null
  email: string
  year: number
  annualDays: number // días hábiles anuales (15)
  usedDays: number // días de vacaciones descontados
  availableDays: number // saldo disponible (annual - used)
  vacacionesCount: number // cantidad de registros de vacaciones
  permisosCount: number // cantidad de permisos
  permisosHours: number // total de horas de permisos
  calamidadCount: number // cantidad de calamidades
}

/** Detalle del tablero de un empleado para un año. */
export interface NovedadEmployeeDetail {
  user: NovedadUserRef
  year: number
  stats: EmployeeVacationStats
  novedades: NovedadListItem[]
  availableYears: number[]
}
