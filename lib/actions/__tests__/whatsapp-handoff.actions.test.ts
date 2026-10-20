import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UserRole } from '@prisma/client'

const { prismaMock, authMock, hasWhatsAppAccessMock, transitionsMock, contactsMock } = vi.hoisted(() => ({
  prismaMock: {
    conversation: { findUnique: vi.fn(), update: vi.fn() },
  },
  authMock: vi.fn(),
  hasWhatsAppAccessMock: vi.fn(),
  transitionsMock: { applyTransition: vi.fn(), setConversationAiPaused: vi.fn() },
  contactsMock: {
    linkContactToClient: vi.fn(),
    unlinkContactFromClient: vi.fn(),
    confirmContactAsUnknown: vi.fn(),
  },
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
vi.mock('@/lib/whatsapp/transitions', () => transitionsMock)
vi.mock('@/lib/whatsapp/contacts', () => contactsMock)

import {
  closeConversation,
  confirmContactAsUnknown,
  linkContactToClient,
  reopenConversation,
  returnToAi,
  setConversationAiPaused,
  takeConversation,
  unlinkContactFromClient,
} from '../whatsapp.actions'

const CONV = 'cjld2cjxh0000qzrmn831i7rn'
const CLIENT = 'cjld2cjxh0001qzrmn831i7rn'

function row(overrides: { clientId?: string | null; status?: string } = {}) {
  const clientId = overrides.clientId === undefined ? null : overrides.clientId
  return {
    id: CONV,
    contactId: 'contact-1',
    status: overrides.status ?? 'HUMAN',
    aiPaused: false,
    unreadCount: 0,
    lastMessagePreview: 'Hola',
    lastMessageAt: new Date('2026-10-20T10:00:00Z'),
    lastInboundAt: new Date('2026-10-20T10:00:00Z'),
    escalatedAt: null,
    attentionDueAt: null,
    escalatedOutOfHours: false,
    updatedAt: new Date('2026-10-20T10:00:00Z'),
    takenOverBy: { name: 'Ana' },
    contact: {
      waId: '573001234567',
      profileName: 'Test User',
      matchStatus: clientId ? 'MANUAL' : 'AMBIGUOUS',
      clientId,
      client: clientId ? { id: clientId, fullName: 'Cliente Uno' } : null,
      lead: null,
    },
  }
}

const ok = (to = 'HUMAN') => ({
  ok: true,
  from: 'AI',
  to,
  changed: true,
  stateVersion: 2,
  scheduleAiTurn: false,
  notifyActivity: false,
})

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  authMock.mockResolvedValue({ user: { id: 'u1', role: UserRole.MANAGER } })
  hasWhatsAppAccessMock.mockResolvedValue(true)
  prismaMock.conversation.findUnique.mockResolvedValue(row())
  prismaMock.conversation.update.mockResolvedValue({})
  transitionsMock.applyTransition.mockResolvedValue(ok())
  transitionsMock.setConversationAiPaused.mockResolvedValue({ ok: true, changed: true })
  contactsMock.linkContactToClient.mockResolvedValue({ ok: true })
  contactsMock.unlinkContactFromClient.mockResolvedValue({ lead: { id: 'l1' }, created: true })
  contactsMock.confirmContactAsUnknown.mockResolvedValue({ lead: { id: 'l1' }, created: true })
})

const actions = {
  takeConversation: () => takeConversation({ conversationId: CONV }),
  returnToAi: () => returnToAi({ conversationId: CONV }),
  setConversationAiPaused: () => setConversationAiPaused({ conversationId: CONV, paused: true }),
  closeConversation: () => closeConversation({ conversationId: CONV }),
  reopenConversation: () => reopenConversation({ conversationId: CONV, target: 'HUMAN' }),
  linkContactToClient: () => linkContactToClient({ conversationId: CONV, clientId: CLIENT }),
  unlinkContactFromClient: () => unlinkContactFromClient({ conversationId: CONV }),
  confirmContactAsUnknown: () => confirmContactAsUnknown({ conversationId: CONV }),
}

describe('handoff and contact actions: authorization (WI-9)', () => {
  for (const [name, run] of Object.entries(actions)) {
    it(`${name} denies a MANAGER without WhatsApp access and changes nothing`, async () => {
      hasWhatsAppAccessMock.mockResolvedValue(false)

      const r = await run()

      expect(r).toEqual({ success: false, error: 'No tienes acceso al módulo de WhatsApp' })
      expect(transitionsMock.applyTransition).not.toHaveBeenCalled()
      expect(transitionsMock.setConversationAiPaused).not.toHaveBeenCalled()
      for (const fn of Object.values(contactsMock)) expect(fn).not.toHaveBeenCalled()
      expect(prismaMock.conversation.update).not.toHaveBeenCalled()
    })

    it(`${name} returns the generic error instead of throwing when the access check fails`, async () => {
      hasWhatsAppAccessMock.mockRejectedValue(new Error('db down'))

      expect(await run()).toEqual({ success: false, error: 'No se pudo completar la operación' })
    })

    it(`${name} rejects unauthenticated callers`, async () => {
      authMock.mockResolvedValue(null)

      expect(await run()).toEqual({ success: false, error: 'No autenticado' })
    })
  }
})

describe('state actions', () => {
  it('takeConversation applies TAKE as the calling user and returns the fresh summary', async () => {
    const r = await takeConversation({ conversationId: CONV })

    expect(transitionsMock.applyTransition).toHaveBeenCalledWith({
      conversationId: CONV,
      event: 'TAKE',
      actor: 'USER',
      actorUserId: 'u1',
    })
    expect(r.success).toBe(true)
    expect(r.success && r.data).toMatchObject({ id: CONV, status: 'HUMAN', takenOverByName: 'Ana' })
  })

  it('returnToAi records the user who handed it back (CH-6, S-CH-5)', async () => {
    transitionsMock.applyTransition.mockResolvedValue(ok('AI'))

    await returnToAi({ conversationId: CONV })

    expect(transitionsMock.applyTransition).toHaveBeenCalledWith({
      conversationId: CONV,
      event: 'RETURN_TO_AI',
      actor: 'USER',
      actorUserId: 'u1',
    })
  })

  it('closeConversation passes an optional trimmed reason', async () => {
    await closeConversation({ conversationId: CONV, reason: '  Resuelto  ' })

    expect(transitionsMock.applyTransition).toHaveBeenCalledWith({
      conversationId: CONV,
      event: 'CLOSE',
      actor: 'USER',
      actorUserId: 'u1',
      reason: 'Resuelto',
    })
  })

  it('reopenConversation sends the chosen target and rejects any other', async () => {
    await reopenConversation({ conversationId: CONV, target: 'AI' })
    expect(transitionsMock.applyTransition).toHaveBeenCalledWith({
      conversationId: CONV,
      event: 'REOPEN',
      actor: 'USER',
      actorUserId: 'u1',
      target: 'AI',
    })

    transitionsMock.applyTransition.mockClear()
    const bad = await reopenConversation({ conversationId: CONV, target: 'ESCALATED' as 'AI' })
    expect(bad.success).toBe(false)
    expect(transitionsMock.applyTransition).not.toHaveBeenCalled()
  })

  it('setConversationAiPaused forwards the switch with the acting user', async () => {
    const r = await setConversationAiPaused({ conversationId: CONV, paused: true })

    expect(transitionsMock.setConversationAiPaused).toHaveBeenCalledWith({
      conversationId: CONV,
      paused: true,
      actorUserId: 'u1',
    })
    expect(r.success).toBe(true)
  })

  it('maps a rejected transition to a Spanish message', async () => {
    transitionsMock.applyTransition.mockResolvedValue({ ok: false, code: 'INVALID_FROM_STATE', message: 'x' })
    expect(await returnToAi({ conversationId: CONV })).toEqual({
      success: false,
      error: 'Esta acción no está disponible en el estado actual de la conversación',
    })

    transitionsMock.applyTransition.mockResolvedValue({ ok: false, code: 'CONFLICT', message: 'x' })
    expect(await takeConversation({ conversationId: CONV })).toEqual({
      success: false,
      error: 'La conversación cambió mientras tanto. Intente de nuevo.',
    })

    transitionsMock.applyTransition.mockResolvedValue({ ok: false, code: 'NOT_FOUND', message: 'x' })
    expect(await closeConversation({ conversationId: CONV })).toEqual({
      success: false,
      error: 'Conversación no encontrada',
    })
  })

  it('rejects an invalid conversation id before touching anything', async () => {
    const r = await takeConversation({ conversationId: 'nope' })

    expect(r.success).toBe(false)
    expect(transitionsMock.applyTransition).not.toHaveBeenCalled()
  })
})

describe('contact actions (LD-3, LD-5, LD-8)', () => {
  it('linkContactToClient links the conversation contact and bumps the conversation for pollers', async () => {
    const r = await linkContactToClient({ conversationId: CONV, clientId: CLIENT })

    expect(contactsMock.linkContactToClient).toHaveBeenCalledWith('contact-1', CLIENT)
    expect(prismaMock.conversation.update).toHaveBeenCalledWith({
      where: { id: CONV },
      data: { updatedAt: expect.any(Date) },
    })
    expect(r.success).toBe(true)
  })

  it('linkContactToClient reports a client that cannot be linked', async () => {
    contactsMock.linkContactToClient.mockResolvedValue({ ok: false, code: 'CLIENT_NOT_FOUND' })

    expect(await linkContactToClient({ conversationId: CONV, clientId: CLIENT })).toEqual({
      success: false,
      error: 'Cliente no encontrado',
    })
    expect(prismaMock.conversation.update).not.toHaveBeenCalled()
  })

  it('unlinkContactFromClient unlinks a linked contact and keeps the conversation for its lead', async () => {
    prismaMock.conversation.findUnique.mockResolvedValue(row({ clientId: CLIENT }))

    const r = await unlinkContactFromClient({ conversationId: CONV })

    expect(contactsMock.unlinkContactFromClient).toHaveBeenCalledWith('contact-1', CONV)
    expect(prismaMock.conversation.update).toHaveBeenCalled()
    expect(r.success).toBe(true)
  })

  it('unlinkContactFromClient refuses a contact that is not linked', async () => {
    const r = await unlinkContactFromClient({ conversationId: CONV })

    expect(r).toEqual({ success: false, error: 'La conversación no está vinculada a un cliente' })
    expect(contactsMock.unlinkContactFromClient).not.toHaveBeenCalled()
  })

  it('confirmContactAsUnknown creates the lead for an unlinked contact', async () => {
    const r = await confirmContactAsUnknown({ conversationId: CONV })

    expect(contactsMock.confirmContactAsUnknown).toHaveBeenCalledWith('contact-1', CONV)
    expect(r.success).toBe(true)
  })

  it('confirmContactAsUnknown refuses a contact linked to a client', async () => {
    prismaMock.conversation.findUnique.mockResolvedValue(row({ clientId: CLIENT }))

    const r = await confirmContactAsUnknown({ conversationId: CONV })

    expect(r).toEqual({
      success: false,
      error: 'El contacto está vinculado a un cliente. Desvincúlelo primero.',
    })
    expect(contactsMock.confirmContactAsUnknown).not.toHaveBeenCalled()
  })

  it('reports a missing conversation', async () => {
    prismaMock.conversation.findUnique.mockResolvedValue(null)

    expect(await linkContactToClient({ conversationId: CONV, clientId: CLIENT })).toEqual({
      success: false,
      error: 'Conversación no encontrada',
    })
  })
})
