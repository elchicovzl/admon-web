import { differenceInCalendarDays } from 'date-fns'
import { AffiliationSubProcessType } from '@prisma/client'
import type {
  AffiliationSubProcessWithRelations,
  AffiliationWithRelations,
} from '@/lib/types/affiliation.types'

type DateLike = Date | string | null | undefined

export interface DisabilityRow {
  affiliation: AffiliationWithRelations
  subProcess: AffiliationSubProcessWithRelations
}

/** The affiliations list switches to one row per disability when INCAPACIDADES is the only sub-process filter. */
export function isDisabilityOnlyFilter(selected: AffiliationSubProcessType[]): boolean {
  return selected.length === 1 && selected[0] === AffiliationSubProcessType.INCAPACIDADES
}

function affiliationMatches(affiliation: AffiliationWithRelations, q: string): boolean {
  return [
    affiliation.affiliationNumber,
    affiliation.client?.fullName,
    affiliation.client?.identificationNumber,
  ].some((value) => value?.toLowerCase().includes(q))
}

function employeeMatches(subProcess: AffiliationSubProcessWithRelations, q: string): boolean {
  return [subProcess.employee?.fullName, subProcess.employee?.identificationNumber].some((value) =>
    value?.toLowerCase().includes(q)
  )
}

/**
 * Flattens affiliations into one row per INCAPACIDADES sub-process.
 * When the search matches only an employee, only that employee's rows are kept.
 */
export function buildDisabilityRows(
  affiliations: AffiliationWithRelations[],
  searchQuery: string
): DisabilityRow[] {
  const q = searchQuery.trim().toLowerCase()
  return affiliations.flatMap((affiliation) => {
    const keepAll = !q || affiliationMatches(affiliation, q)
    return (affiliation.subProcesses || [])
      .filter((sp) => sp.type === AffiliationSubProcessType.INCAPACIDADES)
      .filter((sp) => keepAll || employeeMatches(sp, q))
      .map((subProcess) => ({ affiliation, subProcess }))
  })
}

export function daysSince(date: DateLike, now: Date = new Date()): number | null {
  if (!date) return null
  const days = differenceInCalendarDays(now, new Date(date))
  return Number.isNaN(days) ? null : Math.max(0, days)
}

export function disabilityDays(start: DateLike, end: DateLike): number | null {
  if (!start || !end) return null
  const days = differenceInCalendarDays(new Date(end), new Date(start))
  return Number.isNaN(days) ? null : Math.max(1, days + 1)
}
