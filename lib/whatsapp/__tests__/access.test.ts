import { beforeEach, describe, expect, it, vi } from 'vitest'

const { authMock, hasWhatsAppAccessMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  hasWhatsAppAccessMock: vi.fn(),
}))

vi.mock('@/lib/auth/auth', () => ({ auth: authMock }))
vi.mock('@/lib/auth/rbac', () => ({ hasWhatsAppAccess: hasWhatsAppAccessMock }))

import { requireWhatsAppAuth } from '../access'

beforeEach(() => {
  vi.resetAllMocks()
  authMock.mockResolvedValue({ user: { id: 'u1', role: 'MANAGER', canAccessWhatsApp: true } })
  hasWhatsAppAccessMock.mockResolvedValue(true)
})

describe('requireWhatsAppAuth', () => {
  it('rejects an unauthenticated caller without hitting the database check', async () => {
    authMock.mockResolvedValue(null)

    await expect(requireWhatsAppAuth()).resolves.toEqual({
      authorized: false,
      error: 'No autenticado',
    })
    expect(hasWhatsAppAccessMock).not.toHaveBeenCalled()
  })

  it('authorizes a permitted user and returns the user id', async () => {
    await expect(requireWhatsAppAuth()).resolves.toEqual({ authorized: true, userId: 'u1' })
  })

  it('denies a non-permitted MANAGER, trusting the database over the token claim', async () => {
    // The token says canAccessWhatsApp: true; hasWhatsAppAccess() (DB) says no.
    hasWhatsAppAccessMock.mockResolvedValue(false)

    await expect(requireWhatsAppAuth()).resolves.toEqual({
      authorized: false,
      error: 'No tienes acceso al módulo de WhatsApp',
    })
  })
})
