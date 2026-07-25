/**
 * Helpers to derive an employee's companies from the Employment join table.
 *
 * Since Phase 3 (logical CONTRACT), the authoritative source for "which
 * companies does this employee belong to" is `employmentsAsEmployee` (the
 * Employment rows), NOT the legacy `Client.companyId` shadow. An employee can
 * belong to several companies, so these return a list.
 */

export interface EmploymentCompanyRef {
  company: {
    id: string
    fullName: string
  }
}

/**
 * Deduped list of companies an employee belongs to, derived from their active
 * employments. Returns [] when there are none.
 */
export function employeeCompanies(
  employments?: EmploymentCompanyRef[] | null
): Array<{ id: string; fullName: string }> {
  if (!employments || employments.length === 0) return []

  const byId = new Map<string, string>()
  for (const e of employments) {
    if (!byId.has(e.company.id)) {
      byId.set(e.company.id, e.company.fullName)
    }
  }

  return Array.from(byId, ([id, fullName]) => ({ id, fullName }))
}

/**
 * Company names joined by comma (e.g. "Empresa1, Empresa2"), or '' if none.
 */
export function formatEmployeeCompanies(
  employments?: EmploymentCompanyRef[] | null
): string {
  return employeeCompanies(employments)
    .map((c) => c.fullName)
    .join(', ')
}
