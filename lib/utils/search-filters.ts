/**
 * Prisma `where` builders for the dashboard's server-side table searches.
 *
 * They live outside the `'use server'` action modules on purpose: every export
 * of a `'use server'` file must be an async Server Action, so a synchronous
 * helper exported from there breaks `next build`.
 */

import type { Prisma } from '@prisma/client'
import type { ClientHistoryStatusFilter } from '@/lib/types/client-history.types'

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

/**
 * Build the search OR clause for the archived affiliations list.
 *
 * Matches an archived affiliation when its own affiliationNumber, its
 * client (fullName or identificationNumber — covers companies and
 * independents, since NIT/RUT/cédula are all stored in
 * identificationNumber) OR any of its sub-process employees (fullName or
 * identificationNumber) contains `q`, case-insensitive.
 *
 * Returns `undefined` for an empty/whitespace query so callers can skip
 * adding the clause entirely.
 */
export function buildArchivedWhere(q: string | undefined) {
  const query = q?.trim()
  if (!query) return undefined

  return {
    OR: [
      { affiliationNumber: { contains: query, mode: 'insensitive' as const } },
      { client: { fullName: { contains: query, mode: 'insensitive' as const } } },
      { client: { identificationNumber: { contains: query, mode: 'insensitive' as const } } },
      {
        subProcesses: {
          some: { employee: { fullName: { contains: query, mode: 'insensitive' as const } } },
        },
      },
      {
        subProcesses: {
          some: { employee: { identificationNumber: { contains: query, mode: 'insensitive' as const } } },
        },
      },
    ],
  }
}

/**
 * Build the where clause for the histórico list, applying the active/
 * deleted/all status filter and the unified search.
 *
 * Status semantics match the previous client-side filter exactly:
 * - 'active': status !== 'ELIMINADO'
 * - 'deleted': status === 'ELIMINADO'
 * - 'all' (or omitted): no status constraint — INCLUDES soft-deleted
 *   clients, same as the original getClientHistoryList() with no args.
 *
 * `q` matches (case-insensitive, partial) the client's fullName,
 * identificationNumber, email, or the fullName of a company from one of
 * their active employments — the same fields the removed client-side
 * filter used via formatEmployeeCompanies().
 */
export function buildClientHistoryWhere({
  q,
  status,
}: {
  q?: string
  status?: ClientHistoryStatusFilter
}): Prisma.ClientWhereInput {
  const where: Prisma.ClientWhereInput = {}

  if (status === 'active') {
    where.status = { not: 'ELIMINADO' }
  } else if (status === 'deleted') {
    where.status = 'ELIMINADO'
  }
  // status === 'all' or undefined: no status constraint

  const query = q?.trim()
  if (query) {
    where.OR = [
      { fullName: { contains: query, mode: 'insensitive' } },
      { identificationNumber: { contains: query, mode: 'insensitive' } },
      { email: { contains: query, mode: 'insensitive' } },
      {
        employmentsAsEmployee: {
          some: {
            isActive: true,
            company: { fullName: { contains: query, mode: 'insensitive' } },
          },
        },
      },
    ]
  }

  return where
}
