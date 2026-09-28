/**
 * Prisma `where` builders for the dashboard's server-side table searches.
 *
 * They live outside the `'use server'` action modules on purpose: every export
 * of a `'use server'` file must be an async Server Action, so a synchronous
 * helper exported from there breaks `next build`.
 */

/**
 * Build the top-level OR clause for the unified "Mis Asignaciones" search.
 *
 * Matches a sub-process when the affiliation's client (fullName or
 * identificationNumber — covers companies and independents, since NIT/RUT/
 * cédula are all stored in identificationNumber) OR the sub-process employee
 * (fullName or identificationNumber) contains `q`, case-insensitive.
 *
 * Sub-processes without an employee still match through the affiliation's
 * client. Returns `undefined` for an empty/whitespace query so callers can
 * skip adding the clause entirely.
 */
export function buildAssignmentSearchWhere(q: string | undefined) {
  const query = q?.trim()
  if (!query) return undefined

  return {
    OR: [
      { affiliation: { client: { fullName: { contains: query, mode: 'insensitive' as const } } } },
      {
        affiliation: {
          client: { identificationNumber: { contains: query, mode: 'insensitive' as const } },
        },
      },
      { employee: { fullName: { contains: query, mode: 'insensitive' as const } } },
      { employee: { identificationNumber: { contains: query, mode: 'insensitive' as const } } },
    ],
  }
}
