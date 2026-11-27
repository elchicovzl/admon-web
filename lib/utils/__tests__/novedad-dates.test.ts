import { describe, it, expect } from 'vitest'

import { fechaGuardadaComoLocal, hoyLocal } from '../novedad-dates'

/**
 * Las fechas de novedades se guardan a medianoche UTC. Las aserciones comparan
 * componentes locales contra componentes UTC, así que valen en cualquier zona
 * horaria en la que corra el test (Bogotá incluida).
 */
describe('fechaGuardadaComoLocal', () => {
  it('conserva el día calendario guardado al mostrarlo en hora local', () => {
    const guardada = new Date('2026-11-09T00:00:00.000Z')

    const local = fechaGuardadaComoLocal(guardada)

    expect(local.getFullYear()).toBe(2026)
    expect(local.getMonth()).toBe(10)
    expect(local.getDate()).toBe(9)
    expect(local.getHours()).toBe(0)
  })

  it('acepta el string ISO que llega serializado al cliente', () => {
    const local = fechaGuardadaComoLocal('2026-01-01T00:00:00.000Z')

    expect([local.getFullYear(), local.getMonth(), local.getDate()]).toEqual([2026, 0, 1])
  })
})

describe('hoyLocal', () => {
  it('es la medianoche local de hoy, no la fecha UTC de este instante', () => {
    const ahora = new Date()

    const hoy = hoyLocal()

    expect([hoy.getFullYear(), hoy.getMonth(), hoy.getDate()]).toEqual([
      ahora.getFullYear(),
      ahora.getMonth(),
      ahora.getDate(),
    ])
    expect(hoy.getHours()).toBe(0)
  })
})
