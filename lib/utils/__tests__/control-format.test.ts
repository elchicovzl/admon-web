import { describe, it, expect } from 'vitest'

import { hoyComoFechaCalendario } from '../control-format'

/**
 * El libro es un calendario de Bogotá (UTC-5). "Hoy" es el día en Bogotá, no
 * el día UTC del instante ni el de la zona del navegador o del servidor.
 */
describe('hoyComoFechaCalendario', () => {
  it('a las 8 p. m. en Bogotá sigue siendo hoy, aunque en UTC ya sea mañana', () => {
    // 2026-11-27 20:00 en Bogotá = 2026-11-28 01:00 UTC
    expect(hoyComoFechaCalendario(new Date('2026-11-28T01:00:00.000Z'))).toBe('2026-11-27')
  })

  it('el último día del mes a la noche no salta al mes siguiente', () => {
    // 2026-11-30 23:59 en Bogotá = 2026-12-01 04:59 UTC
    expect(hoyComoFechaCalendario(new Date('2026-12-01T04:59:00.000Z'))).toBe('2026-11-30')
  })

  it('a medianoche en Bogotá ya es el día nuevo', () => {
    // 2026-12-01 00:00 en Bogotá = 2026-12-01 05:00 UTC
    expect(hoyComoFechaCalendario(new Date('2026-12-01T05:00:00.000Z'))).toBe('2026-12-01')
  })

  it('a la mañana coincide con el día UTC', () => {
    expect(hoyComoFechaCalendario(new Date('2026-11-27T14:00:00.000Z'))).toBe('2026-11-27')
  })
})
