import { describe, expect, it } from 'vitest'
import { browserNotificationSpec, notificationLink, notificationText } from '../present'

describe('notificationLink', () => {
  it('opens the conversation when there is one', () => {
    expect(notificationLink('ESCALATION', 'conv-1')).toBe('/dashboard/whatsapp?c=conv-1')
    expect(notificationLink('NEW_LEAD', 'conv-1')).toBe('/dashboard/whatsapp?c=conv-1')
  })

  it('falls back to the inbox without a conversation', () => {
    expect(notificationLink('NEW_LEAD', null)).toBe('/dashboard/whatsapp')
  })

  it('sends draft reviews to the pending review page', () => {
    expect(notificationLink('DRAFT_PENDING_REVIEW', 'conv-1')).toBe('/dashboard/affiliations/pending-review')
  })

  it('encodes the id so it cannot break out of the query string', () => {
    expect(notificationLink('ESCALATION', 'a&b=c')).toBe('/dashboard/whatsapp?c=a%26b%3Dc')
  })
})

describe('notificationText', () => {
  it('uses the profile name and never a phone number', () => {
    expect(notificationText('ESCALATION', ' Ana ')).toEqual({
      title: 'Conversación escalada',
      body: 'Ana necesita atención de un asesor',
    })
  })

  it.each([undefined, null, '', '   '])('falls back to a neutral subject for %j', (name) => {
    expect(notificationText('NEW_LEAD', name).body).toBe('Un cliente escribió por WhatsApp')
  })

  it('has Spanish copy for every type', () => {
    for (const type of ['ESCALATION', 'NEW_LEAD', 'NEW_ACTIVITY_ON_ESCALATED', 'AI_FAILURE', 'DRAFT_PENDING_REVIEW'] as const) {
      const { title, body } = notificationText(type, 'Ana')
      expect(title.length).toBeGreaterThan(0)
      expect(body.length).toBeGreaterThan(0)
    }
  })
})

describe('browserNotificationSpec', () => {
  const base = { id: 'n1', title: 'T', body: 'B', link: '/x', conversationId: null, entityId: null }

  it('tags by conversation so messages of one chat replace each other', () => {
    expect(browserNotificationSpec({ ...base, conversationId: 'conv-1', entityId: 'l1' }).tag).toBe('conv-1')
  })

  it('falls back to the entity, then to the notification id', () => {
    expect(browserNotificationSpec({ ...base, entityId: 'l1' }).tag).toBe('l1')
    expect(browserNotificationSpec(base).tag).toBe('n1')
  })

  it('carries the title, body and link', () => {
    expect(browserNotificationSpec(base)).toMatchObject({ title: 'T', body: 'B', link: '/x' })
  })
})
