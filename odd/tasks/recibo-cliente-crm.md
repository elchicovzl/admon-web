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

## Next step
Manual browser check of both flows; push and PR are the user's call.
- 2026-10-18: commit b7b25ab. RDD on origin/master..b7b25ab (committed-only): medium, `slice_budget_reached`, consent granted by the user, one reliability lens, approved with no findings, acknowledged (lineage review-510c876783f99966).
