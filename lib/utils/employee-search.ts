/**
 * Pure helpers for filtering an employee checklist by a free-text query.
 */

/** Lowercase and strip diacritics so "José" matches "jose". */
export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
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

/**
 * "Seleccionar todos" over a filtered list: when every visible id is selected,
 * unselect them; otherwise add the missing ones. Selections hidden by the
 * filter are kept either way.
 */
export function toggleVisibleSelection(current: string[], visibleIds: string[]): string[] {
  const allSelected = visibleIds.every((id) => current.includes(id))
  return allSelected
    ? current.filter((id) => !visibleIds.includes(id))
    : [...current, ...visibleIds.filter((id) => !current.includes(id))]
}

/**
 * Employees a company (EMPRESA) sub-process is created for: one per selected
 * employee, or a single company-level sub-process (null) when none is selected.
 */
export function employeeTargetsForSubProcess(selectedIds: string[]): (string | null)[] {
  return selectedIds.length > 0 ? selectedIds : [null]
}
