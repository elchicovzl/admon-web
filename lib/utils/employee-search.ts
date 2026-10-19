/**
 * Pure helpers for filtering an employee checklist by a free-text query.
 */

/** Lowercase and strip diacritics so "José" matches "jose". */
export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Keep the employees whose fullName or identificationNumber contains the
 * query (case- and accent-insensitive). A blank query returns the input list.
 */
export function filterEmployeesByQuery<
  T extends { fullName: string; identificationNumber: string },
>(employees: T[], query: string): T[] {
  const q = normalizeSearchText(query)
  if (!q) return employees
  return employees.filter(
    (e) =>
      normalizeSearchText(e.fullName).includes(q) ||
      normalizeSearchText(e.identificationNumber).includes(q)
  )
}
