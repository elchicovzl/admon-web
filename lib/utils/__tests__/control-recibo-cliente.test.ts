import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Prisma } from '@prisma/client'

import {
  normalizarDocumento,
  resolverContraparteDeCliente,
} from '../control-recibo-cliente'

const tx = {
  client: { findFirst: vi.fn() },
  contraparte: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
}
const txCliente = tx as unknown as Prisma.TransactionClient

const CLIENT_ID = 'cclienteana001'
const USER_ID = 'cuser0000001'
const CLIENTE = { id: CLIENT_ID, fullName: 'Ana Pérez', identificationNumber: '1.020.304.050' }

beforeEach(() => {
  vi.clearAllMocks()
  tx.client.findFirst.mockResolvedValue(CLIENTE)
  tx.contraparte.findUnique.mockResolvedValue(null)
})

describe('normalizarDocumento', () => {
  it('deja solo dígitos', () => {
    expect(normalizarDocumento('1.020.304.050')).toBe('1020304050')
  })

  it('devuelve null si no cabe en el formato de contraparte', () => {
    expect(normalizarDocumento('AB12')).toBeNull()
    expect(normalizarDocumento('1234567890123456')).toBeNull()
  })
})

describe('resolverContraparteDeCliente', () => {
  it('usa la contraparte ya vinculada al cliente', async () => {
    const vinculada = { id: 'ccontra00001', nombre: 'Ana', documento: '1020304050' }
    tx.contraparte.findUnique.mockResolvedValueOnce(vinculada)

    const res = await resolverContraparteDeCliente(txCliente, CLIENT_ID, USER_ID)

    expect(res).toEqual({ ok: true, contraparte: vinculada })
    expect(tx.contraparte.create).not.toHaveBeenCalled()
    expect(tx.contraparte.update).not.toHaveBeenCalled()
  })

  it('vincula la contraparte con el mismo documento que no tenía cliente', async () => {
    tx.contraparte.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'ccontra00002',
        nombre: 'Ana P.',
        documento: '1020304050',
        clientId: null,
      })

    const res = await resolverContraparteDeCliente(txCliente, CLIENT_ID, USER_ID)

    expect(res).toEqual({
      ok: true,
      contraparte: { id: 'ccontra00002', nombre: 'Ana P.', documento: '1020304050' },
    })
    expect(tx.contraparte.update).toHaveBeenCalledWith({
      where: { id: 'ccontra00002' },
      data: { clientId: CLIENT_ID },
    })
    expect(tx.contraparte.create).not.toHaveBeenCalled()
  })

  it('crea una contraparte CLIENTE con el documento normalizado si no hay ninguna', async () => {
    tx.contraparte.create.mockResolvedValue({
      id: 'ccontra00003',
      nombre: 'Ana Pérez',
      documento: '1020304050',
    })

    const res = await resolverContraparteDeCliente(txCliente, CLIENT_ID, USER_ID)

    expect(res.ok).toBe(true)
    expect(tx.contraparte.create).toHaveBeenCalledWith({
      data: {
        nombre: 'Ana Pérez',
        tipo: 'CLIENTE',
        documento: '1020304050',
        clientId: CLIENT_ID,
        createdById: USER_ID,
      },
      select: { id: true, nombre: true, documento: true },
    })
  })

  it('devuelve un error claro si el documento es de otro cliente', async () => {
    tx.contraparte.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'ccontra00004',
        nombre: 'Ana Gómez',
        documento: '1020304050',
        clientId: 'cotrocliente001',
      })

    const res = await resolverContraparteDeCliente(txCliente, CLIENT_ID, USER_ID)

    expect(res).toMatchObject({ ok: false })
    expect(res.ok === false && res.error).toContain('otro cliente')
    expect(tx.contraparte.create).not.toHaveBeenCalled()
    expect(tx.contraparte.update).not.toHaveBeenCalled()
  })

  it('falla si el cliente no existe o está inactivo', async () => {
    tx.client.findFirst.mockResolvedValue(null)

    const res = await resolverContraparteDeCliente(txCliente, CLIENT_ID, USER_ID)

    expect(res).toEqual({ ok: false, error: 'Cliente no encontrado' })
    expect(tx.client.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: CLIENT_ID, isActive: true } })
    )
    expect(tx.contraparte.create).not.toHaveBeenCalled()
  })

  it('crea la contraparte sin documento si la identificación no es válida', async () => {
    tx.client.findFirst.mockResolvedValue({ ...CLIENTE, identificationNumber: 'PA-12' })
    tx.contraparte.create.mockResolvedValue({ id: 'c5', nombre: 'Ana Pérez', documento: null })

    await resolverContraparteDeCliente(txCliente, CLIENT_ID, USER_ID)

    expect(tx.contraparte.findUnique).toHaveBeenCalledTimes(1)
    expect(tx.contraparte.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ documento: null }) })
    )
  })
})
