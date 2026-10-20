import { describe, expect, it } from 'vitest'
import type { ConversationSummary, ThreadMessage } from '@/lib/types/whatsapp.types'
import {
  attentionLabel,
  compareConversations,
  conversationMarkers,
  deliveryLabel,
  formatAttentionSlot,
  formatBadgeCount,
  formatListTime,
  formatRemaining,
  hasNewInbound,
  listPreview,
  mediaKind,
  mergeConversations,
  mergeMessages,
  olderThanCursor,
  parseConversationParam,
  resolveDisplayName,
  senderLabel,
  sortConversations,
  threadCursorOf,
  windowState,
} from '../inbox'

function conv(overrides: Partial<ConversationSummary> & { id: string }): ConversationSummary {
  return {
    displayName: overrides.id,
    phone: '+573001112233',
    clientId: null,
    status: 'HUMAN',
    aiPaused: false,
    unreadCount: 0,
    preview: null,
    lastMessageAt: '2026-10-19T12:00:00.000Z',
    lastInboundAt: null,
    escalatedAt: null,
    attentionDueAt: null,
    escalatedOutOfHours: false,
    takenOverByName: null,
    markers: [],
    updatedAt: '2026-10-19T12:00:00.000Z',
    ...overrides,
  }
}

function msg(overrides: Partial<ThreadMessage> & { id: string }): ThreadMessage {
  return {
    direction: 'IN',
    source: 'CLIENT',
    type: 'TEXT',
    text: 'hola',
    templateName: null,
    status: 'RECEIVED',
    errorCode: null,
    errorMessage: null,
    senderName: null,
    timestamp: '2026-10-19T12:00:00.000Z',
    updatedAt: '2026-10-19T12:00:00.000Z',
    media: null,
    ...overrides,
  }
}

describe('sortConversations (WI-12)', () => {
  it('puts ESCALATED first, by attentionDueAt ascending, then the rest by lastMessageAt descending', () => {
    const sorted = sortConversations([
      conv({ id: 'old', lastMessageAt: '2026-10-19T08:00:00.000Z' }),
      conv({ id: 'esc-late', status: 'ESCALATED', attentionDueAt: '2026-10-20T13:00:00.000Z' }),
      conv({ id: 'new', lastMessageAt: '2026-10-19T14:00:00.000Z' }),
      conv({ id: 'esc-soon', status: 'ESCALATED', attentionDueAt: '2026-10-19T09:00:00.000Z' }),
    ])
    expect(sorted.map((c) => c.id)).toEqual(['esc-soon', 'esc-late', 'new', 'old'])
  })

  it('an escalated row without a due date sorts after those that have one, then by activity', () => {
    const sorted = sortConversations([
      conv({ id: 'no-due-old', status: 'ESCALATED', lastMessageAt: '2026-10-19T08:00:00.000Z' }),
      conv({ id: 'no-due-new', status: 'ESCALATED', lastMessageAt: '2026-10-19T10:00:00.000Z' }),
      conv({ id: 'due', status: 'ESCALATED', attentionDueAt: '2026-10-19T09:00:00.000Z' }),
    ])
    expect(sorted.map((c) => c.id)).toEqual(['due', 'no-due-new', 'no-due-old'])
  })

  it('is stable on ties and does not mutate its input', () => {
    const input = [conv({ id: 'b' }), conv({ id: 'a' })]
    expect(sortConversations(input).map((c) => c.id)).toEqual(['a', 'b'])
    expect(input.map((c) => c.id)).toEqual(['b', 'a'])
    expect(compareConversations(input[0], input[0])).toBe(0)
  })
})

