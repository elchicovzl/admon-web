import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UserRole } from '@prisma/client'

const { prismaMock, authMock, hasWhatsAppAccessMock, presignGetMock, outboundMock } = vi.hoisted(() => ({
  prismaMock: {
    whatsAppMedia: { findUnique: vi.fn() },
    conversation: { findMany: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
    whatsAppMessage: { findMany: vi.fn() },
  },
  authMock: vi.fn(),
  hasWhatsAppAccessMock: vi.fn(),
  presignGetMock: vi.fn(),
  outboundMock: { sendReplyMessage: vi.fn(), sendTemplateMessage: vi.fn(), resendMessage: vi.fn() },
}))

vi.mock('@/lib/db/prisma', () => ({ default: prismaMock }))
vi.mock('@/lib/auth/auth', () => ({ auth: authMock }))
vi.mock('@/lib/auth/rbac', () => ({ hasWhatsAppAccess: hasWhatsAppAccessMock }))
vi.mock('@/lib/storage/r2', () => ({ presignGet: presignGetMock }))
vi.mock('@/lib/whatsapp/outbound', () => outboundMock)

import {
  getConversationThread,
  getMediaUrl,
  getUpdates,
  listConversations,
  markConversationRead,
  resendFailedMessage,
  sendReply,
  sendTemplate,
} from '../whatsapp.actions'

const MESSAGE_ID = 'cjld2cjxh0000qzrmn831i7rn'

function stored(overrides: Record<string, unknown> = {}) {
  return {
    status: 'STORED',
    s3Key: 'whatsapp/conv-1/msg-1/META123.jpg',
    mimeType: 'image/jpeg',
    fileName: null,
    r2DeletedAt: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  authMock.mockResolvedValue({ user: { id: 'u1', role: UserRole.MANAGER } })
  hasWhatsAppAccessMock.mockResolvedValue(true)
  prismaMock.whatsAppMedia.findUnique.mockResolvedValue(stored())
  presignGetMock.mockResolvedValue('https://signed.example/object')
})

describe('getMediaUrl: authorization (S-MH-8, MH-2)', () => {
  it('rejects unauthenticated callers without touching the DB or R2', async () => {
    authMock.mockResolvedValue(null)

    const r = await getMediaUrl({ messageId: MESSAGE_ID })

    expect(r).toEqual({ success: false, error: 'No autenticado' })
    expect(prismaMock.whatsAppMedia.findUnique).not.toHaveBeenCalled()
    expect(presignGetMock).not.toHaveBeenCalled()
  })

  it('denies a MANAGER without WhatsApp access', async () => {
    hasWhatsAppAccessMock.mockResolvedValue(false)

    const r = await getMediaUrl({ messageId: MESSAGE_ID })

    expect(r).toEqual({ success: false, error: 'No tienes acceso al módulo de WhatsApp' })
    expect(prismaMock.whatsAppMedia.findUnique).not.toHaveBeenCalled()
    expect(presignGetMock).not.toHaveBeenCalled()
  })

  it('allows a MANAGER with WhatsApp access', async () => {
    authMock.mockResolvedValue({ user: { id: 'u1', role: UserRole.MANAGER } })
    hasWhatsAppAccessMock.mockResolvedValue(true)

    const r = await getMediaUrl({ messageId: MESSAGE_ID })

    expect(r.success).toBe(true)
  })

  it('allows SUPER_ADMIN (hasWhatsAppAccess grants it by role)', async () => {
    authMock.mockResolvedValue({ user: { id: 'u9', role: UserRole.SUPER_ADMIN } })
    hasWhatsAppAccessMock.mockResolvedValue(true)

    const r = await getMediaUrl({ messageId: MESSAGE_ID })

    expect(r.success).toBe(true)
  })

  it('does not trust a session claim: the database check decides', async () => {
    authMock.mockResolvedValue({
      user: { id: 'u1', role: UserRole.MANAGER, canAccessWhatsApp: true },
    })
    hasWhatsAppAccessMock.mockResolvedValue(false)

    const r = await getMediaUrl({ messageId: MESSAGE_ID })

    expect(r.success).toBe(false)
    expect(hasWhatsAppAccessMock).toHaveBeenCalled()
  })
})

describe('getMediaUrl: behavior', () => {
  it('returns a 10-minute presigned URL and never the R2 key', async () => {
    const r = await getMediaUrl({ messageId: MESSAGE_ID })

    expect(presignGetMock).toHaveBeenCalledWith('whatsapp/conv-1/msg-1/META123.jpg', {
      expiresInSeconds: 600,
      contentType: 'image/jpeg',
      fileName: undefined,
      disposition: 'inline',
    })
    expect(r).toEqual({
      success: true,
      data: { url: 'https://signed.example/object', mimeType: 'image/jpeg', fileName: null, expiresInSeconds: 600 },
    })
    expect(JSON.stringify(r)).not.toContain('whatsapp/conv-1')
  })

  it('serves non-renderable types as downloads', async () => {
    prismaMock.whatsAppMedia.findUnique.mockResolvedValue(
      stored({ mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', fileName: 'carta.docx' })
    )

    await getMediaUrl({ messageId: MESSAGE_ID })

    expect(presignGetMock.mock.calls[0][1]).toMatchObject({ disposition: 'attachment', fileName: 'carta.docx' })
  })

  it.each([
    ['PENDING', 'El archivo aún se está descargando'],
    ['FAILED', 'El archivo no está disponible'],
    ['TOO_LARGE', 'El archivo no está disponible'],
    ['UNSUPPORTED', 'El archivo no está disponible'],
  ])('refuses a %s file', async (status, error) => {
    prismaMock.whatsAppMedia.findUnique.mockResolvedValue(stored({ status, s3Key: null }))

    await expect(getMediaUrl({ messageId: MESSAGE_ID })).resolves.toEqual({ success: false, error })
    expect(presignGetMock).not.toHaveBeenCalled()
  })

  it('refuses a file already purged from R2', async () => {
    prismaMock.whatsAppMedia.findUnique.mockResolvedValue(stored({ r2DeletedAt: new Date() }))

    const r = await getMediaUrl({ messageId: MESSAGE_ID })

    expect(r.success).toBe(false)
    expect(presignGetMock).not.toHaveBeenCalled()
  })

  it('reports an unknown message', async () => {
    prismaMock.whatsAppMedia.findUnique.mockResolvedValue(null)

    await expect(getMediaUrl({ messageId: MESSAGE_ID })).resolves.toEqual({ success: false, error: 'Archivo no encontrado' })
  })

  it('rejects malformed ids with Zod before querying', async () => {
    const r = await getMediaUrl({ messageId: "x'; DROP TABLE" })

    expect(r).toEqual({ success: false, error: 'Mensaje inválido' })
    expect(prismaMock.whatsAppMedia.findUnique).not.toHaveBeenCalled()
  })

  it('fails closed without leaking storage errors', async () => {
    presignGetMock.mockRejectedValue(new Error('R2 credentials not configured: acct-123'))

    const r = await getMediaUrl({ messageId: MESSAGE_ID })

    expect(r).toEqual({ success: false, error: 'No se pudo obtener el archivo' })
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('acct-123')
  })
})


// ---------------------------------------------------------------- inbox reads (PR2.2)

const CONV_ID = 'cjld2cjxh0000qzrmn831i7rn'
const CONV_ID_2 = 'cjld2cjxh0001qzrmn831i7rn'

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: CONV_ID,
    status: 'HUMAN',
    aiPaused: false,
    unreadCount: 1,
    lastMessagePreview: 'hola',
    lastMessageAt: new Date('2026-10-19T12:00:00Z'),
    lastInboundAt: new Date('2026-10-19T12:00:00Z'),
    escalatedAt: null,
    attentionDueAt: null,
    escalatedOutOfHours: false,
    updatedAt: new Date('2026-10-19T12:00:00Z'),
    takenOverBy: null,
    contact: {
      waId: '573001112233',
      profileName: 'Ana',
      matchStatus: 'UNMATCHED',
      client: null,
      lead: { status: 'NEW' },
    },
    ...overrides,
  }
}

function messageRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'm1',
    direction: 'IN',
    source: 'CLIENT',
    type: 'TEXT',
    text: 'hola',
    templateName: null,
    status: 'RECEIVED',
    errorCode: null,
    errorMessage: null,
    timestamp: new Date('2026-10-19T12:00:00Z'),
    updatedAt: new Date('2026-10-19T12:00:00Z'),
    sentBy: null,
    media: null,
    ...overrides,
  }
}

