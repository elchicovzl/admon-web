import { describe, it, expect } from 'vitest'
import { TipoMovimiento } from '@prisma/client'

import { createMovimientoSchema, emitirReciboSchema } from '../control.schema'

const CLIENT_ID = 'cclienteana001'

const INGRESO_CON_RECIBO = {
  fecha: '2026-08-27',
  tipo: TipoMovimiento.INGRESO,
  monto: 100000,
  concepto: 'Honorarios agosto',
  bolsilloId: 'cbolsillo0001',
  categoriaId: 'ccategoria001',
  servicioAlegraId: 'csrvadmin0001',
  emitirRecibo: true,
}

describe('createMovimientoSchema — cliente del recibo', () => {
  it('con recibo exige clientId', () => {
    const res = createMovimientoSchema.safeParse(INGRESO_CON_RECIBO)

    expect(res.success).toBe(false)
    expect(res.error?.issues[0]).toMatchObject({
      message: 'El recibo requiere un cliente',
      path: ['clientId'],
    })
  })

  it('con recibo, una contraparte sola ya no alcanza', () => {
    const res = createMovimientoSchema.safeParse({
      ...INGRESO_CON_RECIBO,
      contraparteId: 'ccontraana001',
    })

    expect(res.success).toBe(false)
  })

  it('con recibo acepta clientId', () => {
    expect(
      createMovimientoSchema.safeParse({ ...INGRESO_CON_RECIBO, clientId: CLIENT_ID }).success
    ).toBe(true)
  })

  it('sin recibo, clientId es opcional y contraparteId sigue funcionando', () => {
    const { emitirRecibo: _omitido, ...sinRecibo } = INGRESO_CON_RECIBO

    expect(createMovimientoSchema.safeParse(sinRecibo).success).toBe(true)
    expect(
      createMovimientoSchema.safeParse({ ...sinRecibo, contraparteId: 'ccontraana001' }).success
    ).toBe(true)
  })

  it('rechaza un clientId que no es un cuid', () => {
    const res = createMovimientoSchema.safeParse({ ...INGRESO_CON_RECIBO, clientId: 'x' })

    expect(res.success).toBe(false)
  })
})

describe('emitirReciboSchema', () => {
  it('exige clientId', () => {
    expect(emitirReciboSchema.safeParse({ movimientoId: 'cmovexistente01' }).success).toBe(false)
  })

  it('acepta movimientoId y clientId', () => {
    expect(
      emitirReciboSchema.safeParse({ movimientoId: 'cmovexistente01', clientId: CLIENT_ID }).success
    ).toBe(true)
  })
})
