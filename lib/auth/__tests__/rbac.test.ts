/**
 * rbac.test.ts
 *
 * Tests for Control module authorization (lib/auth/rbac.ts).
 *
 * The point of these tests is the gap between the SESSION TOKEN and the
 * DATABASE. The session is a JWT with `maxAge: 30 días`, so a token minted
 * before a permission change keeps asserting the old value for up to a month.
 * hasControlAccess() must therefore read the database and ignore the token —
 * the "revoked in DB, still true in token" case below is the one that matters.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UserRole } from '@prisma/client'

// ---------------------------------------------------------------------------
// Hoisted mock objects — must be declared before vi.mock() calls
// ---------------------------------------------------------------------------

const { prismaMock, authMock } = vi.hoisted(() => ({
  prismaMock: { user: { findUnique: vi.fn() } },
  authMock: vi.fn(),
}))

vi.mock('@/lib/db/prisma', () => ({ default: prismaMock }))
vi.mock('@/lib/auth/auth', () => ({ auth: authMock }))

// ---------------------------------------------------------------------------
// Import under test (AFTER vi.mock() so mocks are wired first)
// ---------------------------------------------------------------------------

import { hasControlAccess, requireControlAccess } from '../rbac'

const USER_ID = 'cuseraaaaa0001'

/**
 * A session whose token claims Control access. Every test below uses this same
 * optimistic token, so any `false` result can only come from the database.
 */
const SESSION_CLAIMING_ACCESS = {
  user: {
    id: USER_ID,
    name: 'Ivone',
    email: 'ivone@test.com',
    image: null,
    role: UserRole.MANAGER,
    canAccessControl: true,
  },
  expires: new Date(Date.now() + 3_600_000).toISOString(),
}

/** Row shape returned by the `select` in hasControlAccess(). */
function dbUser(overrides: {
  role?: UserRole
  isActive?: boolean
  canAccessControl?: boolean
}) {
  return {
    role: overrides.role ?? UserRole.MANAGER,
    isActive: overrides.isActive ?? true,
    canAccessControl: overrides.canAccessControl ?? false,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.mockResolvedValue(SESSION_CLAIMING_ACCESS)
})

describe('hasControlAccess', () => {
  it('denies when there is no session', async () => {
    authMock.mockResolvedValue(null)

    await expect(hasControlAccess()).resolves.toBe(false)
    // Should short-circuit before touching the database.
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
  })

  it('denies when the session has no user id', async () => {
    authMock.mockResolvedValue({ user: {}, expires: '' })

    await expect(hasControlAccess()).resolves.toBe(false)
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
  })

  it('denies when the user no longer exists in the database', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)

    await expect(hasControlAccess()).resolves.toBe(false)
  })

  it('grants a MANAGER whose canAccessControl flag is true', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      dbUser({ role: UserRole.MANAGER, canAccessControl: true })
    )

    await expect(hasControlAccess()).resolves.toBe(true)
  })

  it('denies a MANAGER whose canAccessControl flag is false', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      dbUser({ role: UserRole.MANAGER, canAccessControl: false })
    )

    await expect(hasControlAccess()).resolves.toBe(false)
  })

  it('grants SUPER_ADMIN by role, even with the flag off', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      dbUser({ role: UserRole.SUPER_ADMIN, canAccessControl: false })
    )

    await expect(hasControlAccess()).resolves.toBe(true)
  })

  it('denies an inactive user even when the flag is true', async () => {
    // A user deactivated mid-session keeps a valid token until it expires, so
    // isActive has to be re-checked here and not only at login.
    prismaMock.user.findUnique.mockResolvedValue(
      dbUser({ canAccessControl: true, isActive: false })
    )

    await expect(hasControlAccess()).resolves.toBe(false)
  })

  it('denies an inactive SUPER_ADMIN', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      dbUser({ role: UserRole.SUPER_ADMIN, isActive: false })
    )

    await expect(hasControlAccess()).resolves.toBe(false)
  })

  it('honours the database over a stale token that still claims access', async () => {
    // THE case this design exists for: access was revoked in the database, but
    // the 30-day JWT still says canAccessControl: true. The database wins.
    prismaMock.user.findUnique.mockResolvedValue(
      dbUser({ canAccessControl: false })
    )

    await expect(hasControlAccess()).resolves.toBe(false)
    expect(SESSION_CLAIMING_ACCESS.user.canAccessControl).toBe(true)
  })

  it('looks the user up by the session id', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      dbUser({ canAccessControl: true })
    )

    await hasControlAccess()

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: USER_ID },
      select: { role: true, isActive: true, canAccessControl: true },
    })
  })
})

describe('requireControlAccess', () => {
  it('resolves silently when the user is authorized', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      dbUser({ canAccessControl: true })
    )

    await expect(requireControlAccess()).resolves.toBeUndefined()
  })

  it('throws when the user is not authorized', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      dbUser({ canAccessControl: false })
    )

    await expect(requireControlAccess()).rejects.toThrow(
      'Unauthorized: Control module access required'
    )
  })

  it('throws when there is no session', async () => {
    authMock.mockResolvedValue(null)

    await expect(requireControlAccess()).rejects.toThrow('Unauthorized')
  })
})