describe('inbox reads: authorization (WI-1, WI-11)', () => {
  const calls: [string, () => Promise<unknown>][] = [
    ['listConversations', () => listConversations({})],
    ['getConversationThread', () => getConversationThread({ conversationId: CONV_ID })],
    ['getUpdates', () => getUpdates({ updatedSince: '2026-10-19T12:00:00.000Z' })],
    ['markConversationRead', () => markConversationRead({ conversationId: CONV_ID })],
  ]

  it.each(calls)('%s rejects unauthenticated callers before touching the DB', async (_name, call) => {
    authMock.mockResolvedValue(null)
    expect(await call()).toEqual({ success: false, error: 'No autenticado' })
    expect(prismaMock.conversation.findMany).not.toHaveBeenCalled()
    expect(prismaMock.conversation.findUnique).not.toHaveBeenCalled()
    expect(prismaMock.conversation.updateMany).not.toHaveBeenCalled()
    expect(prismaMock.whatsAppMessage.findMany).not.toHaveBeenCalled()
  })

  it.each(calls)('%s denies a MANAGER without WhatsApp access', async (_name, call) => {
    hasWhatsAppAccessMock.mockResolvedValue(false)
    expect(await call()).toEqual({ success: false, error: 'No tienes acceso al módulo de WhatsApp' })
    expect(prismaMock.conversation.findMany).not.toHaveBeenCalled()
    expect(prismaMock.conversation.findUnique).not.toHaveBeenCalled()
    expect(prismaMock.conversation.updateMany).not.toHaveBeenCalled()
    expect(prismaMock.whatsAppMessage.findMany).not.toHaveBeenCalled()
  })
})

