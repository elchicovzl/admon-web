# Feature: recibo-cliente-crm

## Objective
The payment receipt ("Recibo de pago") is issued to a **client of the CRM** (`Client`, the people and companies the firm runs processes for), chosen from a searchable select, instead of to a Control counterparty (`Contraparte`).

## Problem / Why
- Today both receipt entry points (income form with "Emitir recibo" and the "Emitir recibo" dialog in the movements table) list `Contraparte` rows. That list is small and is not the client base: a CRM client only appears there if someone registered it as a counterparty.
- User (2026-10-18): "no es contraparte, debe ser un cliente, por ejemplo a los que se le hace un proceso".

## Decisions
1. The picker lists active `Client` rows (`isActive = true`), label `fullName`, searchable by name and `identificationNumber`.
2. No schema change. `ReciboPago.contraparteId` stays required: the chosen `Client` is resolved to its `Contraparte` through the existing unique `Contraparte.clientId`. If none exists, one is created (`tipo CLIENTE`, `nombre = fullName`, `documento` = digits of `identificationNumber`, `clientId`). If a counterparty with that `documento` already exists without `clientId`, it is linked instead of duplicated. Resolution happens inside the receipt transaction.
3. Snapshot on the receipt keeps coming from the resolved counterparty (`clienteNombre`, `clienteDocumento`).
4. Table dialog: the client picker is always shown. When the movement's counterparty is linked to a client, that client is preselected. The movement itself is not changed (immutable).
5. Income form with the receipt switch on: the picker lists clients; the resolved counterparty becomes the movement's `contraparteId`. With the switch off, the field stays the optional counterparty picker as today.

## Scope
- Zod: `emitirReciboSchema` and `createMovimientoSchema` accept `clientId` for the receipt (replacing the counterparty requirement when `emitirRecibo` is true).
- Actions: client → counterparty resolution helper (tested); `createMovimiento` and `emitirReciboDeMovimiento` use it; a read action listing active clients for the picker.
- UI: `movimiento-form-dialog.tsx`, `movimientos-table.tsx`, and the page(s) that feed them.
- Out of scope: PDF layout, numbering, issuer data.

## Constraints
- Production DB (Dokploy) is never touched. No migration expected.
- Money through `sumarMontos` / `redondearMonto` / `decimalANumero`.
- UI copy in Spanish matching the existing voseo in the Control module.

## TDD
- Mode: off (no configuration enables it). Runner: `pnpm test:run` (vitest, `**/*.test.ts`). Tests ship with the change.

## Checks
- `npx tsc --noEmit -p . 2>&1 | rg -c "error TS"` ≤ 37 (baseline on origin/master 4cf0dfe).
- `pnpm test:run` green.
- `pnpm build` OK.

## Tasks
- [x] T1 — Receipt client from CRM: schema, resolution helper + tests, actions, client list action, both UI entry points. Route: delegated writer (writer trigger: 4+ non-trivial files).

- [x] T2 — Receipt PDF in the layout of the Alegra quote the user supplied (`~/Downloads/Receipt Not Valid as Invoice.pdf`), with a fixed snapshot of the client's contact data. Route: delegated writer (writer trigger: schema + migration + actions + PDF + tests).

