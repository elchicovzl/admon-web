# Feature: alegra-date-ordering

## Objective
Estimates and payments in the finances dashboard must show the newest documents first again, and every date-range aggregate (KPIs, filtered lists, Control module) must be complete and deterministic without depending on Alegra's `id` sort order.

## Problem / Why
- `AlegraClient.listEstimates` and `listPayments` force `order_field: 'id'`, `DESC`, chosen in commit 1043d7a to make pagination deterministic (ordering by `date` was observed to repeat and lose rows at page edges: 81 rows for 73 estimates in April 2026).
- Verified against the live API on 2026-10-02: Alegra sorts `id` **as a string**. `order_field=id&order_direction=ASC` returns `1, 10, 100`; `DESC` returns `999, 998, 997` first while the newest estimate is id `1267` (number 1265, dated 2026-10-02). The account has 1265 estimates; the 268 with id ≥ 1000 (May–October 2026) sort after every `9xx…1xx` document. The dashboard list (`/dashboard/finances/estimates`) therefore opens on April, and `collectByDateRange` with `orden: 'id'` never reaches recent months before its page cap (KPIs truncated or wrong).
- The same ordering is forced for `/payments`.

## Verified API facts (2026-10-02, read-only probes with the user's credentials, to be rotated)
| Endpoint | `order_field=id` | `date_after` / `date_before` | exact `date` | Notes |
|----------|------------------|------------------------------|--------------|-------|
| `/estimates` | string sort | **works** (`date_after=2026-09-25` → 3 rows; Sep range → 67) | works | header comment in `date-range-walk.ts` saying "only an exact date" is outdated |
| `/payments` | string sort | **ignored** (returns 3872 rows from 2024) | **works** (`date=2026-10-01` → 1) | no range filter |
| `/bills` | not accepted | **ignored** | works (`date=2026-09-30` → 7) | unchanged |
| `/invoices` | — | works (already used) | — | unchanged |
- Within one date, `order_field=date DESC` currently tie-breaks by `id` string DESC (Apr 30: `999,998,997,996,1006…1001,1000`), but Alegra does not document that, and the April measurement proved it is not reliable. Treat same-date tie-break as unstable.
- `start` at or beyond the filtered total returns **HTTP 500**, not an empty page (seen with `date_after/date_before` + `start=20` on a 12-row range). The walk must stop on a short page or when `start >= metadata.total`, never by probing past the end.
- Burst probes hit transient 500s; the client's retry handles that.

## Scope
- T1: `AlegraClient.listEstimates`/`listPayments` default to `order_field: 'date'`, `order_direction: 'DESC'` (callers may still override). `ListEstimatesParams` gains `date_after`/`date_before`; `ListPaymentsParams` gains exact `date` (and `ListBillsParams` keeps its `date`). Update the header comments that claim otherwise.
- T2: `collectByDateRange` drops the `orden: 'id'` mode (`OrdenDeLista`, `margenPaginas`, the doubled `maxPages`) and becomes deterministic on `date DESC`: early cut-off on the first row older than `dateFrom`, dedupe by `id`, stop on short page **or** when the next `start` would reach `total`, and a new optional `fetchByDate(date)` hook: whenever a date spans a page boundary (last dated row of page N has the same `date` as the first dated row of page N+1), the walk fetches that date completely through the hook (paginated internally, same short-page/total stop) and replaces every row of that date with the exact set. Without the hook, behavior is the current `'fecha'` mode plus the `total` guard.
- T3: `cache.ts` range readers: estimates pass `date_after`/`date_before` to narrow the walk and provide `fetchByDate` via `listEstimates({ date })`; payments provide `fetchByDate` via `listPayments({ date, type })`; bills provide `fetchByDate` via `listBills({ date, provider_name, status, type })`. All three use the default `date DESC` order. KPI call sites keep their TTLs.
- T4: tests. `date-range-walk.test.ts`: remove id-mode cases; add (a) same-day group spanning a page boundary with a permuted second page that drops one row and repeats another → with `fetchByDate` the result is complete and unique; (b) `total` guard: a range whose row count is an exact multiple of `pageSize` never requests the page past the end; (c) early cut-off still works. `client.test.ts`: `listEstimates`/`listPayments` send `order_field=date&order_direction=DESC` by default and forward `date_after`/`date_before`/`date`. Keep the resilience tests green.
- T5: verify (tsc baseline, vitest), and a live check against the API: list page opens on the October estimates, September KPI count equals 67. PR.

