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
const CLIENTE = {
  id: CLIENT_ID,
  fullName: 'Ana Pérez',
  identificationType: 'CEDULA',
  identificationNumber: '1.020.304.050',
  phone: '301 510 6144',
  address: { direccion: 'Cra 74 # 89-95', ciudad: 'Envigado', municipio: 'Medellín' },
}
// Contact snapshot the resolver derives from CLIENTE.
const CONTACTO = {
  tipoDocumento: 'CC',
  direccion: 'Cra 74 # 89-95',
  ciudad: 'Envigado',
  telefono: '301 510 6144',
}

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

    expect(res).toEqual({
      ok: true,
      contraparte: { id: 'ccontra00001', nombre: 'Ana Pérez', documento: '1.020.304.050', ...CONTACTO },
    })
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
      contraparte: { id: 'ccontra00002', nombre: 'Ana Pérez', documento: '1.020.304.050', ...CONTACTO },
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

    expect(res).toEqual({
      ok: true,
      contraparte: { id: 'ccontra00003', nombre: 'Ana Pérez', documento: '1.020.304.050', ...CONTACTO },
    })
    expect(tx.contraparte.create).toHaveBeenCalledWith({
      data: {
        nombre: 'Ana Pérez',
        tipo: 'CLIENTE',
        documento: '1020304050',
        clientId: CLIENT_ID,
        createdById: USER_ID,
      },
      select: { id: true },
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

  it('crea la contraparte sin documento pero el recibo lleva el del cliente', async () => {
    tx.client.findFirst.mockResolvedValue({ ...CLIENTE, identificationNumber: 'PA-12' })
    tx.contraparte.create.mockResolvedValue({ id: 'c5' })

    const res = await resolverContraparteDeCliente(txCliente, CLIENT_ID, USER_ID)

    expect(res).toEqual({
      ok: true,
      contraparte: { id: 'c5', nombre: 'Ana Pérez', documento: 'PA-12', ...CONTACTO },
    })
    expect(tx.contraparte.findUnique).toHaveBeenCalledTimes(1)
    expect(tx.contraparte.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ documento: null }) })
    )
  })

  it('usa el municipio como ciudad si el cliente no tiene ciudad', async () => {
    tx.client.findFirst.mockResolvedValue({
      ...CLIENTE,
      address: { direccion: 'Cra 1', ciudad: null, municipio: 'Bello' },
    })
    tx.contraparte.findUnique.mockResolvedValueOnce({ id: 'c6', nombre: 'x', documento: null })

    const res = await resolverContraparteDeCliente(txCliente, CLIENT_ID, USER_ID)

    expect(res.ok && res.contraparte).toMatchObject({ direccion: 'Cra 1', ciudad: 'Bello' })
  })

  it('devuelve null en el contacto que el CRM no tiene', async () => {
    tx.client.findFirst.mockResolvedValue({ ...CLIENTE, phone: '  ', address: null })
    tx.contraparte.findUnique.mockResolvedValueOnce({ id: 'c7', nombre: 'x', documento: null })

    const res = await resolverContraparteDeCliente(txCliente, CLIENT_ID, USER_ID)

    expect(res.ok && res.contraparte).toMatchObject({
      tipoDocumento: 'CC',
      direccion: null,
      ciudad: null,
      telefono: null,
    })
  })
})