### T2 decisions (user, 2026-10-18: "copia fija")
- New nullable columns on `recibos_pago`: `clienteTipoDocumento`, `clienteDireccion`, `clienteCiudad`, `clienteTelefono`, filled at issue time from `Client` / `ClientAddress` (`ciudad ?? municipio`). Receipts issued before this have them null and print blanks. Hand-written additive migration; applied to no database by the agent (production is the user's call).
- Layout (orchestrator defaults, mirroring the sample): header with logo left, issuer block centered, "Recibo de pago / No. RP-0001" right; grey client box (SEÑOR(ES), DIRECCIÓN, CIUDAD, TELÉFONO, document type label + number) with FECHA DE EXPEDICIÓN and MEDIO DE PAGO on the right (no due date on a receipt); table Ítem | Precio | Cantidad | Descuento | Total with quantity 1 and discount 0.00% per line; Subtotal / Total box; total in words and concept below; "ELABORADO POR" signature line with the issuing user's name; footer "Este documento no es una factura de venta."; ANULADO marks kept. No Alegra sidebar text.

## Delivery
- Branch `feat/recibo-cliente-crm` from origin/master (4cf0dfe). RDD on (global). Strategy: ask-on-risk. Forecast about 350 authored lines, single PR.

## Acceptance criteria
- Both pickers list CRM clients and filter by name or document.
- Issuing for a client without counterparty creates exactly one linked counterparty; issuing again reuses it; an unlinked counterparty with the same document gets linked, not duplicated.
- Receipt snapshot shows the client's name and document.

## Progress
- 2026-10-18: design decided from the user's correction; branch created; tsc baseline 37.

- 2026-10-18: T1 done (route: delegated writer). New `lib/utils/control-recibo-cliente.ts` (`resolverContraparteDeCliente`, `normalizarDocumento`; outside the `use server` actions file on purpose), `getClientesParaRecibo`, schemas take `clientId`, both pickers list CRM clients with label `Nombre · documento`. Writer checks: vitest 37 files / 951 tests; tsc 37 (baseline), none in touched files; `pnpm build` OK. Orchestrator spot check: new resolver + schema tests re-run, 15 passed.
- Decision (user, 2026-10-18): the receipt is always issued and prints the client as the CRM has it. The snapshot (`clienteNombre`, `clienteDocumento`) now comes from `Client.fullName` / `Client.identificationNumber` (raw, trimmed); the counterparty keeps the normalized document or null. Resolver tests updated; vitest 951 passed; tsc 37.

- 2026-10-18: full-branch review origin/master..6eb50f6 approved and acknowledged (lineage review-02b774aa91d916ee); advisory: no action-level test for the "document belongs to another client" resolver failure nor for concurrent counterparty creation (follow-up).
- 2026-10-18: T2 done (route: delegated writer). Migration `20261018000000_add_recibo_cliente_contacto` (4 nullable columns, matches `migrate diff`; applied to no database), `etiquetaTipoDocumento`, snapshot of contact data at issue time, `elaboradoPor` from `createdBy.name ?? email`, PDF rewritten to the Alegra layout. Writer checks: vitest 967 passed; tsc 37; prisma validate OK; build OK. Orchestrator spot check: demo PDF inspected against the sample; `pnpm test:run lib/pdf lib/utils` 278 passed. Open: SALVOCONDUCTO label "SC"; table area sized for ~17 lines (more may spill to page 2).

- 2026-10-18: T2 review 6eb50f6..5c54789 approved with no findings, acknowledged (lineage review-af51b124399faf68); full-branch review origin/master..5c54789 approved with no findings (lineage review-bb01e6532086de4a).
- 2026-10-18: local DB: 3 pending migrations applied with `prisma migrate deploy` (20261004, 20261006, 20261018). Production (user-authorized, connection given in chat): only 20261018 was pending; applied with `prisma migrate deploy` through a scratch config that loads no `.env*`; status "up to date". The DB password was shared in chat again and should be rotated.
- Delivery: single PR to master (user asked for "push y PR"); commits are already reviewed as two slices (T1, T2).

- 2026-10-18: PR #49 opened. Review of origin/master..f1d737a approved and acknowledged (lineage review-d5f662d0fff76cc9) with two warnings, fixed on the user's request (route: delegated writer): `normalizarDocumento(id, tipo?)` strips only dots/hyphens/spaces, returns null when letters remain (no lookup by document; counterparty without document; receipt prints the raw value), and drops the DV of a NIT (`901485874-1` → `901485874`); PDF client box wraps long text (`minHeight`), totals + signature flow together (`wrap={false}`), items spill to further pages without overlap (40-line demo inspected). Table header does not repeat on page 2 (react-pdf `fixed` would duplicate it on page 1). Checks: vitest 972 passed; tsc 37; build OK.

## Next step
Merge the PR; browser check of both flows and the PDF download.