describe('listConversations', () => {
  beforeEach(() => {
    prismaMock.conversation.findMany.mockResolvedValue([])
  })

  it('returns the same shared list to two different permitted users (WI-2)', async () => {
    prismaMock.conversation.findMany.mockImplementation(async () => [row()])
    authMock.mockResolvedValue({ user: { id: 'manager-a', role: UserRole.MANAGER } })
    const a = await listConversations({})
    authMock.mockResolvedValue({ user: { id: 'manager-b', role: UserRole.MANAGER } })
    const b = await listConversations({})

    expect(a.success && b.success).toBe(true)
    expect(a.data?.items).toEqual(b.data?.items)
    for (const [args] of prismaMock.conversation.findMany.mock.calls) {
      expect(JSON.stringify(args.where)).not.toContain('manager-')
    }
  })

  it('maps a row to a summary with markers and without internal fields', async () => {
    prismaMock.conversation.findMany.mockImplementation(async (args: { where: { status: unknown } }) =>
      args.where.status === 'ESCALATED' ? [] : [row()]
    )
    const r = await listConversations({})

    expect(r.data?.items[0]).toMatchObject({
      id: CONV_ID,
      displayName: 'Ana',
      phone: '+573001112233',
      markers: ['NO_CLIENT', 'LEAD'],
      lastMessageAt: '2026-10-19T12:00:00.000Z',
    })
  })

  it('puts escalated rows first, by attention order (WI-12), and pages the rest', async () => {
    prismaMock.conversation.findMany.mockImplementation(async (args: { where: { status: unknown } }) =>
      args.where.status === 'ESCALATED'
        ? [
            row({ id: CONV_ID_2, status: 'ESCALATED', attentionDueAt: new Date('2026-10-20T13:00:00Z') }),
          ]
        : [
            row({ id: 'c1', lastMessageAt: new Date('2026-10-19T14:00:00Z') }),
            row({ id: 'c2', lastMessageAt: new Date('2026-10-19T13:00:00Z') }),
            row({ id: 'c3', lastMessageAt: new Date('2026-10-19T12:00:00Z') }),
          ]
    )
    const r = await listConversations({ limit: 2 })

    expect(r.data?.items.map((i) => i.id)).toEqual([CONV_ID_2, 'c1', 'c2'])
    expect(r.data?.nextCursor).toBe('c2')
  })

  it('a cursor page skips the escalated query; an ESCALATED filter skips the others', async () => {
    await listConversations({ cursor: CONV_ID })
    expect(prismaMock.conversation.findMany).toHaveBeenCalledTimes(1)
    expect(prismaMock.conversation.findMany.mock.calls[0][0]).toMatchObject({
      cursor: { id: CONV_ID },
      skip: 1,
      where: { status: { not: 'ESCALATED' } },
    })

    prismaMock.conversation.findMany.mockClear()
    await listConversations({ state: 'ESCALATED' })
    expect(prismaMock.conversation.findMany).toHaveBeenCalledTimes(1)
    expect(prismaMock.conversation.findMany.mock.calls[0][0].where).toEqual({ status: 'ESCALATED' })
  })

  it('filters by state', async () => {
    await listConversations({ state: 'CLOSED' })
    expect(prismaMock.conversation.findMany).toHaveBeenCalledTimes(1)
    expect(prismaMock.conversation.findMany.mock.calls[0][0].where).toEqual({ status: 'CLOSED' })
  })

  it.each([
    [{ state: 'BOGUS' }],
    [{ limit: 0 }],
    [{ limit: 101 }],
    [{ limit: 1.5 }],
    [{ cursor: 'not-a-cuid' }],
  ])('rejects invalid input %j', async (input) => {
    const r = await listConversations(input as never)
    expect(r.success).toBe(false)
    expect(prismaMock.conversation.findMany).not.toHaveBeenCalled()
  })

  it('returns a generic error without leaking the cause', async () => {
    prismaMock.conversation.findMany.mockRejectedValue(new Error('connection string postgres://secret'))
    const r = await listConversations({})
    expect(r).toEqual({ success: false, error: 'No se pudo completar la operación' })
  })
})

