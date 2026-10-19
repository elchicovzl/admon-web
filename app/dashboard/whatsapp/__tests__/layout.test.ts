import { beforeEach, describe, expect, it, vi } from 'vitest'

const { hasWhatsAppAccessMock, redirectMock } = vi.hoisted(() => ({
  hasWhatsAppAccessMock: vi.fn(),
  redirectMock: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  }),
}))

vi.mock('@/lib/auth/rbac', () => ({ hasWhatsAppAccess: hasWhatsAppAccessMock }))
vi.mock('next/navigation', () => ({ redirect: redirectMock }))

import WhatsAppLayout from '../layout'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('/dashboard/whatsapp layout guard', () => {
  it('renders the children for a user with access (SUPER_ADMIN or permitted MANAGER)', async () => {
    hasWhatsAppAccessMock.mockResolvedValue(true)

    const out = await WhatsAppLayout({ children: 'inbox' })

    expect(redirectMock).not.toHaveBeenCalled()
    expect(out).toBeTruthy()
  })

  it('redirects a non-permitted user even if the middleware JWT gate was stale', async () => {
    hasWhatsAppAccessMock.mockResolvedValue(false)

    await expect(WhatsAppLayout({ children: 'inbox' })).rejects.toThrow(
      'NEXT_REDIRECT:/dashboard?error=unauthorized'
    )
  })
})
