# Feature: recibo-de-pago

## Objective
The Control module can issue a payment receipt ("Recibo de pago") for an income that has no Alegra invoice, and download it as a PDF that looks like an invoice, to hand to the client.

## Problem / Why
- Some services are charged without an electronic invoice ("por debajo"). Today those incomes are recorded as a manual `Movimiento` of type `INGRESO`, and the client gets no document.
- The repo has no receipt concept, no sequential numbering and no PDF generation (`rg -i recibo` is empty; no PDF library in `package.json`).

## Decisions (user, 2026-10-04)
1. Receipts are issued **only for incomes without an Alegra invoice or estimate**. A receipt is a Control-owned document with its own consecutive number; it never goes to Alegra or DIAN. Alegra stays read-only.
2. A receipt carries **several service lines**, each with its amount. Lines are the existing `MovimientoDetalleServicio` rows; amounts are not duplicated.
3. Delivery is a **downloadable PDF**, generated on the server on every request (not stored).
4. The header uses the **same legal name and NIT as the company**, and must show the **company logo**.
5. Out of scope for now: sending by email, editing an issued receipt, receipts for invoiced incomes.

## Design
### Data
- `ReciboPago` (table `recibos_pago`): `id` cuid, `numero Int @unique`, `movimientoId @unique` (1:1 with `Movimiento`), `contraparteId` (the client), `clienteNombre` and `clienteDocumento?` (snapshot at issue time, so later edits of the counterparty do not change an issued receipt), `createdAt`, `createdById`. Immutable, like `Movimiento`.
- `Consecutivo` (table `consecutivos`): `clave @id`, `ultimo Int`. The receipt number is taken with an increment inside the same transaction that creates the receipt, so numbers are gapless and never reused. A plain sequence/autoincrement is rejected because it leaves gaps on rollback.
- "Annulled" is derived, not stored: a receipt is annulled when its movement has an annulling movement (`anulaMovimientoId`). The number is never released.

### Rules
- Only `INGRESO` movements with `alegraInvoiceId`, `alegraEstimateId` and `alegraPaymentId` all null.
- Requires a client (counterparty) and at least one service line.
- Lines sum exactly the movement amount (`sumarMontos`).
- One receipt per movement.
- Closed periods: creating the income keeps the existing `periodoEstaCerrado` guard. Issuing a receipt on an existing income does not change the ledger, so it is allowed on closed periods.
- Issuing on an existing income: the movement must already have a service breakdown (movements are immutable). If the movement has no counterparty, the client is chosen at issue time and stored on the receipt.

### Flow
- Income form: the single-service selector becomes a list of lines (service + amount) with an "Emitir recibo" switch. Saving with the switch on creates income and receipt together and offers the PDF download.
- Movements table: manual incomes without a receipt get "Emitir recibo"; incomes with one get "Descargar recibo".

### PDF
- `@react-pdf/renderer` 4.x (peer range includes React 19; verified on npm 2026-10-04, version 4.9.0).
- Route handler `GET /dashboard/control/recibos/[id]/pdf`, protected by the Control access check. Response is `application/pdf` with `Content-Disposition: attachment; filename="Recibo-RP-0001.pdf"`.
- Content: logo (`public/images/logo-wordmark.png`; react-pdf does not render webp), issuer legal name, NIT, address, phone, email; receipt number and date; client name and document; lines table (service, amount); total in figures and in words; payment method (the pocket name) and concept; legend "Este documento no es una factura de venta"; "ANULADO" mark when annulled. No VAT breakdown.
- Receipt copy is neutral Spanish (the document goes to the client).

### Architecture
- Pure logic in `lib/utils/control-recibo.ts`: number formatting (`RP-0001`), amount in words (Spanish, COP), line validation, building the receipt view model. Unit tested.
- Issuer data in one config module (`lib/config/recibo-emisor.ts`). **Pending from the user: literal legal name, NIT, address, city, phone, email.** Until provided, the values are explicit placeholders and the feature must not be released.
- Server actions in `lib/actions/control.actions.ts`, following the existing patterns (`requireControlAuth`, Zod, `ActionResponse`).

