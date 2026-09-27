# Feature: client-multi-type

## Objective
Allow a `Client` to hold several types at once (EMPLEADO, EMPRESA, INDEPENDIENTE). When a multi-type client gets an affiliation, the user picks in the wizard which role that affiliation is for, and the choice is stored on the affiliation.

## Problem / Why
Business requirement: the same person/entity can be an independent, an employee and a company simultaneously. Today `Client.clientType` is a single enum and ~30 code paths branch on `=== 'EMPRESA'`.

## Scope
- Schema: `Client.clientType ClientType` -> `Client.clientTypes ClientType[]` (min 1), data migrated as a 1-element array.
- Schema: new `Affiliation.affiliatedAs ClientType` (backfilled from the client's current type), used by detail, emails and process logic instead of re-deriving from the client.
- Actions, Zod, types, client form (multi-select), clients table (badges + "contains" filter), affiliation wizard (role step when >1 type), dashboard stats.

## Constraints
- Artifacts (code, comments) in English; UI copy in Spanish as the app already is.
- Migration must preserve existing data; production DB is on Dokploy and is not touched from dev.
- Do not change unrelated behavior. Employment join table stays as is.

## Decisions
- `ClientType[]` array over a join table: types carry no metadata. (2026-09-27)
- Affiliation role chosen by the user in the wizard when the client has >1 type; auto-selected when it has one. Stored in `affiliatedAs`. (2026-09-27)
- `employeeType`/`workDaysRange` kept when the client includes EMPLEADO (previously nulled when type != EMPLEADO).
- Dashboard stats: a client with several types counts once per type.

## TDD
- Mode: off (source: no project/session configuration enabling TDD). Runner: `pnpm test:run` (vitest).
- Ordinary functional checks per task.

## Checks
- `npx tsc --noEmit -p .` — no NEW errors vs baseline (41 pre-existing errors, saved in session scratchpad).
- `npx vitest run` — baseline 21 files / 722 tests passing.
- `pnpm prisma migrate dev` applies cleanly on local DB.

## Delivery
- Strategy: ask-on-risk. Forecast ~700-900 authored lines -> exceeds ~400 budget; chain strategy to be confirmed with the user.

## Tasks
- [x] T1 — Client multi-type core: schema + migration (`clientTypes`), types, Zod, client/employment/history actions, client form multi-select, clients table badges/filter, client info/summary/history views, existing affiliation checks switched to `includes`. Route: delegated (writer trigger: 15+ non-trivial files).
- [x] T2 — Affiliation role: `Affiliation.affiliatedAs` + backfill migration, wizard role step, create/edit actions, detail/emails/process logic read `affiliatedAs`. Route: delegated (writer trigger).
- [x] T3 — Dashboard stats per type with multi-type clients (replace `groupBy(['clientType'])`). Route: inline or delegated depending on size.

## Acceptance criteria
- A client can be created/edited with 1..3 types; at least one is required.
- Company-only fields (NIT, legal representative) show when EMPRESA is among the types; employee fields when EMPLEADO is.
- Clients table shows one badge per type; filtering by a type matches clients that include it.
- Creating an affiliation for a multi-type client requires choosing the role; single-type clients skip the step.
- Existing clients and affiliations behave exactly as before after migration.

## Progress
- Baseline recorded. Branch `feat/client-multi-type` from `master`.
- T1 done — commit `659b171`. Review: assessed high (process_boundary, 743 lines, review_due); native review UNAVAILABLE — preflight requires an undocumented `intended-untracked-selection/v1` JSON for the untracked `.atl/.skill-registry.cache.json` and every attempted shape was rejected.
  - Migration `20260927010000_client_multi_type` (add array, backfill `ARRAY["clientType"]`, NOT NULL, drop old column). Applied locally with `prisma migrate deploy` because `migrate dev` detected unrelated pre-existing drift (`20260827050000_servicios_alegra` modified after apply) and demanded a reset.
  - Evidence: `npx vitest run` -> 23 files / 738 tests passing (+2 files, +16 tests). `npx tsc --noEmit` -> 41 errors, same total as baseline; per-file counts unchanged (parent spot check).
  - ~686 authored changed lines (incl. migration and 2 new test files).

- T2 done — migration `20260927020000_affiliation_affiliated_as` (backfill from `clientTypes[1]`), wizard role step for multi-type clients, server validation, detail badge; email builders/sub-process gates read `affiliatedAs`. Evidence: vitest 24 files / 743 passing; tsc 41 = baseline. ~400 lines. Error message changed to "Solo las afiliaciones registradas como EMPRESA pueden tener empleados en sub-procesos".
- T3 absorbed by T1: `getClientsCount` counts per type with `{ has }` (multi-type client counts once per type); chart shape unchanged. Types with zero clients now appear with count 0.

## Next step
Open PR(s) once the user picks the chain strategy. Manual browser test of the wizard role step pending.
