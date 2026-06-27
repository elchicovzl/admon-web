import { describe, it, expect } from 'vitest'
import {
  getColombianHolidays,
  isWeekend,
  businessDaysBetween,
} from '../colombian-holidays'

describe('getColombianHolidays (2025)', () => {
  const holidays = getColombianHolidays(2025)

  it('incluye los festivos fijos (no se trasladan)', () => {
    expect(holidays.has('2025-01-01')).toBe(true) // Año Nuevo
    expect(holidays.has('2025-05-01')).toBe(true) // Día del Trabajo
    expect(holidays.has('2025-07-20')).toBe(true) // Independencia
    expect(holidays.has('2025-08-07')).toBe(true) // Batalla de Boyacá
    expect(holidays.has('2025-12-08')).toBe(true) // Inmaculada Concepción
    expect(holidays.has('2025-12-25')).toBe(true) // Navidad
  })

  it('traslada los festivos Emiliani al lunes siguiente', () => {
    expect(holidays.has('2025-03-24')).toBe(true) // San José (19/03 mié → lun 24)
    expect(holidays.has('2025-08-18')).toBe(true) // Asunción (15/08 vie → lun 18)
    expect(holidays.has('2025-10-13')).toBe(true) // Día de la Raza (12/10 dom → lun 13)
    expect(holidays.has('2025-11-03')).toBe(true) // Todos los Santos (01/11 sáb → lun 03)
    expect(holidays.has('2025-11-17')).toBe(true) // Independencia de Cartagena (11/11 mar → lun 17)
  })

  it('NO incluye la fecha original de un festivo trasladado', () => {
    expect(holidays.has('2025-03-19')).toBe(false) // San José fue movido al 24
  })

  it('incluye los festivos derivados de la Pascua', () => {
    expect(holidays.has('2025-04-17')).toBe(true) // Jueves Santo
    expect(holidays.has('2025-04-18')).toBe(true) // Viernes Santo
    expect(holidays.has('2025-06-02')).toBe(true) // Ascensión del Señor (trasladada)
    expect(holidays.has('2025-06-23')).toBe(true) // Corpus Christi (trasladado)
    expect(holidays.has('2025-06-30')).toBe(true) // Sagrado Corazón (trasladado)
  })

  it('Reyes Magos cae lunes y no se mueve (06/01/2025 es lunes)', () => {
    expect(holidays.has('2025-01-06')).toBe(true)
  })

  it('no marca un día hábil cualquiera como festivo', () => {
    expect(holidays.has('2025-07-04')).toBe(false)
  })
})

describe('isWeekend', () => {
  it('detecta sábado y domingo', () => {
    expect(isWeekend(new Date('2025-06-14'))).toBe(true) // sábado
    expect(isWeekend(new Date('2025-06-15'))).toBe(true) // domingo
  })

  it('no marca días de semana', () => {
    expect(isWeekend(new Date('2025-06-09'))).toBe(false) // lunes
    expect(isWeekend(new Date('2025-06-13'))).toBe(false) // viernes
  })
})

describe('businessDaysBetween', () => {
  it('cuenta una semana laboral completa sin festivos (lun-vie)', () => {
    expect(
      businessDaysBetween(new Date('2025-06-09'), new Date('2025-06-13'))
    ).toBe(5)
  })

  it('ignora el fin de semana dentro del rango', () => {
    // lun 09 a dom 15 → siguen siendo 5 hábiles
    expect(
      businessDaysBetween(new Date('2025-06-09'), new Date('2025-06-15'))
    ).toBe(5)
  })

  it('excluye festivos del conteo', () => {
    // lun 30/06 es festivo (Sagrado Corazón) → mar-vie = 4 hábiles
    expect(
      businessDaysBetween(new Date('2025-06-30'), new Date('2025-07-04'))
    ).toBe(4)
  })

  it('excluye Jueves y Viernes Santo (Semana Santa 2025)', () => {
    // lun 14 a vie 18: jue 17 y vie 18 son festivos → lun, mar, mié = 3
    expect(
      businessDaysBetween(new Date('2025-04-14'), new Date('2025-04-18'))
    ).toBe(3)
  })

  it('un solo día hábil cuenta 1', () => {
    expect(
      businessDaysBetween(new Date('2025-06-10'), new Date('2025-06-10'))
    ).toBe(1)
  })

  it('un solo día de fin de semana cuenta 0', () => {
    expect(
      businessDaysBetween(new Date('2025-06-14'), new Date('2025-06-14'))
    ).toBe(0)
  })

  it('un solo día festivo cuenta 0', () => {
    expect(
      businessDaysBetween(new Date('2025-01-01'), new Date('2025-01-01'))
    ).toBe(0)
  })

  it('devuelve 0 si el rango está invertido', () => {
    expect(
      businessDaysBetween(new Date('2025-06-13'), new Date('2025-06-09'))
    ).toBe(0)
  })

  it('soporta rangos que cruzan de un año a otro', () => {
    // mar 30/12/2025 a vie 02/01/2026: 01/01 es festivo → mar 30, mié 31, vie 02 = 3
    expect(
      businessDaysBetween(new Date('2025-12-30'), new Date('2026-01-02'))
    ).toBe(3)
  })
})