## Scope / Tasks
- [x] T1 — Data model and pure logic: Prisma models + migration, `control-recibo.ts`, issuer config, unit tests. Route: delegated (writer trigger: 2+ non-trivial files).
- [x] T2 — Server actions and validation: multi-line income creation with optional receipt, issue receipt on an existing income, receipt read model for the PDF, receipt reference in the movements list; tests. Route: delegated.
- [x] T3 — PDF: dependency, document component, route handler, smoke test that the output is a PDF. Route: delegated.
- [x] T4 — UI: multi-line income form with the receipt switch and download, table actions. Route: delegated.
- [ ] T5 — Verify: tsc baseline, vitest, real PDF generated locally and inspected. Route: inline.

## Constraints
- Code, identifiers follow the module's existing language (Spanish domain names, as in `control.actions.ts`); new comments in English unless extending a Spanish block. UI copy and receipt copy in neutral Spanish, no regional slang.
- `Movimiento` stays immutable. Existing incomes and imports keep working unchanged; `servicioAlegraId` (single service) stays accepted by `createMovimientoSchema`.
- Production database lives in Dokploy and is never touched. Migrations run only against the local database (`.env.local` pointing at localhost).
- Money goes through `sumarMontos` / `redondearMonto` / `decimalANumero`; no loose `.toNumber()`.

## TDD
- Mode: off (no configuration enables it). Runner: `pnpm test:run` (vitest, node environment, `**/*.test.ts` only). Write tests alongside the change and show them passing.

## Checks
- `npx tsc --noEmit -p . 2>&1 | rg -c "error TS"` must stay at or below the baseline measured on origin/master d00fa42 (36 on the previous feature; re-measure in T1).
- `pnpm test:run` green; baseline to re-measure in T1 (798 tests on the previous feature).

## Delivery
- Branch `feat/recibo-de-pago` from origin/master (d00fa42). RDD: on (global).
- Forecast: about 1,200 authored changed lines across T1–T4, over the 400-line budget. Strategy: ask-on-risk; chain strategy pending the user's answer.

## Acceptance criteria
- A manual income with two service lines and the receipt switch on creates one movement, two breakdown rows and one receipt with the next consecutive number, in one transaction.
- Issuing is rejected for incomes with an Alegra document, without a client, without lines, with lines that do not sum the amount, or that already have a receipt.
- The PDF route returns a valid PDF with logo, issuer data, client, lines, total in words and the non-invoice legend; an annulled income shows "ANULADO".
- Users without Control access get no PDF.

## Progress
- 2026-10-04: design agreed with the user in conversation; branch created. No code yet.
- 2026-10-04: T1 done (route: delegated writer). Models + hand-written migration `20261004000000_add_recibos_pago` (local DB not verified, so no prisma command touched a database), `control-recibo.ts`, `recibo-emisor.ts` (placeholders), tests. Checks: prisma validate OK; vitest 30 files / 841 tests (baseline 29 / 798); tsc 35 errors (baseline 36), none in touched files.

- 2026-10-05: orchestrator spot check of T1: hand-written migration SQL compared against `prisma migrate diff --from-empty` output — identical statements for `recibos_pago`/`consecutivos`; `control-recibo.test.ts` re-run, 43 passed. RDD on d00fa42..5593ae4 (committed-only): medium, `slice_budget_reached`, consent granted by the user, one reliability lens, approved and acknowledged (lineage review-d02e80733c06263e). Advisory findings carried into T2: (a) migration never inserts the `RECIBO_PAGO` row in `consecutivos` (concurrent first receipts could race on upsert); (b) `armarDatosRecibo` never checks that lines sum `monto`; (c) `validarEmisionRecibo` compares `input.monto` unrounded; (d) `formatearNumeroRecibo` accepts 0/negative/non-integer; (e) the `emisorReciboCompleto` test is anchored to the placeholder state.
- A separate pre-existing working-tree change (`.atl/skill-registry.md`, not part of this feature) was reviewed on the user's consent and approved (lineage review-31f008f9c4b89961); its 3 advisory findings (absolute machine-specific paths, dropped conventions section) are follow-up work outside this feature.
- 2026-10-05: T2 done (route: delegated writer). Fixed the 5 T1 advisory findings (counter row seeded in the migration; `armarDatosRecibo` throws on a sum mismatch; `validarEmisionRecibo` rounds `monto`; `formatearNumeroRecibo` throws on invalid numbers; `emisorReciboCompleto(emisor = EMISOR_RECIBO)`). Zod: `servicios`, `emitirRecibo` + refinements, `emitirReciboSchema`. Actions: `createMovimiento` (multi-line, optional receipt in one transaction), `emitirReciboDeMovimiento`, `getReciboParaPdf`; `recibo` added to `movimientoSelect`/`MovimientoListItem`. "Annulled" = `anuladoPor !== null` (inverse relation of `anulaMovimientoId`), same rule as the table. Checks: prisma validate OK; vitest 30 files / 876 tests (baseline 841); tsc 35 errors (baseline 35), none in touched files.

