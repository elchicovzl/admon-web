import { describe, expect, it } from 'vitest'
import { CLIENT_LINK_RESULT_CAP, buildClientLinkSearchSql } from '../client-search'
import { escapeLike } from '../search'

describe('buildClientLinkSearchSql', () => {
  it('returns null for blank input', () => {
    expect(buildClientLinkSearchSql('')).toBeNull()
    expect(buildClientLinkSearchSql('   ')).toBeNull()
  })

  it('searches only active, non-deleted clients by folded name, ordered and capped', () => {
    const sql = buildClientLinkSearchSql('José')!

    expect(sql.sql).toContain('"isActive" = true')
    expect(sql.sql).toContain(`status <> 'ELIMINADO'`)
    expect(sql.sql).toContain('"fullName"')
    expect(sql.sql).not.toContain('regexp_replace')
    expect(sql.sql).toMatch(/ORDER BY "fullName" ASC\s+LIMIT/)
    expect(sql.values).toContain('%jose%')
    expect(sql.values).toContain(CLIENT_LINK_RESULT_CAP)
  })

  it('matches phone digits (ignoring punctuation stored in the phone) and the document for phone-like input', () => {
    const sql = buildClientLinkSearchSql('300 123')!

    expect(sql.sql).toContain(`regexp_replace(phone, '\\D', '', 'g')`)
    expect(sql.sql).toContain('"identificationNumber"')
    expect(sql.values).toContain('%300123%')
  })

  it('passes hostile input only as a bound parameter', () => {
    const hostile = "%' OR 1=1 --"
    const sql = buildClientLinkSearchSql(hostile)!

    expect(sql.sql).not.toContain('OR 1=1')
    expect(sql.values).toContain(`%${escapeLike("%' or 1=1 --")}%`)
  })
})