describe('getConversationThread', () => {
  it('returns messages oldest first, with hasMore, and never selects the storage key', async () => {
    prismaMock.conversation.findUnique.mockResolvedValue(row())
    prismaMock.whatsAppMessage.findMany.mockResolvedValue([
      messageRow({ id: 'm3', timestamp: new Date('2026-10-19T12:03:00Z') }),
      messageRow({ id: 'm2', timestamp: new Date('2026-10-19T12:02:00Z') }),
      messageRow({ id: 'm1', timestamp: new Date('2026-10-19T12:01:00Z') }),
    ])
    const r = await getConversationThread({ conversationId: CONV_ID, limit: 2 })

    expect(r.data?.messages.map((m) => m.id)).toEqual(['m2', 'm3'])
    expect(r.data?.hasMore).toBe(true)
    const select = prismaMock.whatsAppMessage.findMany.mock.calls[0][0].select
    expect(select.media.select).not.toHaveProperty('s3Key')
    expect(JSON.stringify(r)).not.toContain('s3Key')
  })

  it('pages older history with a composite (timestamp, id) cursor', async () => {
    prismaMock.conversation.findUnique.mockResolvedValue(row())
    prismaMock.whatsAppMessage.findMany.mockResolvedValue([])
    await getConversationThread({
      conversationId: CONV_ID,
      before: { timestamp: '2026-10-19T12:00:00.000Z', id: MESSAGE_ID },
    })
    const query = prismaMock.whatsAppMessage.findMany.mock.calls[0][0]
    expect(query.where).toEqual({
      conversationId: CONV_ID,
      OR: [
        { timestamp: { lt: new Date('2026-10-19T12:00:00.000Z') } },
        { timestamp: new Date('2026-10-19T12:00:00.000Z'), id: { lt: MESSAGE_ID } },
      ],
    })
    expect(query.orderBy).toEqual([{ timestamp: 'desc' }, { id: 'desc' }])
  })

  it('exposes the failure code of a FAILED message so the UI can ask before resending', async () => {
    prismaMock.conversation.findUnique.mockResolvedValue(row())
    prismaMock.whatsAppMessage.findMany.mockResolvedValue([
      messageRow({ direction: 'OUT', status: 'FAILED', errorCode: 'UNKNOWN_DELIVERY', errorMessage: 'No se pudo confirmar' }),
    ])
    const r = await getConversationThread({ conversationId: CONV_ID })
    expect(r.data?.messages[0]).toMatchObject({ errorCode: 'UNKNOWN_DELIVERY', status: 'FAILED' })
    expect(prismaMock.whatsAppMessage.findMany.mock.calls[0][0].select.errorCode).toBe(true)
  })

  it('rejects a timestamp-only or malformed cursor before querying', async () => {
    const bad = [
      '2026-10-19T12:00:00.000Z',
      { timestamp: '2026-10-19T12:00:00.000Z' },
      { timestamp: 'yesterday', id: MESSAGE_ID },
      { timestamp: '2026-10-19T12:00:00.000Z', id: 'x' },
    ]
    for (const before of bad) {
      const r = await getConversationThread({ conversationId: CONV_ID, before: before as never })
      expect(r.success).toBe(false)
    }
    expect(prismaMock.conversation.findUnique).not.toHaveBeenCalled()
  })

  it('does not skip same-timestamp messages that straddle a page boundary', async () => {
    // Five messages share one timestamp: the case a timestamp-only cursor loses data in.
    const sameSecond = new Date('2026-10-19T12:00:00.000Z')
    const ids = ['cm00000000000000000000001', 'cm00000000000000000000002', 'cm00000000000000000000003', 'cm00000000000000000000004', 'cm00000000000000000000005']
    const all = ids.map((id) => messageRow({ id, timestamp: sameSecond }))

    prismaMock.conversation.findUnique.mockResolvedValue(row())
    // Minimal in-memory evaluation of the cursor filter and the (timestamp desc, id desc) order.
    prismaMock.whatsAppMessage.findMany.mockImplementation(async (args: { where: { OR?: Array<Record<string, unknown>> }; take: number }) => {
      const clauses = args.where.OR
      const visible = all.filter((m) => {
        if (!clauses) return true
        return clauses.some((clause) => {
          const ts = clause.timestamp as Date | { lt: Date }
          if (ts instanceof Date) return m.timestamp.getTime() === ts.getTime() && m.id < (clause.id as { lt: string }).lt
          return m.timestamp.getTime() < ts.lt.getTime()
        })
      })
      return visible.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime() || (a.id < b.id ? 1 : -1)).slice(0, args.take)
    })

    const seen: string[] = []
    let before: { timestamp: string; id: string } | undefined
    for (let page = 0; page < 5; page++) {
      const r = await getConversationThread({ conversationId: CONV_ID, limit: 2, ...(before ? { before } : {}) })
      const messages = r.data!.messages
      seen.unshift(...messages.map((m) => m.id))
      if (!r.data!.hasMore) break
      before = { timestamp: messages[0].timestamp, id: messages[0].id }
    }

    expect(seen).toEqual(ids)
  })

  it('reports a missing conversation and rejects bad ids', async () => {
    prismaMock.conversation.findUnique.mockResolvedValue(null)
    prismaMock.whatsAppMessage.findMany.mockResolvedValue([])
    expect(await getConversationThread({ conversationId: CONV_ID })).toEqual({
      success: false,
      error: 'Conversación no encontrada',
    })
    prismaMock.conversation.findUnique.mockClear()
    expect((await getConversationThread({ conversationId: 'x' })).success).toBe(false)
    expect(prismaMock.conversation.findUnique).not.toHaveBeenCalled()
  })
})