- 2026-10-05: orchestrator spot check of T2: `pnpm test:run` re-run, 30 files / 876 tests. RDD on 5593ae4..4a9344f (committed-only): medium, `slice_budget_reached`, consent granted by the user, one reliability lens, approved and acknowledged (lineage review-d44fb74b83cc3f0d). Advisory findings carried into T3: (a) `mensajeErrorRecibo` maps every Prisma `P2002` to "ya tiene un recibo" even when the colliding constraint is `numero` or the breakdown unique, and skips logging; (b) the T1 migration was edited in place to seed the counter (accepted: it was never applied anywhere, the branch is unpushed; an environment that had applied the T1 version would see checksum drift). Writer gap carried into T3: issuing a receipt on an already annulled income is not blocked.
- 2026-10-05: T3 done (route: delegated writer). T2 follow-ups: `emitirReciboDeMovimiento` rejects annulled incomes; `mensajeErrorRecibo` maps `P2002` to "ya tiene un recibo" only when `meta.target` includes `movimientoId`, every other error is logged and returns the generic message (tests for both). `@react-pdf/renderer` 4.9.0 added; it is already in Next 15's default `serverExternalPackages`, so `next.config.mjs` is unchanged. `lib/pdf/recibo-pago-document.tsx` (+ `renderizarReciboPdf`, `recibo-pago-logo.ts`), route `app/dashboard/control/recibos/[id]/pdf/route.ts` (401/403/404/500, `no-store`, `X-Recibo-Emisor-Pendiente: 1` while the issuer has placeholders). `lib/pdf/tsconfig.json` sets `jsx: react-jsx` so Vitest can compile the `.tsx` (root tsconfig keeps `preserve` for Next). Real PDF rendered with and without ANULADO and inspected: accents and "Ñ" render with built-in Helvetica. Checks: vitest 31 files / 884 tests (baseline 876); tsc 35 errors (baseline 35), none in touched files; `pnpm build` OK (about 32 s).

- 2026-10-05: orchestrator spot check of T3: `pnpm test:run lib/pdf` re-run, 3 passed; demo PDF preview inspected (logo, header, lines, total in words, legend). RDD on 4a9344f..481a671 (committed-only): medium, `slice_budget_reached`, consent granted by the user, one reliability lens, approved and acknowledged (lineage review-2f653cc9a72e3724). Advisory findings carried into T4: (a) the PDF route handler has no test (status mapping 401/403/404/500, headers, pending-issuer flag; the 401/403 branches match exact error strings from `requireControlAuth`); (b) the doc comment in `recibo-pago-document.tsx` claims the smoke test checks glyph coverage, but it only checks the `%PDF` header and size; (c) the annulled smoke test does not assert that ANULADO is rendered; (d) `colisionEnMovimientoId` depends on Prisma's `meta.target` shape (accepted; documented).
- 2026-10-05: T4 done (route: delegated writer). T3 follow-ups: route handler test (8 tests: 401/403/404/500, render throw, headers, `X-Recibo-Emisor-Pendiente` present/absent); auth/not-found messages now constants in `lib/utils/control-errores.ts` used by `requireControlAuth`, `getReciboParaPdf` and the route; PDF doc comment trimmed to what the test checks; annulled smoke test asserts a larger buffer than the normal render (react-pdf compresses streams, so "ANULADO" is not greppable). UI: income form with a `useFieldArray` lines list (service + amount), live sum vs. amount, "Emitir recibo de pago" switch (client required, at least one line), toast "Descargar recibo" on success; movements table with "Emitir recibo" (confirm dialog, client picker when the income has none), "Descargar recibo RP-xxxx" (also on annulled rows) and a receipt-number badge. `MovimientoListItem` gained `tieneDocumentoAlegra` and `cantidadServicios`; pure helpers `sumaDeLineas`, `puedeEmitirReciboDeFila`, `rutaPdfRecibo`. Checks: vitest 32 files / 903 tests (baseline 884); tsc 35 errors in sources (2 more under generated `.next/types`), none in touched files; `pnpm build` OK; `pnpm lint` is not configured (`next lint` prompts for an ESLint setup).

