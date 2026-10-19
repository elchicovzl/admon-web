# Feature: telefono-indicativo

## Objective
Phone fields accept numbers from any country: a country (dialing code) selector plus the national number.

## Problem / Why
- User (2026-10-18): creating a client always forces `+57`; a foreign number cannot be entered.
- Cause: a fixed react-imask mask `'+57 000 000 0000'` duplicated in `components/dashboard/clients/client-form-dialog.tsx` (2 fields), `create-employee-dialog.tsx` and `legal-representative-form-dialog.tsx`. Zod already accepts 7–20 characters.

## Decisions (user, 2026-10-18)
- Country selector + number (chosen over a free-text field).
- Stored value keeps today's shape `+<code> <number>` (e.g. `+57 300 123 4567`), so existing data keeps working. Colombia is the default and keeps its `000 000 0000` mask; other countries take digits and spaces.

## Scope
- One shared `PhoneInput` component (country select with flag + dial code, number input) replacing the mask in the three forms.
- A pure helper to split a stored value into country + national number and to join them back (tested). Unknown or legacy values without a code fall back to Colombia.
- Out of scope: schema changes, reformatting stored numbers.

## TDD
- Mode: off. Runner: `pnpm test:run` (vitest, `.ts` only).

## Checks
- `pnpm test:run` green; `npx tsc --noEmit -p . | rg -c "error TS"` ≤ 37; `pnpm build` OK.

## Tasks
- [x] T1 — `PhoneInput` + helper + tests, used in the three forms. Route: delegated writer (writer trigger: 4+ files).

## Delivery
- Branch `fix/telefono-indicativo` from origin/master. Single PR.

## Progress
- 2026-10-18: cause verified by the orchestrator (`rg "+57"`).

- 2026-10-18: T1 done (route: delegated writer). `lib/utils/phone.ts` (11 countries, `parsePhone`/`formatPhone`, tested), `components/ui/phone-input.tsx` (shadcn Select + IMask for Colombia), used in client, employee and legal-representative forms. Writer checks: vitest 981 passed; tsc 37; build OK. Not clicked through in a browser. Open: República Dominicana not listed (shares +1); switching country keeps typed digits.

## Next step
Browser check; PR.
