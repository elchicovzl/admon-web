import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UserRole } from '@prisma/client'

const { prismaMock, authMock, hasWhatsAppAccessMock } = vi.hoisted(() => ({
  prismaMock: { conversation: { findMany: vi.fn() } },
  authMock: vi.fn(),
  hasWhatsAppAccessMock: vi.fn(),
}))

vi.mock('@/lib/db/prisma', () => ({ default: prismaMock }))
vi.mock('@/lib/auth/auth', () => ({ auth: authMock }))
vi.mock('@/lib/auth/rbac', () => ({ hasWhatsAppAccess: hasWhatsAppAccessMock }))
vi.mock('@/lib/storage/r2', () => ({ presignGet: vi.fn() }))
vi.mock('@/lib/whatsapp/outbound', () => ({
  sendReplyMessage: vi.fn(),
  sendTemplateMessage: vi.fn(),
  resendMessage: vi.fn(),
}))

import { getClientConversations } from '../whatsapp.actions'

const CLIENT = 'cjld2cjxh0001qzrmn831i7rn'

function row(id: string, lastMessageAt: string) {
  return {
    id,
    status: 'HUMAN',
    aiPaused: false,
    unreadCount: 2,
    lastMessagePreview: 'Hola',
    lastMessageAt: new Date(lastMessageAt),
    takenOverBy: { name: 'Ana' },
    contact: { waId: '573001234567', profileName: 'Test User' },
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  authMock.mockResolvedValue({ user: { id: 'u1', role: UserRole.MANAGER } })
  hasWhatsAppAccessMock.mockResolvedValue(true)
  prismaMock.conversation.findMany.mockResolvedValue([])
})

describe('getClientConversations (CP-1..CP-4)', () => {
  it('denies a user without WhatsApp access without querying (S-CP-2, CP-4)', async () => {
    hasWhatsAppAccessMock.mockResolvedValue(false)

    expect(await getClientConversations({ clientId: CLIENT })).toEqual({
      success: false,
      error: 'No tienes acceso al módulo de WhatsApp',
    })
    expect(prismaMock.conversation.findMany).not.toHaveBeenCalled()
  })

  it('rejects unauthenticated callers', async () => {
    authMock.mockResolvedValue(null)

    expect(await getClientConversations({ clientId: CLIENT })).toEqual({ success: false, error: 'No autenticado' })
  })

  it("lists the client's conversations newest first, leaving out ones pending purge (S-CP-1, S-CP-4)", async () => {
    prismaMock.conversation.findMany.mockResolvedValue([
      row('conv-new', '2026-10-20T10:00:00Z'),
      row('conv-old', '2026-10-01T10:00:00Z'),
    ])

    const r = await getClientConversations({ clientId: CLIENT })

    const query = prismaMock.conversation.findMany.mock.calls[0][0]
    expect(query.where).toEqual({ contact: { clientId: CLIENT }, purgePendingAt: null })
    expect(query.orderBy).toEqual([{ lastMessageAt: 'desc' }, { id: 'desc' }])
    expect(r.data?.map((item) => item.id)).toEqual(['conv-new', 'conv-old'])
    expect(r.data?.[0]).toEqual({
      id: 'conv-new',
      phone: '+573001234567',
      profileName: 'Test User',
      status: 'HUMAN',
      aiPaused: false,
      unreadCount: 2,
      preview: 'Hola',
      lastMessageAt: '2026-10-20T10:00:00.000Z',
      takenOverByName: 'Ana',
    })
  })

  it('never selects or returns consent data (CP-3)', async () => {
    prismaMock.conversation.findMany.mockResolvedValue([row('conv-1', '2026-10-20T10:00:00Z')])

    const r = await getClientConversations({ clientId: CLIENT })

    const select = prismaMock.conversation.findMany.mock.calls[0][0].select
    expect(Object.keys(select).some((key) => key.toLowerCase().includes('consent'))).toBe(false)
    expect(JSON.stringify(r.data)).not.toMatch(/consent/i)
  })

  it('returns an empty list when the client has no conversations (S-CP-3)', async () => {
    expect(await getClientConversations({ clientId: CLIENT })).toEqual({ success: true, data: [] })
  })

  it('rejects an invalid client id', async () => {
    const r = await getClientConversations({ clientId: 'nope' })

    expect(r.success).toBe(false)
    expect(prismaMock.conversation.findMany).not.toHaveBeenCalled()
  })
})