describe('mergeConversations / mergeMessages', () => {
  it('replaces by id, keeps order rules and ignores a stale copy', () => {
    const current = [conv({ id: 'a', unreadCount: 2, updatedAt: '2026-10-19T12:05:00.000Z' }), conv({ id: 'b' })]
    const merged = mergeConversations(current, [
      conv({ id: 'a', unreadCount: 0, updatedAt: '2026-10-19T12:01:00.000Z' }),
      conv({ id: 'b', lastMessageAt: '2026-10-19T13:00:00.000Z', updatedAt: '2026-10-19T13:00:00.000Z' }),
      conv({ id: 'c', status: 'ESCALATED' }),
    ])
    expect(merged.map((c) => c.id)).toEqual(['c', 'b', 'a'])
    expect(merged.find((c) => c.id === 'a')?.unreadCount).toBe(2)
  })

  it('orders messages oldest first, updates status ticks in place and appends new ones', () => {
    const current = [
      msg({ id: 'm1', timestamp: '2026-10-19T12:00:00.000Z' }),
      msg({ id: 'm2', direction: 'OUT', status: 'SENT', timestamp: '2026-10-19T12:01:00.000Z' }),
    ]
    const merged = mergeMessages(current, [
      msg({ id: 'm2', direction: 'OUT', status: 'READ', timestamp: '2026-10-19T12:01:00.000Z', updatedAt: '2026-10-19T12:02:00.000Z' }),
      msg({ id: 'm3', timestamp: '2026-10-19T12:03:00.000Z' }),
    ])
    expect(merged.map((m) => m.id)).toEqual(['m1', 'm2', 'm3'])
    expect(merged[1].status).toBe('READ')
  })

  it('hasNewInbound only flags unseen customer messages', () => {
    const current = [msg({ id: 'm1' })]
    expect(hasNewInbound(current, [msg({ id: 'm1' })])).toBe(false)
    expect(hasNewInbound(current, [msg({ id: 'm2', direction: 'OUT', source: 'DASHBOARD' })])).toBe(false)
    expect(hasNewInbound(current, [msg({ id: 'm3' })])).toBe(true)
  })
})

describe('markers (Sin cliente / Lead / Ambiguo)', () => {
  it('maps contact state to chips', () => {
    expect(conversationMarkers({ hasClient: true, matchStatus: 'MATCHED', leadStatus: null })).toEqual([])
    expect(conversationMarkers({ hasClient: false, matchStatus: 'UNMATCHED', leadStatus: 'NEW' })).toEqual(['NO_CLIENT', 'LEAD'])
    expect(conversationMarkers({ hasClient: false, matchStatus: 'UNMATCHED', leadStatus: 'CONTACTED' })).toEqual(['NO_CLIENT', 'LEAD'])
    expect(conversationMarkers({ hasClient: false, matchStatus: 'UNMATCHED', leadStatus: 'DISCARDED' })).toEqual(['NO_CLIENT'])
    expect(conversationMarkers({ hasClient: false, matchStatus: 'UNMATCHED', leadStatus: null })).toEqual(['NO_CLIENT'])
    expect(conversationMarkers({ hasClient: false, matchStatus: 'AMBIGUOUS', leadStatus: null })).toEqual(['AMBIGUOUS'])
  })

  it('display name falls back client -> profile -> phone', () => {
    expect(resolveDisplayName({ clientName: 'Ana Pérez', profileName: 'ana', waId: '573001112233' })).toBe('Ana Pérez')
    expect(resolveDisplayName({ clientName: null, profileName: ' ana ', waId: '573001112233' })).toBe('ana')
    expect(resolveDisplayName({ clientName: null, profileName: null, waId: '573001112233' })).toBe('+573001112233')
  })
})

describe('attention marker (WI-12)', () => {
  // 2026-10-19 is a Monday; 13:00Z is 08:00 in Bogota (UTC-5).
  const due = '2026-10-19T13:00:00.000Z'
  const base = { status: 'ESCALATED' as const, escalatedOutOfHours: true, attentionDueAt: due }

  it('formats the slot in Bogota time', () => {
    const label = formatAttentionSlot(new Date(due))
    expect(label).toMatch(/^lun/i)
    expect(label).toMatch(/8:00$/)
  })

  it('shows "Atender: ..." only for an out-of-hours escalation whose slot is still ahead', () => {
    expect(attentionLabel(base, new Date('2026-10-18T20:00:00.000Z'))).toMatch(/^Atender: lun.*8:00$/i)
    expect(attentionLabel(base, new Date('2026-10-19T13:00:00.000Z'))).toBeNull()
    expect(attentionLabel({ ...base, escalatedOutOfHours: false }, new Date('2026-10-18T20:00:00.000Z'))).toBeNull()
    expect(attentionLabel({ ...base, status: 'HUMAN' as never }, new Date('2026-10-18T20:00:00.000Z'))).toBeNull()
    expect(attentionLabel({ ...base, attentionDueAt: null }, new Date('2026-10-18T20:00:00.000Z'))).toBeNull()
  })
})

