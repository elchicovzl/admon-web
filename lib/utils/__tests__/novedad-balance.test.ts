import { describe, it, expect } from 'vitest'
import { NovedadType } from '@prisma/client'
import {
  computeVacationDeduction,
  vacationBalance,
  ANNUAL_VACATION_DAYS,
  PERMIT_HOURS_THRESHOLD,
} from '../novedad-balance'

describe('constantes de negocio', () => {
  it('vacaciones anuales = 15 días hábiles (Art. 186 CST)', () => {
    expect(ANNUAL_VACATION_DAYS).toBe(15)
  })

  it('umbral de permiso = 3 horas', () => {
    expect(PERMIT_HOURS_THRESHOLD).toBe(3)
  })
})

describe('computeVacationDeduction · VACACIONES', () => {
  it('descuenta los días hábiles del rango', () => {
    // lun 09 a vie 13 de junio 2025 → 5 hábiles
    expect(
      computeVacationDeduction({
        type: NovedadType.VACACIONES,
        startDate: new Date('2025-06-09'),
        endDate: new Date('2025-06-13'),
        hours: null,
      })
    ).toBe(5)
  })

  it('no descuenta si el rango cae en fin de semana', () => {
    expect(
      computeVacationDeduction({
        type: NovedadType.VACACIONES,
        startDate: new Date('2025-06-14'),
        endDate: new Date('2025-06-15'),
        hours: null,
      })
    ).toBe(0)
  })
})

describe('computeVacationDeduction · PERMISO (regla de las 3 horas)', () => {
  it('permiso de MÁS de 3 horas descuenta 1 día', () => {
    expect(
      computeVacationDeduction({
        type: NovedadType.PERMISO,
        startDate: new Date('2025-06-10'),
        endDate: new Date('2025-06-10'),
        hours: 4,
      })
    ).toBe(1)
  })

  it('permiso de exactamente 3 horas NO descuenta (umbral estricto)', () => {
    expect(
      computeVacationDeduction({
        type: NovedadType.PERMISO,
        startDate: new Date('2025-06-10'),
        endDate: new Date('2025-06-10'),
        hours: 3,
      })
    ).toBe(0)
  })

  it('permiso de 3.5 horas descuenta 1 día', () => {
    expect(
      computeVacationDeduction({
        type: NovedadType.PERMISO,
        startDate: new Date('2025-06-10'),
        endDate: new Date('2025-06-10'),
        hours: 3.5,
      })
    ).toBe(1)
  })

  it('permiso de menos de 3 horas NO descuenta', () => {
    expect(
      computeVacationDeduction({
        type: NovedadType.PERMISO,
        startDate: new Date('2025-06-10'),
        endDate: new Date('2025-06-10'),
        hours: 2,
      })
    ).toBe(0)
  })

  it('permiso sin horas (null) NO descuenta', () => {
    expect(
      computeVacationDeduction({
        type: NovedadType.PERMISO,
        startDate: new Date('2025-06-10'),
        endDate: new Date('2025-06-10'),
        hours: null,
      })
    ).toBe(0)
  })
})

describe('computeVacationDeduction · CALAMIDAD', () => {
  it('nunca descuenta vacaciones, sin importar el rango', () => {
    expect(
      computeVacationDeduction({
        type: NovedadType.CALAMIDAD,
        startDate: new Date('2025-06-09'),
        endDate: new Date('2025-06-13'),
        hours: null,
      })
    ).toBe(0)
  })
})

describe('vacationBalance', () => {
  it('saldo = 15 cuando no hay descuentos', () => {
    expect(vacationBalance(0)).toBe(15)
  })

  it('resta lo usado', () => {
    expect(vacationBalance(5)).toBe(10)
  })

  it('saldo 0 cuando se usaron los 15', () => {
    expect(vacationBalance(15)).toBe(0)
  })

  it('nunca devuelve negativo (clamp a 0)', () => {
    expect(vacationBalance(20)).toBe(0)
  })
})
