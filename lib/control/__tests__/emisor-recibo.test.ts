import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { configuracionEmpresa: { findUnique: vi.fn() } },
}))

vi.mock('@/lib/db/prisma', () => ({ default: prismaMock }))

import { obtenerEmisorRecibo } from '../emisor-recibo'
import { PLACEHOLDER_EMISOR, emisorReciboCompleto } from '@/lib/config/recibo-emisor'

const fila = {
  id: 'default',
  razonSocial: 'Empresa S.A.S.',
  nit: '900123456-7',
  direccion: 'Calle 1 # 2-3',
  ciudad: 'Bogotá',
  telefono: '3000000000',
  email: 'contacto@example.com',
  updatedAt: new Date(),
  updatedById: 'u1',
}

beforeEach(() => vi.resetAllMocks())

describe('obtenerEmisorRecibo', () => {
  it('reads the singleton row and maps its fields', async () => {
    prismaMock.configuracionEmpresa.findUnique.mockResolvedValue(fila)

    const emisor = await obtenerEmisorRecibo()

    expect(prismaMock.configuracionEmpresa.findUnique).toHaveBeenCalledWith({
      where: { id: 'default' },
    })
    expect(emisor).toEqual({
      razonSocial: 'Empresa S.A.S.',
      nit: '900123456-7',
      direccion: 'Calle 1 # 2-3',
      ciudad: 'Bogotá',
      telefono: '3000000000',
      email: 'contacto@example.com',
    })
    expect(emisorReciboCompleto(emisor)).toBe(true)
  })

  it('falls back to the placeholder in every field when there is no row', async () => {
    prismaMock.configuracionEmpresa.findUnique.mockResolvedValue(null)

    const emisor = await obtenerEmisorRecibo()

    expect(Object.values(emisor)).toEqual(Array(6).fill(PLACEHOLDER_EMISOR))
    expect(emisorReciboCompleto(emisor)).toBe(false)
  })

  it('falls back field by field when a value is blank', async () => {
    prismaMock.configuracionEmpresa.findUnique.mockResolvedValue({ ...fila, nit: '  ', ciudad: '' })

    const emisor = await obtenerEmisorRecibo()

    expect(emisor.nit).toBe(PLACEHOLDER_EMISOR)
    expect(emisor.ciudad).toBe(PLACEHOLDER_EMISOR)
    expect(emisor.razonSocial).toBe('Empresa S.A.S.')
    expect(emisorReciboCompleto(emisor)).toBe(false)
  })
})
