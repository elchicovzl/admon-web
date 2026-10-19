import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  count: vi.fn(),
  findMany: vi.fn(),
  updateMany: vi.fn(),
  auth: vi.fn(),
  hasAccess: vi.fn(),
}))

vi.mock('@/lib/db/prisma', () => ({
  default: { notification: { count: m.count, findMany: m.findMany, updateMany: m.updateMany } },
}))
vi.mock('@/lib/auth/auth', () => ({ auth: m.auth }))
vi.mock('@/lib/auth/rbac', () => ({ hasWhatsAppAccess: m.hasAccess }))

import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markConversationNotificationsRead,
  markNotificationRead,
} from '../notification.actions'

const CUID = 'cjld2cjxh0000qzrmn831i7rn'
const OTHER_CUID = 'cjld2cjxh0001qzrmn831i7rn'

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  m.auth.mockResolvedValue({ user: { id: 'me' } })
  m.hasAccess.mockResolvedValue(true)
  m.count.mockResolvedValue(3)
  m.findMany.mockResolvedValue([])
  m.updateMany.mockResolvedValue({ count: 1 })
})

const everyAction: Array<[string, () => Promise<{ success: boolean; error?: string }>]> = [
  ['getUnreadNotificationCount', () => getUnreadNotificationCount()],
  ['listNotifications', () => listNotifications()],
  ['markNotificationRead', () => markNotificationRead({ id: CUID })],
  ['markAllNotificationsRead', () => markAllNotificationsRead()],
  ['markConversationNotificationsRead', () => markConversationNotificationsRead({ conversationId: CUID })],
]

describe.each(everyAction)('%s: authorization (S-NT-6, NT-8)', (_name, run) => {
  it('rejects unauthenticated callers without touching the DB', async () => {
    m.auth.mockResolvedValue(null)

    await expect(run()).resolves.toEqual({ success: false, error: 'No autenticado' })
    expect(m.count).not.toHaveBeenCalled()
    expect(m.findMany).not.toHaveBeenCalled()
    expect(m.updateMany).not.toHaveBeenCalled()
  })

  it('rejects a user without WhatsApp access', async () => {
    m.hasAccess.mockResolvedValue(false)

    await expect(run()).resolves.toEqual({ success: false, error: 'No tienes acceso al módulo de WhatsApp' })
    expect(m.count).not.toHaveBeenCalled()
    expect(m.findMany).not.toHaveBeenCalled()
    expect(m.updateMany).not.toHaveBeenCalled()
  })
})

describe('getUnreadNotificationCount', () => {
  it('counts only the caller\'s unread rows', async () => {
    await expect(getUnreadNotificationCount()).resolves.toEqual({ success: true, data: { count: 3 } })
    expect(m.count).toHaveBeenCalledWith({ where: { userId: 'me', readAt: null } })
  })

  it('answers with a generic error when the database fails', async () => {
    m.count.mockRejectedValue(new Error('connection string leaked'))

    await expect(getUnreadNotificationCount()).resolves.toEqual({
      success: false,
      error: 'No se pudo completar la operación',
    })
  })
})

describe('listNotifications', () => {
  const createdAt = new Date('2026-10-19T15:00:00Z')

  it('scopes the query to the caller and returns presentable items with the unread total', async () => {
    m.findMany.mockResolvedValue([
      {
        id: 'n1',
        type: 'ESCALATION',
        conversationId: 'conv-1',
        entityId: null,
        readAt: null,
        createdAt,
        conversation: { contact: { profileName: 'Ana' } },
      },
      {
        id: 'n2',
        type: 'NEW_LEAD',
        conversationId: null,
        entityId: 'lead-1',
        readAt: createdAt,
        createdAt,
        conversation: null,
      },
    ])

    const r = await listNotifications()

    expect(m.findMany.mock.calls[0][0]).toMatchObject({ where: { userId: 'me' }, orderBy: { createdAt: 'desc' }, take: 20 })
    expect(m.count).toHaveBeenCalledWith({ where: { userId: 'me', readAt: null } })
    expect(r.success).toBe(true)
    expect(r.data?.unreadCount).toBe(3)
    expect(r.data?.items[0]).toEqual({
      id: 'n1',
      type: 'ESCALATION',
      title: 'Conversación escalada',
      body: 'Ana necesita atención de un asesor',
      link: '/dashboard/whatsapp?c=conv-1',
      conversationId: 'conv-1',
      entityId: null,
      read: false,
      createdAt: createdAt.toISOString(),
    })
    expect(r.data?.items[1]).toMatchObject({ read: true, body: 'Un cliente escribió por WhatsApp', link: '/dashboard/whatsapp' })
  })

  it('never selects message text or phone numbers', async () => {
    await listNotifications()

    const select = JSON.stringify(m.findMany.mock.calls[0][0].select)
    expect(select).not.toMatch(/waId|text|phone/i)
  })

  it('honours a valid page size and rejects a bad one before the DB', async () => {
    await listNotifications({ limit: 5 })
    expect(m.findMany.mock.calls[0][0].take).toBe(5)

    m.findMany.mockClear()
    for (const limit of [0, 51, 1.5, -1]) {
      const r = await listNotifications({ limit })
      expect(r).toEqual({ success: false, error: 'Límite inválido' })
    }
    expect(m.findMany).not.toHaveBeenCalled()
  })
})

describe('markNotificationRead', () => {
  it('marks one of the caller\'s unread rows and clears its dedup key', async () => {
    const r = await markNotificationRead({ id: CUID })

    expect(r).toEqual({ success: true, data: { updated: 1 } })
    expect(m.updateMany).toHaveBeenCalledWith({
      where: { id: CUID, userId: 'me', readAt: null },
      data: { readAt: expect.any(Date), dedupKey: null },
    })
  })

  it('cannot touch another user\'s row: the write is always scoped to the caller', async () => {
    m.updateMany.mockResolvedValue({ count: 0 })

    const r = await markNotificationRead({ id: OTHER_CUID })

    expect(r).toEqual({ success: true, data: { updated: 0 } })
    expect(m.updateMany.mock.calls[0][0].where.userId).toBe('me')
  })

  it('rejects an id that is not a cuid', async () => {
    await expect(markNotificationRead({ id: "x' OR 1=1" })).resolves.toEqual({
      success: false,
      error: 'Notificación inválida',
    })
    expect(m.updateMany).not.toHaveBeenCalled()
  })
})

describe('markAllNotificationsRead', () => {
  it('clears every unread row of the caller only', async () => {
    m.updateMany.mockResolvedValue({ count: 4 })

    await expect(markAllNotificationsRead()).resolves.toEqual({ success: true, data: { updated: 4 } })
    expect(m.updateMany).toHaveBeenCalledWith({
      where: { userId: 'me', readAt: null },
      data: { readAt: expect.any(Date), dedupKey: null },
    })
  })
})

describe('markConversationNotificationsRead (NT-4)', () => {
  it('clears the caller\'s notifications for that conversation', async () => {
    await markConversationNotificationsRead({ conversationId: CUID })

    expect(m.updateMany).toHaveBeenCalledWith({
      where: { userId: 'me', conversationId: CUID, readAt: null },
      data: { readAt: expect.any(Date), dedupKey: null },
    })
  })

  it('rejects a bad conversation id', async () => {
    await expect(markConversationNotificationsRead({ conversationId: '' })).resolves.toMatchObject({ success: false })
    expect(m.updateMany).not.toHaveBeenCalled()
  })
})
