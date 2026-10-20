import { Prisma } from '@prisma/client'

/**
 * Inbox search (PR2.2c). Turns the text typed in the search box into a parameterized SQL query
 * that resolves matching conversation ids. Pure: building the query does no I/O.
 *
 * Accent- and case-insensitivity use Postgres built-ins only (no `unaccent` extension, no
 * migration): both the stored text and the query go through `lower(translate(text, FROM, TO))`.
 * `normalizeSearchText` applies the same character map in TypeScript, and a test keeps the two
 * in sync. Characters outside the map (e.g. "ã") are compared as they are, on both sides.
 */

export const SEARCH_MAX_LENGTH = 80
/** Safety cap for the id list one search can return. */
export const SEARCH_RESULT_CAP = 1000

/** Accented characters folded by the SQL `translate`. Upper case is included so the fold does not depend on the database locale's `lower()`. */
export const ACCENT_FROM = 'áàäâéèëêíìïîóòöôúùüûñçÁÀÄÂÉÈËÊÍÌÏÎÓÒÖÔÚÙÜÛÑÇ'
export const ACCENT_TO = 'aaaaeeeeiiiioooouuuuncAAAAEEEEIIIIOOOOUUUUNC'

/** Same fold as `lower(translate(value, ACCENT_FROM, ACCENT_TO))`, plus whitespace collapsing. */
export function normalizeSearchText(value: string): string {
  let out = ''
  for (const char of value) {
    const index = ACCENT_FROM.indexOf(char)
    out += index === -1 ? char : ACCENT_TO[index]
  }
  return out.toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Escapes LIKE wildcards (and the escape character itself) for `LIKE ... ESCAPE '!'`. */
export function escapeLike(value: string): string {
  return value.replace(/[!%_]/g, (char) => `!${char}`)
}

export interface SearchTerms {
  /** Normalized text to look for in names. */
  name: string
  /** Phone digits to look for, only when the query looks like a phone number; otherwise null. */
  digits: string | null
}

/** A query is phone-like when it has digits and nothing but phone punctuation besides them. */
function phoneDigits(query: string): string | null {
  if (!/^[\d\s+\-().]+$/.test(query)) return null
  const digits = query.replace(/\D/g, '')
  return digits.length > 0 ? digits : null
}

/** Null when there is nothing to search (empty or whitespace only). */
export function parseSearchQuery(query: string | null | undefined): SearchTerms | null {
  const trimmed = (query ?? '').replace(/\s+/g, ' ').trim()
  if (!trimmed) return null
  return { name: normalizeSearchText(trimmed), digits: phoneDigits(trimmed) }
}

/**
 * Query that returns `{ id }` rows of the conversations whose contact matches: client name
 * (what the inbox shows as the display name), WhatsApp profile name, or phone digits. User text
 * only ever travels as a bound parameter, already LIKE-escaped. Null when there is no query.
 */
export function buildConversationSearchSql(query: string | null | undefined): Prisma.Sql | null {
  const terms = parseSearchQuery(query)
  if (!terms) return null

  const namePattern = `%${escapeLike(terms.name)}%`
  const fold = (column: Prisma.Sql) =>
    Prisma.sql`lower(translate(${column}, ${ACCENT_FROM}::text, ${ACCENT_TO}::text))`

  const conditions = [
    Prisma.sql`${fold(Prisma.sql`w."profileName"`)} LIKE ${namePattern} ESCAPE '!'`,
    Prisma.sql`${fold(Prisma.sql`cl."fullName"`)} LIKE ${namePattern} ESCAPE '!'`,
  ]
  if (terms.digits) {
    conditions.push(Prisma.sql`w."waId" LIKE ${`%${escapeLike(terms.digits)}%`} ESCAPE '!'`)
  }

  return Prisma.sql`
    SELECT c.id
    FROM conversations c
    JOIN whatsapp_contacts w ON w.id = c."contactId"
    LEFT JOIN clients cl ON cl.id = w."clientId"
    WHERE ${Prisma.join(conditions, ' OR ')}
    ORDER BY c."lastMessageAt" DESC
    LIMIT ${SEARCH_RESULT_CAP}
  `
}