describe('getUpdates (WI-5)', () => {
  beforeEach(() => {
    prismaMock.conversation.findMany.mockResolvedValue([row()])
    prismaMock.whatsAppMessage.findMany.mockResolvedValue([messageRow()])
  })

  it('queries by updatedAt with a small overlap and returns a fresh server cursor', async () => {
    const r = await getUpdates({ updatedSince: '2026-10-19T12:00:00.000Z', conversationId: CONV_ID })

    expect(prismaMock.conversation.findMany.mock.calls[0][0].where).toEqual({
      updatedAt: { gt: new Date('2026-10-19T11:59:55.000Z') },
    })
    expect(prismaMock.whatsAppMessage.findMany.mock.calls[0][0].where).toEqual({
      conversationId: CONV_ID,
      updatedAt: { gt: new Date('2026-10-19T11:59:55.000Z') },
    })
    expect(r.data?.conversations).toHaveLength(1)
    expect(r.data?.messages).toHaveLength(1)
    expect(r.data?.truncated).toBe(false)
    expect(Number.isNaN(Date.parse(r.data?.cursor ?? ''))).toBe(false)
  })

  it('skips the message query when no thread is open', async () => {
    const r = await getUpdates({ updatedSince: '2026-10-19T12:00:00.000Z' })
    expect(prismaMock.whatsAppMessage.findMany).not.toHaveBeenCalled()
    expect(r.data?.messages).toEqual([])
  })

  it('flags truncation when the safety cap is hit', async () => {
    prismaMock.conversation.findMany.mockResolvedValue(Array.from({ length: 201 }, (_, i) => row({ id: `c${i}` })))
    const r = await getUpdates({ updatedSince: '2026-10-19T12:00:00.000Z' })
    expect(r.data?.truncated).toBe(true)
    expect(r.data?.conversations).toHaveLength(200)
  })

  it.each([[{ updatedSince: 'yesterday' }], [{ updatedSince: '2026-10-19T12:00:00.000Z', conversationId: 'x' }], [{}]])(
    'rejects invalid input %j',
    async (input) => {
      expect((await getUpdates(input as never)).success).toBe(false)
      expect(prismaMock.conversation.findMany).not.toHaveBeenCalled()
    }
  )
})