describe('previews and bubble labels', () => {
  it('listPreview collapses whitespace, truncates and never returns empty', () => {
    expect(listPreview('  hola\n\n   mundo ')).toBe('hola mundo')
    expect(listPreview(null)).toBe('Sin mensajes')
    expect(listPreview('   ')).toBe('Sin mensajes')
    const long = listPreview('x'.repeat(200), 90)
    expect(long).toHaveLength(90)
    expect(long.endsWith('…')).toBe(true)
  })

  it('labels every source', () => {
    expect(senderLabel({ source: 'CLIENT', senderName: null })).toBe('Cliente')
    expect(senderLabel({ source: 'CLIENT', senderName: null }, 'Miguel')).toBe('Miguel')
    expect(senderLabel({ source: 'CLIENT', senderName: null }, '  ')).toBe('Cliente')
    expect(senderLabel({ source: 'AI', senderName: null })).toBe('IA')
    expect(senderLabel({ source: 'DASHBOARD', senderName: 'Marta' })).toBe('Asesor (Marta)')
    expect(senderLabel({ source: 'DASHBOARD', senderName: null })).toBe('Asesor')
    expect(senderLabel({ source: 'PHONE_APP', senderName: null })).toBe('Teléfono')
    expect(senderLabel({ source: 'SYSTEM', senderName: null })).toBe('Sistema')
  })

  it('maps delivery state and media kind', () => {
    expect(deliveryLabel('READ')).toBe('Leído')
    expect(deliveryLabel('FAILED')).toBe('Falló')
    expect(mediaKind('IMAGE', 'image/jpeg')).toBe('image')
    expect(mediaKind('STICKER', 'image/webp')).toBe('image')
    expect(mediaKind('AUDIO', 'audio/ogg')).toBe('audio')
    expect(mediaKind('DOCUMENT', 'application/pdf')).toBe('document')
    expect(mediaKind('VIDEO', 'video/mp4')).toBe('other')
  })
})

describe('window state (WI-8)', () => {
  const now = new Date('2026-10-19T18:00:00.000Z')

  it('is open with a countdown inside 24 h', () => {
    const state = windowState(now, '2026-10-19T00:48:00.000Z')
    expect(state.open).toBe(true)
    expect(state.label).toBe('Ventana abierta · quedan 6 h 48 min')
  })

  it('is closed at exactly 24 h, with no inbound, and says only templates', () => {
    expect(windowState(now, '2026-10-18T18:00:00.000Z')).toMatchObject({
      open: false,
      remainingMs: 0,
      label: 'Ventana cerrada · solo plantillas',
    })
    expect(windowState(now, null).open).toBe(false)
  })

  it('formats remaining time', () => {
    expect(formatRemaining(5 * 3_600_000 + 12 * 60_000)).toBe('5 h 12 min')
    expect(formatRemaining(42 * 60_000 + 30_000)).toBe('42 min')
    expect(formatRemaining(-1)).toBe('0 min')
  })
})

describe('times and deep link', () => {
  it('shows the clock for today and dd/MM for earlier days, in Bogota days', () => {
    const now = new Date('2026-10-20T03:00:00.000Z') // 19 Oct 22:00 Bogota
    expect(formatListTime('2026-10-19T19:05:00.000Z', now)).toBe('14:05')
    expect(formatListTime('2026-10-18T19:05:00.000Z', now)).toBe('18/10')
  })

  it('accepts only cuid-shaped conversation params', () => {
    expect(parseConversationParam('cjld2cjxh0000qzrmn831i7rn')).toBe('cjld2cjxh0000qzrmn831i7rn')
    expect(parseConversationParam(['cjld2cjxh0000qzrmn831i7rn', 'x'])).toBe('cjld2cjxh0000qzrmn831i7rn')
    expect(parseConversationParam('../../etc')).toBeNull()
    expect(parseConversationParam('')).toBeNull()
    expect(parseConversationParam(undefined)).toBeNull()
  })
})

describe('history cursor', () => {
  it('builds the cursor from a message position', () => {
    expect(threadCursorOf({ timestamp: '2026-10-19T12:00:00.000Z', id: 'cabc' })).toEqual({
      timestamp: '2026-10-19T12:00:00.000Z',
      id: 'cabc',
    })
  })

  it('matches strictly older timestamps, or the same timestamp with a smaller id', () => {
    const at = new Date('2026-10-19T12:00:00.000Z')
    expect(olderThanCursor({ timestamp: at.toISOString(), id: 'cm3' })).toEqual({
      OR: [{ timestamp: { lt: at } }, { timestamp: at, id: { lt: 'cm3' } }],
    })
  })
})

describe('formatBadgeCount', () => {
  it('shows exact counts up to 99 and 99+ above', () => {
    expect(formatBadgeCount(1)).toBe('1')
    expect(formatBadgeCount(99)).toBe('99')
    expect(formatBadgeCount(100)).toBe('99+')
  })

  it('is empty for zero, negatives and non-finite values', () => {
    for (const value of [0, -3, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(formatBadgeCount(value)).toBe('')
    }
  })
})
