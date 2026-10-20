import { describe, expect, it } from 'vitest'
import {
  ACCENT_FROM,
  ACCENT_TO,
  SEARCH_RESULT_CAP,
  buildConversationSearchSql,
  escapeLike,
  normalizeSearchText,
  parseSearchQuery,
} from '../search'

/** Postgres `translate(text, from, to)` for equal-length maps, then `lower()`. */
function sqlFold(value: string, from: string, to: string): string {
  return Array.from(value)
    .map((char) => {
      const index = from.indexOf(char)
      return index === -1 ? char : to[index]
    })
    .join('')
    .toLowerCase()
}

/** `value LIKE pattern ESCAPE '!'` */
function sqlLike(value: string, pattern: string): boolean {
  let source = ''
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i]
    if (char === '!') source += pattern[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    else if (char === '%') source += '.*'
    else if (char === '_') source += '.'
    else source += char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${source}$`, 's').test(value)
}

/** Runs the bound parameters of the built query against a stored name, the way the SQL would. */
function matchesName(query: string, stored: string): boolean {
  const sql = buildConversationSearchSql(query)
  if (!sql) throw new Error('no query')
  const values = sql.values as unknown[]
  const [from, to, pattern] = values as string[]
  return sqlLike(sqlFold(stored, from, to), pattern)
}

describe('accent map', () => {
  it('has equal-length maps (translate would otherwise delete characters)', () => {
    expect(Array.from(ACCENT_FROM).length).toBe(Array.from(ACCENT_TO).length)
  })

  it('is the exact map the SQL receives as parameters', () => {
    const values = buildConversationSearchSql('jose')!.values
    expect(values.slice(0, 2)).toEqual([ACCENT_FROM, ACCENT_TO])
  })

  it('normalizeSearchText gives the same result as the SQL fold on every mapped char', () => {
    for (const char of ACCENT_FROM) {
      expect(normalizeSearchText(char)).toBe(sqlFold(char, ACCENT_FROM, ACCENT_TO))
    }
    const sample = 'ÁÉÍÓÚ Ñandú Ça va, ¿Cómo?'
    expect(normalizeSearchText(sample)).toBe(sqlFold(sample, ACCENT_FROM, ACCENT_TO))
  })

  it('folds both cases of every accented letter to plain lower case', () => {
    expect(normalizeSearchText('ÁÀÄÂÉÈËÊÍÌÏÎÓÒÖÔÚÙÜÛÑÇ')).toBe('aaaaeeeeiiiioooouuuunc')
    expect(normalizeSearchText('áàäâéèëêíìïîóòöôúùüûñç')).toBe('aaaaeeeeiiiioooouuuunc')
  })
})

describe('normalizeSearchText', () => {
  it('lowercases, strips accents and collapses whitespace', () => {
    expect(normalizeSearchText('  JOSÉ   Ñandú ')).toBe('jose nandu')
  })
})

describe('escapeLike', () => {
  it('escapes wildcards and the escape character', () => {
    expect(escapeLike('50%_off!')).toBe('50!%!_off!!')
  })
})

describe('parseSearchQuery', () => {
  it('returns null for empty or whitespace input', () => {
    expect(parseSearchQuery('')).toBeNull()
    expect(parseSearchQuery('   ')).toBeNull()
    expect(parseSearchQuery(undefined)).toBeNull()
    expect(parseSearchQuery(null)).toBeNull()
  })

  it('normalizes the name form', () => {
    expect(parseSearchQuery('  José  ')).toEqual({ name: 'jose', digits: null })
  })

  it('treats phone-like text as digits, ignoring punctuation', () => {
    expect(parseSearchQuery('+57 300-111')?.digits).toBe('57300111')
    expect(parseSearchQuery('(300) 111')?.digits).toBe('300111')
  })

  it('does not search phones for text that has letters', () => {
    expect(parseSearchQuery('Ana 300')?.digits).toBeNull()
  })
})

describe('buildConversationSearchSql', () => {
  it('is null without a query', () => {
    expect(buildConversationSearchSql('  ')).toBeNull()
  })

  it('"jose" finds "José", "JOSÉ" finds "jose", in either direction', () => {
    expect(matchesName('jose', 'José')).toBe(true)
    expect(matchesName('JOSÉ', 'jose')).toBe(true)
    expect(matchesName('josé', 'JOSÉ PÉREZ')).toBe(true)
    expect(matchesName('nandu', 'Ñandú')).toBe(true)
    expect(matchesName('jose', 'Maria')).toBe(false)
  })

  it('matches substrings, not only prefixes', () => {
    expect(matchesName('erez', 'José Pérez')).toBe(true)
  })

  it('LIKE wildcards typed by the user are literal', () => {
    expect(matchesName('%', 'José')).toBe(false)
    expect(matchesName('_ose', 'José')).toBe(false)
    expect(matchesName('100%', 'Ana 100% fiel')).toBe(true)
  })

  it('passes injection-ish input only as a bound parameter', () => {
    const hostile = "%' OR 1=1 --"
    const sql = buildConversationSearchSql(hostile)!
    expect(sql.sql).not.toContain('OR 1=1')
    expect(sql.sql).not.toContain(hostile)
    expect(sql.sql).not.toContain("'%")
    expect(sql.values).toContain(`%${escapeLike("%' or 1=1 --")}%`)
    expect(matchesName(hostile, 'José')).toBe(false)
  })

  it('searches profile name and client name, binds a result cap, and adds phone digits only for phone-like text', () => {
    const name = buildConversationSearchSql('Ana')!
    expect(name.sql).toContain('w."profileName"')
    expect(name.sql).toContain('cl."fullName"')
    expect(name.sql).not.toContain('"waId"')
    expect(name.values).toContain(SEARCH_RESULT_CAP)
    // The cap keeps the most recent conversations, not an arbitrary subset.
    expect(name.sql).toMatch(/ORDER BY c\."lastMessageAt" DESC\s+LIMIT/)

    const phone = buildConversationSearchSql('300 111')!
    expect(phone.sql).toContain('w."waId"')
    expect(phone.values).toContain('%300111%')
  })
})
