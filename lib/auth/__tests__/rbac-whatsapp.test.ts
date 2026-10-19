/**
 * rbac-whatsapp.test.ts
 *
 * Authorization for the WhatsApp module (lib/auth/rbac.ts). Mirrors the Control
 * tests in rbac.test.ts: the database is authoritative, the 30-day JWT is not.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UserRole } from '@prisma/client'

const { prismaMock, authMock } = vi.hoisted(() => ({
  prismaMock: { user: { findUnique: vi.fn() } },
  authMock: vi.fn(),
}))

vi.mock('@/lib/db/prisma', () => ({ default: prismaMock }))
vi.mock('@/lib/auth/auth', () => ({ auth: authMock }))

import { hasWhatsAppAccess, requireWhatsAppAccess } from '../rbac'

const USER_ID = 'cuseraaaaa0001'

/** A token that optimistically claims WhatsApp access: any `false` comes from the DB. */
const SESSION_CLAIMING_ACCESS = {
  user: {
    id: USER_ID,
    name: 'Ivone',
    email: 'ivone@test.com',
    image: null,
    role: UserRole.MANAGER,
    canAccessWhatsApp: true,
  },
  expires: new Date(Date.now() + 3_600_000).toISOString(),
}

function dbUser(overrides: {
  role?: UserRole
  isActive?: boolean
  canAccessWhatsApp?: boolean
}) {
  return {
    role: overrides.role ?? UserRole.MANAGER,
    isActive: overrides.isActive ?? true,
    canAccessWhatsApp: overrides.canAccessWhatsApp ?? false,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.mockResolvedValue(SESSION_CLAIMING_ACCESS)
})

describe('hasWhatsAppAccess', () => {
  it('denies when there is no session, without touching the database', async () => {
    authMock.mockResolvedValue(null)

    await expect(hasWhatsAppAccess()).resolves.toBe(false)
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
  })

  it('denies when the session has no user id', async () => {
    authMock.mockResolvedValue({ user: {}, expires: '' })

    await expect(hasWhatsAppAccess()).resolves.toBe(false)
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
  })

  it('denies when the user no longer exists', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)

    await expect(hasWhatsAppAccess()).resolves.toBe(false)
  })

  it('grants a permitted MANAGER (flag true)', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      dbUser({ role: UserRole.MANAGER, canAccessWhatsApp: true })
    )

    await expect(hasWhatsAppAccess()).resolves.toBe(true)
  })

  it('denies a non-permitted MANAGER (flag false)', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      dbUser({ role: UserRole.MANAGER, canAccessWhatsApp: false })
    )

    await expect(hasWhatsAppAccess()).resolves.toBe(false)
  })

  it('grants SUPER_ADMIN by role, even with the flag off', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      dbUser({ role: UserRole.SUPER_ADMIN, canAccessWhatsApp: false })
    )

    await expect(hasWhatsAppAccess()).resolves.toBe(true)
  })

  it('denies an inactive user even when the flag is true', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      dbUser({ canAccessWhatsApp: true, isActive: false })
    )

    await expect(hasWhatsAppAccess()).resolves.toBe(false)
  })

  it('denies an inactive SUPER_ADMIN', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      dbUser({ role: UserRole.SUPER_ADMIN, isActive: false })
    )

    await expect(hasWhatsAppAccess()).resolves.toBe(false)
  })

  it('honours the database over a stale token that still claims access', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      dbUser({ canAccessWhatsApp: false })
    )

    await expect(hasWhatsAppAccess()).resolves.toBe(false)
    expect(SESSION_CLAIMING_ACCESS.user.canAccessWhatsApp).toBe(true)
  })

  it('looks the user up by the session id and selects only what it needs', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      dbUser({ canAccessWhatsApp: true })
    )

    await hasWhatsAppAccess()

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: USER_ID },
      select: { role: true, isActive: true, canAccessWhatsApp: true },
    })
  })
})

describe('requireWhatsAppAccess', () => {
  it('resolves silently when the user is authorized', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      dbUser({ canAccessWhatsApp: true })
    )

    await expect(requireWhatsAppAccess()).resolves.toBeUndefined()
  })

  it('throws for a non-permitted MANAGER', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      dbUser({ canAccessWhatsApp: false })
    )

    await expect(requireWhatsAppAccess()).rejects.toThrow(
      'Unauthorized: WhatsApp module access required'
    )
  })

  it('throws when there is no session', async () => {
    authMock.mockResolvedValue(null)

    await expect(requireWhatsAppAccess()).rejects.toThrow(
      'Unauthorized: WhatsApp module access required'
    )
  })
})