- 2026-10-06: orchestrator spot check of T4: `pnpm test:run` re-run, 32 files / 903 tests. RDD on 481a671..8f6fc6e (committed-only): medium, `slice_budget_reached`, consent granted by the user, one reliability lens, approved and acknowledged (lineage review-c640d51c59051da1). Advisory findings: (a) turning the receipt switch off leaves the blank line it added, so an income without receipt hits validation on an optional section — fix in T5; (b) the custom resolver that drops `servicios: []` and the type-change reset are untested — fix in T5; (c) `window.open` after an awaited action in the table may be blocked and duplicates the toast action — fix in T5 (keep the toast action only).
- 2026-10-06: T5a done (route: delegated writer, commit 3c581ca): the three T4 advisories fixed (`esLineaVacia` + removal of blank lines when the switch goes off; `normalizarEntradaMovimiento` extracted and tested; `window.open` after the await removed, the toast action is the only download path). Checks: vitest 32 files / 908 tests; tsc 35 (baseline); `pnpm build` OK. RDD assess on 8f6fc6e..3c581ca: medium, 95 lines, `under_budget` — no review due; stays pending in the slice.
- 2026-10-06: delivery (user decision: chained PRs against master, `stacked-to-main`). Per-commit authored lines (additions + deletions, lockfile excluded): 647, 875, 397, 750, 95. One slicing pass by work-unit commit; no cohesive split brings slices 1, 2 and 4 under 400 without separating tests from the code they verify, so they ship over budget with that stated. Slices: PR1 `feat/recibo-de-pago-1-modelo` = 5593ae4 → master; PR2 `feat/recibo-de-pago-2-actions` = 4a9344f → PR1; PR3 `feat/recibo-de-pago-3-pdf` = 481a671 → PR2; PR4 `feat/recibo-de-pago-4-ui` = 8f6fc6e + 3c581ca (+ this doc) → PR3.

## Pending before release
- Issuer data (razón social, NIT, dirección, ciudad, teléfono; confirm email) in `lib/config/recibo-emisor.ts` — still `PENDIENTE`.
- Apply the migration on the local database (`pnpm db:up && pnpm db:migrate`) and run the UI flows in a browser: create an income with two lines and the receipt switch, download the PDF, issue a receipt from the table, annul and re-download. Not done by the orchestrator: reading `.env.local` was denied, so no database command was run.
- Engram mirror of this document is pending (every `mem_save` failed with "multiple active runtime sessions").

## Extension (user, 2026-10-06): issuer data editable in Settings
- [x] T6 — Issuer data stored in the database and edited from `/dashboard/settings` (admin only): singleton table `configuracion_empresa`, server action to read/update it, "Datos de la empresa" card, PDF route reads it (fallback to `PENDIENTE` + the warning header when empty); `lib/config/recibo-emisor.ts` keeps only the contract. Delivered as PR 5 on top of #46. Route: delegated (writer trigger).

- T6 done: Prisma `ConfiguracionEmpresa` (singleton id `default`) + hand-written migration `20261006000000_add_configuracion_empresa` (matches `migrate diff`); `lib/actions/configuracion-empresa.actions.ts` (read: any authenticated user; update: SUPER_ADMIN via `session.user.role === UserRole.SUPER_ADMIN`); `obtenerEmisorRecibo()` in `lib/control/emisor-recibo.ts` with field-by-field `PENDIENTE` fallback; PDF route uses it; Settings card for SUPER_ADMIN. Hard-coded `EMISOR_RECIBO` removed (`RECIBO_LOGO_PATH` replaces `logoPath`). Verification: `pnpm test:run` 35 files / 930 tests passed; tsc 37 errors (baseline, none in touched files); `pnpm build` ok. Migration not applied to any database.

## Next step
Review and merge the chained PRs in order; local verification above.
