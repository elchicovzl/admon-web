import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UserRole } from '@prisma/client'

const { prismaMock, authMock, revalidatePathMock } = vi.hoisted(() => ({
  prismaMock: { configuracionEmpresa: { findUnique: vi.fn(), upsert: vi.fn() } },
  authMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}))

vi.mock('@/lib/db/prisma', () => ({ default: prismaMock }))
vi.mock('@/lib/auth/auth', () => ({ auth: authMock }))
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }))

import {
  getConfiguracionEmpresa,
  updateConfiguracionEmpresa,
} from '../configuracion-empresa.actions'

const input = {
  razonSocial: 'Empresa S.A.S.',
  nit: '900123456-7',
  direccion: 'Calle 1 # 2-3',
  ciudad: 'Bogotá',
  telefono: '3000000000',
  email: 'contacto@example.com',
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

describe('updateConfiguracionEmpresa', () => {
  it('rejects unauthenticated callers', async () => {
    authMock.mockResolvedValue(null)

    const r = await updateConfiguracionEmpresa(input)

    expect(r).toEqual({ success: false, error: 'No autenticado' })
    expect(prismaMock.configuracionEmpresa.upsert).not.toHaveBeenCalled()
  })

  it('rejects a non SUPER_ADMIN user', async () => {
    authMock.mockResolvedValue({ user: { id: 'u1', role: UserRole.MANAGER } })

    const r = await updateConfiguracionEmpresa(input)

    expect(r.success).toBe(false)
    expect(r.error).toBe('No tienes permisos para esta acción')
    expect(prismaMock.configuracionEmpresa.upsert).not.toHaveBeenCalled()
  })

  it('rejects invalid input without touching the database', async () => {
    authMock.mockResolvedValue({ user: { id: 'u1', role: UserRole.SUPER_ADMIN } })

    const r = await updateConfiguracionEmpresa({ ...input, nit: 'abc' })

    expect(r.success).toBe(false)
    expect(prismaMock.configuracionEmpresa.upsert).not.toHaveBeenCalled()
  })

  it('upserts the singleton row and revalidates settings', async () => {
    authMock.mockResolvedValue({ user: { id: 'u1', role: UserRole.SUPER_ADMIN } })
    prismaMock.configuracionEmpresa.upsert.mockResolvedValue({})

    const r = await updateConfiguracionEmpresa(input)

    expect(r.success).toBe(true)
    expect(prismaMock.configuracionEmpresa.upsert).toHaveBeenCalledWith({
      where: { id: 'default' },
      create: { id: 'default', ...input, updatedById: 'u1' },
      update: { ...input, updatedById: 'u1' },
    })
    expect(revalidatePathMock).toHaveBeenCalledWith('/dashboard/settings')
  })
})

describe('getConfiguracionEmpresa', () => {
  it('rejects unauthenticated callers', async () => {
    authMock.mockResolvedValue(null)
    expect((await getConfiguracionEmpresa()).success).toBe(false)
  })

  it('lets any authenticated user read it, null when not configured', async () => {
    authMock.mockResolvedValue({ user: { id: 'u2', role: UserRole.MANAGER } })
    prismaMock.configuracionEmpresa.findUnique.mockResolvedValue(null)

    expect(await getConfiguracionEmpresa()).toEqual({ success: true, data: null })
  })
})
