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
- [ ] T3 — PDF: dependency, document component, route handler, smoke test that the output is a PDF. Route: delegated.
- [ ] T4 — UI: multi-line income form with the receipt switch and download, table actions. Route: delegated.
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

## Next step
T3 (PDF: dependency, document component, route handler, smoke test).
