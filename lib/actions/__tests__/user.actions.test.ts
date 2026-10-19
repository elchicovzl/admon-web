/**
 * user.actions.test.ts
 *
 * The per-user module flags (canAccessControl, canAccessWhatsApp) are set from
 * the SUPER_ADMIN user-management UI through createManager / updateUser. Only
 * SUPER_ADMIN may change them.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UserRole } from '@prisma/client'

const { prismaMock, authMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
  authMock: vi.fn(),
}))

vi.mock('@/lib/db/prisma', () => ({ default: prismaMock }))
vi.mock('@/lib/auth/auth', () => ({ auth: authMock }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('react', () => ({
  cache: <T extends (...args: unknown[]) => unknown>(fn: T): T => fn,
}))
vi.mock('bcryptjs', () => ({ default: { hash: vi.fn() } }))

import { createManager, updateUser } from '../user.actions'

const TARGET_ID = 'cjld2cjxh0000qzrmn831i7rn'

const SUPER_ADMIN_SESSION = { user: { id: 'sa1', role: UserRole.SUPER_ADMIN } }
const MANAGER_SESSION = {
  user: { id: 'm1', role: UserRole.MANAGER, canAccessWhatsApp: true, canAccessControl: true },
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  authMock.mockResolvedValue(SUPER_ADMIN_SESSION)
  prismaMock.user.findUnique.mockResolvedValue({
    id: TARGET_ID,
    email: 'ivone@test.com',
    role: UserRole.MANAGER,
  })
  prismaMock.user.update.mockResolvedValue({ id: TARGET_ID, canAccessWhatsApp: true })
  prismaMock.user.create.mockResolvedValue({ id: TARGET_ID, canAccessWhatsApp: true })
})

describe('updateUser: canAccessWhatsApp toggle', () => {
  it('lets SUPER_ADMIN grant WhatsApp access', async () => {
    const r = await updateUser(TARGET_ID, { canAccessWhatsApp: true })

    expect(r.success).toBe(true)
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TARGET_ID },
        data: { canAccessWhatsApp: true },
        select: expect.objectContaining({ canAccessWhatsApp: true }),
      })
    )
  })

  it('lets SUPER_ADMIN revoke WhatsApp access', async () => {
    await updateUser(TARGET_ID, { canAccessWhatsApp: false })

    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { canAccessWhatsApp: false } })
    )
  })

  it('does not touch the flag when it is not sent', async () => {
    await updateUser(TARGET_ID, { name: 'Ivone Perez' })

    const { data } = prismaMock.user.update.mock.calls[0][0]
    expect(data).toEqual({ name: 'Ivone Perez' })
  })

  it('denies a MANAGER, even one who has WhatsApp access', async () => {
    authMock.mockResolvedValue(MANAGER_SESSION)

    const r = await updateUser(TARGET_ID, { canAccessWhatsApp: true })

    expect(r).toEqual({ success: false, error: 'No tienes permisos para esta acción' })
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('denies an unauthenticated caller', async () => {
    authMock.mockResolvedValue(null)

    const r = await updateUser(TARGET_ID, { canAccessWhatsApp: true })

    expect(r).toEqual({ success: false, error: 'No autenticado' })
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('rejects a non-boolean flag', async () => {
    const r = await updateUser(TARGET_ID, {
      canAccessWhatsApp: 'yes' as unknown as boolean,
    })

    expect(r).toEqual({ success: false, error: 'Datos inválidos' })
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('cannot modify a SUPER_ADMIN', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: TARGET_ID,
      email: 'sa@test.com',
      role: UserRole.SUPER_ADMIN,
    })

    const r = await updateUser(TARGET_ID, { canAccessWhatsApp: false })

    expect(r.success).toBe(false)
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })
})

describe('createManager: canAccessWhatsApp', () => {
  beforeEach(() => {
    // First lookup (duplicate email check) finds nobody.
    prismaMock.user.findUnique.mockResolvedValue(null)
  })

  it('defaults to no WhatsApp access', async () => {
    await createManager({ name: 'Nuevo Manager', email: 'nuevo@test.com' } as never)

    expect(prismaMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ canAccessWhatsApp: false }),
      })
    )
  })

  it('stores an explicit grant', async () => {
    await createManager({
      name: 'Nuevo Manager',
      email: 'nuevo@test.com',
      canAccessWhatsApp: true,
    } as never)

    expect(prismaMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ canAccessWhatsApp: true }),
      })
    )
  })

  it('denies a MANAGER', async () => {
    authMock.mockResolvedValue(MANAGER_SESSION)

    const r = await createManager({
      name: 'Nuevo Manager',
      email: 'nuevo@test.com',
      canAccessWhatsApp: true,
    } as never)

    expect(r.success).toBe(false)
    expect(prismaMock.user.create).not.toHaveBeenCalled()
  })
})
