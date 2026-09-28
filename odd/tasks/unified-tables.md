# Feature: unified-tables

## Objective
1. One search input in "Mis Asignaciones" that matches the affiliation's client (independent/company) and the sub-process employee, by name or identification number (cédula, NIT, RUT, ...).
2. "Archivadas" and "Histórico" get the same table experience as "Mis Asignaciones": server-side search, pagination and sorting driven by the URL, configurable columns.

## Problem / Why
- Two inputs (company / employee) are redundant, and sub-processes without an employee (independent clients) could not be found by identification.
- Archived and History fetch every row on each visit and filter/paginate in the browser (History has no pagination at all); UX is inconsistent with My Assignments.
- My Assignments' table is ~800 lines inline in one component; copying it twice would duplicate that debt.

## Scope
- T1: unified search in My Assignments.
- T2: extract a reusable server-driven data table shell from My Assignments (no visible change).
- T3: Archived on the shared table, with a paginated server action.
- T4: History on the shared table, with a paginated server action.

## Constraints
- English code/comments; Spanish UI copy.
- Row entities differ: My Assignments = sub-process, Archived = affiliation, History = client. Only the shell is shared; columns are per view.
- Keep existing permissions/auth checks in actions.

## Decisions
- Plan accepted by the user on 2026-09-28: order T1 -> T4, one PR per step.
- Delivery: stacked-to-main (each step lands on master independently; user asked for one PR per step).

## TDD
- Mode: off (no configuration enables it). Runner: `pnpm test:run` (vitest).

## Checks
- `npx tsc --noEmit -p . 2>&1 | rg -c "error TS"` must stay 41 (pre-existing baseline).
- `npx vitest run` baseline: 24 files / 743 tests passing.

## Tasks
- [x] T1 — Unified search (`q` param): action ORs affiliation client + employee by fullName/identificationNumber; single debounced input; tests. Route: delegated (writer trigger: 2 non-trivial files). Branch `feat/my-assignments-unified-search`.
- [x] T2 — Extract shared data table shell (URL sync hook, pagination footer, sortable headers, column visibility/order persistence); My Assignments uses it with identical behavior. Route: delegated.
- [x] T3 — Archived: `getArchivedAffiliations(args)` paginated/sorted/searchable server-side; view on shared table. Route: delegated.
- [x] T4 — History: `getClientHistoryList(args)` paginated/sorted/searchable server-side (keep status filter active/deleted/all); view on shared table. Route: delegated.

## Acceptance criteria
- Typing a name or ID of the company, independent client or employee finds the matching sub-processes; old `company`/`employee` URLs keep working or degrade gracefully.
- My Assignments looks and behaves the same after T2.
- Archived and History: URL-driven search, page size, pagination and sorting; only the requested page is fetched.

## Progress
- Branch `feat/my-assignments-unified-search` from master (9eed786). Baseline recorded.
- Unrelated: `fix/client-history-file-download` (31643cd) committed, PR pending user decision.

- T1 done: `buildAssignmentSearchWhere(q)` 4-way OR (client/employee x fullName/identificationNumber); single `q` input; legacy `company`/`employee` params map to `q` (company wins if both). Evidence: vitest 25 files / 748 passing (+5); tsc 41 = baseline.

- T2 done: `ServerDataTable<TData>` + `useTableUrlParams`/`useDebouncedUrlParam` + `buildSearchParams` + `parsePaginationParams` + `PaginatedResult<T>` in `components/dashboard/data-table/`, `lib/utils/pagination.ts`, `lib/types/pagination.types.ts`. My Assignments client ~800 -> ~330 lines, same localStorage key/format. Call `useTableUrlParams()` once per view and pass `updateUrl`/`isPending` down. Evidence: vitest 27 files / 768 (+20); tsc 41. Manual browser check of My Assignments pending.

- T3 done: `getArchivedAffiliations(args)` paginated/sorted, `buildArchivedWhere(q)` (affiliationNumber, client name/ID, employee name/ID); view on `ServerDataTable` (`archived-affiliations-table-v1`). Removed "Total Archivadas" card (count shown in table header); sub-process badges now use `TypeBadge`. Local DB has 0 archived rows — only unit-tested. Evidence: vitest 28 files / 777 (+9); tsc 41.

- T4 done: `getClientHistoryList(args)` paginated/sorted (name, createdAt, processes/files count), `buildClientHistoryWhere({q,status})` (same active/deleted/all semantics, default all); view on `ServerDataTable` (`client-history-table-v1`); `client-history-table.tsx` deleted. Status select no longer shows counts. Evidence: vitest 29 files / 791 (+14); tsc 41.
- PRs (stacked to master): #30 T1 -> #31 T2 -> #32 T3 -> T4. Native review: not run (preflight blocked by untracked .atl cache file, see client-multi-type doc).

## Next step
Manual browser check of the three tables; merge chain in order, retargeting each PR to master before merging it.