Out of scope: UI changes, cache TTLs, Control module logic (it only consumes `DateRangeResult`).

## Constraints
- English code and comments (the existing Spanish comments in these files may stay; new ones in English). No persona tone.
- Do not change `DateRangeResult` shape; 17 call sites consume it.
- No network in unit tests; fetchers are injected.
- Keep the client's single-flight and retry behavior untouched.

## TDD
- Mode: off (no configuration enables it). Runner: `pnpm test -- --run` (vitest). Write the new tests alongside the change and show them passing.

## Checks
- `npx tsc --noEmit -p . 2>&1 | rg -c "error TS"` must stay ≤ 36 (pre-existing baseline on master 2178063; none in `lib/alegra`).
- `pnpm test -- --run` baseline: 29 files / 791 tests passing.

## Delivery
- Strategy: single-pr. RDD: on (global). Branch `fix/alegra-date-ordering` from origin/master (2178063).

## Tasks
- [x] T1 — Client defaults and param types. Route: delegated (one writer for T1–T4; writer trigger).
- [x] T2 — Deterministic walk with `fetchByDate` boundary refetch and `total` guard. Route: delegated.
- [x] T3 — Cache range readers wired to the new walk. Route: delegated.
- [x] T4 — Tests. Route: delegated.
- [x] T5 — Verify, live check, PR. Route: inline.

## Acceptance criteria
- `rg -n "order_field: 'id'|orden: 'id'|OrdenDeLista|margenPaginas" lib` is empty.
- `/dashboard/finances/estimates` without filters shows the newest estimates first (October 2026 at the top).
- `getCachedEstimatesInRange({ dateFrom: '2026-09-01', dateTo: '2026-09-30' })` returns 67 unique items, `truncated: false`, in at most 3 upstream pages.
- Unit tests prove completeness across a same-day page boundary with an unstable tie-break.

## Progress
- Branch created; API facts recorded above.
- T1–T4 done (commit 11f46f6, delegated writer): `listEstimates`/`listPayments` default to `date DESC`; `date_after`/`date_before` on estimates params, `date` on payments; walk hook is `fetchDatePage(date, start, limit)` (`DatePageFetcher<T>` exported, `DateRangeOptions<T>` generic), paginated with the same short-page/total guards, counted in `pagesFetched`; a refetched date becomes authoritative (later rows of that date are ignored); hook hitting `maxPages` marks `truncated`. `orden`/`margenPaginas`/`OrdenDeLista` removed; cache readers pass range filters and the hook. Evidence: vitest 29 files / 798 tests (+7: boundary straddle with unstable tie-break, three-page straddle, out-of-range straddle, total guard, hook truncation, client default order + overrides), tsc 36 = baseline (the `lib/alegra` hits are the pre-existing `transformers.test.ts` readonly-tuple errors). Acceptance grep note: `order_field: 'id'` still appears in `listItems` (`/items`, out of scope) and in two tests that assert the override path; accepted.
- Live check (orchestrator, `tsx` script against the real API with the user's credentials, 2026-10-02): `listEstimates({limit:3})` → `1267/1265/2026-10-02, 1266/1264/2026-10-01, 1265/1263/2026-09-28`; September walk with `date_after/date_before` + hook → 67 items, 67 unique, `truncated: false`, 5 upstream pages (3 list + 2 exact-date); April → 62/62, not truncated, 3 pages. Acceptance criteria met.

- RDD on master..27ebd74 (committed-only): medium, `slice_budget_reached`, consent granted by the user, one reliability lens, approved and acknowledged (lineage review-894e9f1c8474df5b) with 3 advisory findings (non-blocking): `date-range-walk.ts:196-219` (exact-date refetch loop), `:227` (replaceDate), `cache.ts:433-446` (payments hook). Preflight needed `.codegraph/` added to `.git/info/exclude` (local only; `codegraph init` left an untracked `.codegraph/.gitignore`).

## Next step
PR review/merge. User rotates the Alegra token (credentials were shared in chat for the live checks). Follow-up candidates: `listItems` still sorts `/items` by `id` (string sort is harmless there but inconsistent); the Control module consumers could surface `pagesFetched` for observability.
