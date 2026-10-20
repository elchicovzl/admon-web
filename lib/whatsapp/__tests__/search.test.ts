import { describe, expect, it } from 'vitest'
import { buildConversationSearchWhere, normalizeSearchText, parseSearchQuery } from '../search'

describe('normalizeSearchText', () => {
  it('lowercases, strips accents and collapses whitespace', () => {
    expect(normalizeSearchText('  JOSÉ   Ñandú ')).toBe('jose nandu')
  })
})

describe('parseSearchQuery', () => {
  it('returns null for empty or whitespace input', () => {
    expect(parseSearchQuery('')).toBeNull()
    expect(parseSearchQuery('   ')).toBeNull()
    expect(parseSearchQuery(undefined)).toBeNull()
    expect(parseSearchQuery(null)).toBeNull()
  })

  it('keeps the raw and the normalized form of a name, once when they are equal', () => {
    expect(parseSearchQuery('José')).toEqual({ names: ['José', 'jose'], digits: null })
    expect(parseSearchQuery('ana')).toEqual({ names: ['ana'], digits: null })
  })

  it('treats phone-like text as digits, ignoring punctuation', () => {
    expect(parseSearchQuery('+57 300-111')?.digits).toBe('57300111')
    expect(parseSearchQuery('(300) 111')?.digits).toBe('300111')
  })

  it('does not search phones for text that has letters', () => {
    expect(parseSearchQuery('Ana 300')?.digits).toBeNull()
  })
})

describe('buildConversationSearchWhere', () => {
  it('is null without a query', () => {
    expect(buildConversationSearchWhere('  ')).toBeNull()
  })

  it('matches profile name and client name case-insensitively in both forms', () => {
    const where = buildConversationSearchWhere('José')
    expect(where).toEqual({
      OR: [
        { contact: { profileName: { contains: 'José', mode: 'insensitive' } } },
        { contact: { client: { is: { fullName: { contains: 'José', mode: 'insensitive' } } } } },
        { contact: { profileName: { contains: 'jose', mode: 'insensitive' } } },
        { contact: { client: { is: { fullName: { contains: 'jose', mode: 'insensitive' } } } } },
      ],
    })
  })

  it('adds a waId digits match for phone-like queries', () => {
    const where = buildConversationSearchWhere('300 111')
    expect(JSON.stringify(where)).toContain('"waId":{"contains":"300111"}')
  })

  it('never searches phones for a name query', () => {
    expect(JSON.stringify(buildConversationSearchWhere('Ana'))).not.toContain('waId')
  })
})
