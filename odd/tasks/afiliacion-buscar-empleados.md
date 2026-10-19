# Feature: afiliacion-buscar-empleados

## Objective
Make employee selection in affiliations workable for companies with many employees, and fix searchable selects that cannot be scrolled inside dialogs.

## Problem / Why
- User (2026-10-18): a company can have many employees; the employee checklist in "Crear Nueva Afiliación – Paso 2/2" has no search.
- The client combobox in the same wizard does not scroll with the mouse wheel. Cause: shadcn `PopoverContent` renders in a portal outside the Radix `Dialog`, whose scroll lock blocks wheel events outside its content. Fix: `modal` on the `Popover`.

## Scope
- Employee checklist with a search input (name or identification number) in `affiliation-create-wizard.tsx` (one list per sub-process) and `add-subprocess-dialog.tsx`. "Seleccionar todos" applies to the employees currently visible (filtered); already selected employees stay selected when hidden by the filter.
- Search input on the company "Empleados" table (`components/dashboard/clients/company-employees-section.tsx`, client detail page), same filter helper; header count stays the total (user request, 2026-10-18).
- `modal` on the list comboboxes inside dialogs: wizard client combobox, `assign-employee-dialog.tsx`, `components/ui/searchable-select.tsx`. Date-picker popovers are out of scope.

## TDD
- Mode: off. Runner: `pnpm test:run` (vitest, `.ts` only; `.tsx` component tests are not collected in this repo). Pure filter helper tested if extracted.

## Checks
- `pnpm test:run` green; `npx tsc --noEmit -p . | rg -c "error TS"` ≤ 37; `pnpm build` OK.

## Tasks
- [x] T1 — Employee search + popover scroll fix. Route: delegated writer (writer trigger: 4 non-trivial files).

## Delivery
- Branch `fix/afiliacion-buscar-empleados` from origin/master. Single PR (forecast < 400 lines).

## Progress
- 2026-10-18: scope mapped by the orchestrator (rg over components).

- 2026-10-18: T1 done (route: delegated writer). `EmployeeChecklist` + `lib/utils/employee-search.ts` (accent/case-insensitive filter, tested), used in the wizard and add-subprocess dialog; search on the company employees table; `modal` on three list popovers. Writer checks: vitest 977 passed; tsc 37; build OK. Not clicked through in a browser.

## Next step
Browser check; PR.
