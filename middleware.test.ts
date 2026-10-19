/**
 * middleware.test.ts
 *
 * Route gating for /dashboard/whatsapp, mirroring the Control gate. The
 * middleware reads the JWT-backed session (cheap gate); the layout and server
 * actions re-check against the database.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { UserRole } from '@prisma/client'

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }))

vi.mock('@/lib/auth/auth', () => ({ auth: authMock }))

import middleware from './middleware'

function session(role: UserRole, flags: { control?: boolean; whatsapp?: boolean } = {}) {
  return {
    user: {
      id: 'u1',
      role,
      canAccessControl: flags.control ?? false,
      canAccessWhatsApp: flags.whatsapp ?? false,
    },
    expires: new Date(Date.now() + 3_600_000).toISOString(),
  }
}

async function run(pathname: string) {
  return middleware(new NextRequest(`http://localhost${pathname}`))
}

function redirectTarget(res: Response): string | null {
  return res.headers.get('location')
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('middleware: /dashboard/whatsapp', () => {
  it('lets SUPER_ADMIN through without the flag', async () => {
    authMock.mockResolvedValue(session(UserRole.SUPER_ADMIN))

    const res = await run('/dashboard/whatsapp')

    expect(redirectTarget(res)).toBeNull()
  })

  it('lets a permitted MANAGER through', async () => {
    authMock.mockResolvedValue(session(UserRole.MANAGER, { whatsapp: true }))

    const res = await run('/dashboard/whatsapp')

    expect(redirectTarget(res)).toBeNull()
  })

  it('applies to nested WhatsApp routes', async () => {
    authMock.mockResolvedValue(session(UserRole.MANAGER, { whatsapp: false }))

    const res = await run('/dashboard/whatsapp/leads')

    expect(redirectTarget(res)).toContain('/dashboard?error=unauthorized')
  })

  it('redirects a non-permitted MANAGER to the dashboard with an error', async () => {
    authMock.mockResolvedValue(session(UserRole.MANAGER, { whatsapp: false }))

    const res = await run('/dashboard/whatsapp')

    expect(res.status).toBe(307)
    expect(redirectTarget(res)).toBe('http://localhost/dashboard?error=unauthorized')
  })

  it('does not let Control access stand in for WhatsApp access', async () => {
    authMock.mockResolvedValue(session(UserRole.MANAGER, { control: true }))

    const res = await run('/dashboard/whatsapp')

    expect(redirectTarget(res)).toContain('error=unauthorized')
  })

  it('redirects an anonymous visitor to login', async () => {
    authMock.mockResolvedValue(null)

    const res = await run('/dashboard/whatsapp')

    expect(redirectTarget(res)).toContain('/login')
  })

  it('does not gate other dashboard pages on the WhatsApp flag', async () => {
    authMock.mockResolvedValue(session(UserRole.MANAGER, { whatsapp: false }))

    const res = await run('/dashboard/clients')

    expect(redirectTarget(res)).toBeNull()
  })

  it('keeps gating Control independently of WhatsApp', async () => {
    authMock.mockResolvedValue(session(UserRole.MANAGER, { whatsapp: true }))

    const res = await run('/dashboard/control')

    expect(redirectTarget(res)).toContain('error=unauthorized')
  })
})
