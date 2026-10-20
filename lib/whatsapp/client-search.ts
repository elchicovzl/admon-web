import { Prisma } from '@prisma/client'
import { ACCENT_FROM, ACCENT_TO, escapeLike, parseSearchQuery } from './search'

/** Results shown in the "Vincular a cliente" dialog. */
export const CLIENT_LINK_RESULT_CAP = 10

/**
 * Client picker for a manual link (PR2.4). Same rules as automatic matching: only active,
 * non-deleted clients. Names are compared accent- and case-insensitively like the inbox search;
 * phone-like input also matches the document number and the phone digits, whatever punctuation
 * the stored phone has (Client.phone is free text, WC-9). Null when there is nothing to search.
 */
export function buildClientLinkSearchSql(query: string | null | undefined): Prisma.Sql | null {
  const terms = parseSearchQuery(query)
  if (!terms) return null

  const conditions = [
    Prisma.sql`lower(translate("fullName", ${ACCENT_FROM}::text, ${ACCENT_TO}::text)) LIKE ${`%${escapeLike(terms.name)}%`} ESCAPE '!'`,
  ]
  if (terms.digits) {
    const digits = `%${escapeLike(terms.digits)}%`
    conditions.push(Prisma.sql`"identificationNumber" LIKE ${digits} ESCAPE '!'`)
    conditions.push(Prisma.sql`regexp_replace(phone, '\\D', '', 'g') LIKE ${digits} ESCAPE '!'`)
  }

  return Prisma.sql`
    SELECT id, "fullName", "identificationNumber", phone
    FROM clients
    WHERE "isActive" = true
      AND status <> 'ELIMINADO'
      AND (${Prisma.join(conditions, ' OR ')})
    ORDER BY "fullName" ASC
    LIMIT ${CLIENT_LINK_RESULT_CAP}
  `
}
