import type { Prisma } from '@prisma/client'

/**
 * Inbox search (PR2.2c). Pure: turns the text typed in the search box into a Prisma filter over
 * the contact's display names and phone digits. No I/O.
 *
 * Case-insensitivity comes from Prisma `mode: 'insensitive'`. Accent-insensitivity cannot come
 * from the database without the `unaccent` extension (no extension or migration is allowed here),
 * so each name term is matched in two forms: the text as typed and its accent-stripped form.
 * Known limit: an accent-free query still cannot find an accented stored name ("jose" does not
 * match "José"); an accented query finds both accented and plain names ("josé" matches "Jose"
 * only through its stripped form, and "José" through the raw form).
 */

export const SEARCH_MAX_LENGTH = 80

/** Lowercase, accent-free, single-spaced. Used for comparisons and as the second match form. */
export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export interface SearchTerms {
  /** Name forms to look for: the trimmed text as typed and, when different, its normalized form. */
  names: string[]
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
  const normalized = normalizeSearchText(trimmed)
  const names = [...new Set([trimmed, normalized].filter(Boolean))]
  return { names, digits: phoneDigits(trimmed) }
}

/** Conversation filter for the query, or null when there is no query. Combine it with the state filter. */
export function buildConversationSearchWhere(
  query: string | null | undefined
): Prisma.ConversationWhereInput | null {
  const terms = parseSearchQuery(query)
  if (!terms) return null

  const or: Prisma.ConversationWhereInput[] = []
  for (const name of terms.names) {
    or.push({ contact: { profileName: { contains: name, mode: 'insensitive' } } })
    or.push({ contact: { client: { is: { fullName: { contains: name, mode: 'insensitive' } } } } })
  }
  if (terms.digits) or.push({ contact: { waId: { contains: terms.digits } } })
  return { OR: or }
}