describe('markConversationRead', () => {
  it('only clears unreadCount of that conversation', async () => {
    prismaMock.conversation.updateMany.mockResolvedValue({ count: 1 })
    const r = await markConversationRead({ conversationId: CONV_ID })

    expect(r).toEqual({ success: true, data: { updated: 1 } })
    expect(prismaMock.conversation.updateMany).toHaveBeenCalledWith({
      where: { id: CONV_ID, unreadCount: { gt: 0 } },
      data: { unreadCount: 0 },
    })
  })

  it('rejects a bad id', async () => {
    expect((await markConversationRead({ conversationId: 'x' })).success).toBe(false)
    expect(prismaMock.conversation.updateMany).not.toHaveBeenCalled()
  })
})

describe('sending actions (PR2.3)', () => {
  const SENT = { success: true, data: { messageId: 'msg-1' } }

  beforeEach(() => {
    outboundMock.sendReplyMessage.mockResolvedValue(SENT)
    outboundMock.sendTemplateMessage.mockResolvedValue(SENT)
    outboundMock.resendMessage.mockResolvedValue(SENT)
  })

  const calls: [string, () => Promise<unknown>][] = [
    ['sendReply', () => sendReply({ conversationId: CONV_ID, text: 'Hola' })],
    ['sendTemplate', () => sendTemplate({ conversationId: CONV_ID, templateKey: 'RESUME', params: ['Ana'] })],
    ['resendFailedMessage', () => resendFailedMessage({ messageId: MESSAGE_ID })],
  ]

  it.each(calls)('%s rejects unauthenticated callers before any work', async (_name, call) => {
    authMock.mockResolvedValue(null)
    expect(await call()).toEqual({ success: false, error: 'No autenticado' })
    expect(outboundMock.sendReplyMessage).not.toHaveBeenCalled()
    expect(outboundMock.sendTemplateMessage).not.toHaveBeenCalled()
    expect(outboundMock.resendMessage).not.toHaveBeenCalled()
  })

  it.each(calls)('%s denies a MANAGER without WhatsApp access', async (_name, call) => {
    hasWhatsAppAccessMock.mockResolvedValue(false)
    expect(await call()).toEqual({ success: false, error: 'No tienes acceso al módulo de WhatsApp' })
    expect(outboundMock.sendReplyMessage).not.toHaveBeenCalled()
    expect(outboundMock.sendTemplateMessage).not.toHaveBeenCalled()
    expect(outboundMock.resendMessage).not.toHaveBeenCalled()
  })

  describe('sendReply', () => {
    it('passes the authenticated user, never one supplied by the caller', async () => {
      const r = await sendReply({ conversationId: CONV_ID, text: '  Hola  ', userId: 'attacker' } as never)

      expect(r).toEqual(SENT)
      expect(outboundMock.sendReplyMessage).toHaveBeenCalledWith({ conversationId: CONV_ID, text: 'Hola', userId: 'u1' })
    })

    it.each([
      [{ conversationId: CONV_ID, text: '   ' }, 'El mensaje es requerido'],
      [{ conversationId: CONV_ID, text: 'a'.repeat(4097) }, 'El mensaje no puede superar 4096 caracteres'],
      [{ conversationId: 'x', text: 'Hola' }, 'Conversación inválida'],
      [{ text: 'Hola' }, 'La conversación es requerida'],
    ])('rejects invalid input with Zod (%#)', async (input, error) => {
      expect(await sendReply(input as never)).toEqual({ success: false, error })
      expect(outboundMock.sendReplyMessage).not.toHaveBeenCalled()
    })

    it('returns the service error untouched (window closed, CLOSED, flag off...)', async () => {
      outboundMock.sendReplyMessage.mockResolvedValue({ success: false, error: 'La conversación está cerrada. Reábrala antes de responder.' })
      expect(await sendReply({ conversationId: CONV_ID, text: 'Hola' })).toEqual({
        success: false,
        error: 'La conversación está cerrada. Reábrala antes de responder.',
      })
    })

    it('turns an unexpected throw into a generic Spanish error', async () => {
      outboundMock.sendReplyMessage.mockRejectedValue(new Error('postgres://secret'))
      expect(await sendReply({ conversationId: CONV_ID, text: 'Hola' })).toEqual({
        success: false,
        error: 'No se pudo completar la operación',
      })
    })
  })

  describe('sendTemplate', () => {
    it('forwards only registry keys with their variables', async () => {
      await sendTemplate({ conversationId: CONV_ID, templateKey: 'PROCESS_UPDATE', params: ['Ana', 'A-1'] })
      expect(outboundMock.sendTemplateMessage).toHaveBeenCalledWith({
        conversationId: CONV_ID,
        templateKey: 'PROCESS_UPDATE',
        params: ['Ana', 'A-1'],
        userId: 'u1',
      })
    })

    it.each([
      [{ conversationId: CONV_ID, templateKey: 'resume_conversation', params: ['Ana'] }, 'Plantilla inválida'],
      [{ conversationId: CONV_ID, templateKey: 'RESUME', params: 'Ana' }, 'Datos de plantilla inválidos'],
      [{ conversationId: CONV_ID, templateKey: 'RESUME', params: [1] }, 'Datos de plantilla inválidos'],
      [{ conversationId: CONV_ID, templateKey: 'RESUME' }, 'Los datos de la plantilla son requeridos'],
    ])('rejects invalid input with Zod (%#)', async (input, error) => {
      expect(await sendTemplate(input as never)).toEqual({ success: false, error })
      expect(outboundMock.sendTemplateMessage).not.toHaveBeenCalled()
    })
  })

  describe('resendFailedMessage', () => {
    it('defaults the confirmation to false and passes the user', async () => {
      await resendFailedMessage({ messageId: MESSAGE_ID })
      expect(outboundMock.resendMessage).toHaveBeenCalledWith({
        messageId: MESSAGE_ID,
        confirmUnknownDelivery: false,
        userId: 'u1',
      })
    })

    it('forwards an explicit confirmation', async () => {
      await resendFailedMessage({ messageId: MESSAGE_ID, confirmUnknownDelivery: true })
      expect(outboundMock.resendMessage.mock.calls[0][0].confirmUnknownDelivery).toBe(true)
    })

    it('rejects malformed ids and non-boolean confirmations', async () => {
      expect((await resendFailedMessage({ messageId: 'nope' })).success).toBe(false)
      expect((await resendFailedMessage({ messageId: MESSAGE_ID, confirmUnknownDelivery: 'yes' as never })).success).toBe(false)
      expect(outboundMock.resendMessage).not.toHaveBeenCalled()
    })
  })
})
