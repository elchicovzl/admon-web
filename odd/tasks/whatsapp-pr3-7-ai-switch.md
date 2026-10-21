# Feature: whatsapp-pr3-7-ai-switch
Objective: PR3.7 of the SDD change `whatsapp-ai-assistant` (Engram #2421): global AI switch in the dashboard, AI usage summary, and the AI sections of the privacy and terms pages. No migration (`WhatsAppSettings` and `AiUsageRecord` exist since PR0.1/PR1.1).
Branch: `feat/whatsapp-m3-ai-switch` (base master). Delivery: stacked-to-main. Runner: `pnpm vitest run <path>`, plus `pnpm exec tsc --noEmit`.

## Specs
- S1 (3.7.1) "`setAiEnabled` SUPER_ADMIN only (MANAGER denied); writes `WhatsAppSettings.aiEnabled`". Role is read from the database (not the JWT), like `hasWhatsAppAccess`.
- S2 (3.7.1) "`getUsageSummary` aggregates tokens/audio minutes by day without content (A10, AI-13)". Assumption: days in America/Bogota, default last 30 days, readable by any user with WhatsApp access.
- S3 (3.7.2) "Edit `lib/actions/whatsapp.actions.ts`; create `components/dashboard/whatsapp/ai-switch.tsx` and usage summary card on the inbox page." Assumption: MANAGERs see the switch state read-only; when `WHATSAPP_AI_ENABLED` is not `true` the switch says the server flag is off.
- S4 (3.7.3) "Edit `app/privacy/page.tsx` and `app/terms/page.tsx`: AI data-processing section, international transfer to Anthropic/OpenAI, WhatsApp consent mechanism (XC-1). Spanish copy flagged for counsel review."

## Tasks
- [x] T1 S1-S2 actions + tests — inline (RED 19 missing actions → GREEN 19; usage SQL run on local Postgres in a rolled-back tx) — 1ee6c47
- [x] T2 S3 switch + usage dialog in the inbox header — inline (tsc clean for touched files) — 6fbc191
- [x] T3 S4 privacy/terms `#whatsapp-ia` sections, renumbered, flagged for counsel (OPS-G7) — inline (dev render 200) — 5bb2da1
- [x] T4 docs, full checks, independent verifier (no blockers), RDD review approved (3 lenses: risk, readability, reliability; review-643d0980c4c623d9 acknowledged) — inline — 90d4f78, 79489f3

## Log
- L1 (2026-10-20, user): "sigamos con PR3.7"
- L2 Route: inline (small units, one writer). Risk: item 2 (a SUPER_ADMIN-only guard on the global AI kill switch).
- L3 Tests live in a sibling file `lib/actions/__tests__/whatsapp-ai-settings.actions.test.ts` (same pattern as `whatsapp-handoff.actions.test.ts`) instead of extending `whatsapp.actions.test.ts`.
- L4 Usage summary is a dialog ("Uso de IA") in the inbox header rather than a card above the inbox, so the inbox keeps its height. Retention periods are not stated in the legal copy: PR4.3 (purge) is not built yet.
- L5 Checks: full suite 2238 pass, 1 fail = known pre-existing `send.test.ts` retry-limit (fails on master). tsc: 37 errors, all pre-existing, none in touched files. ESLint is not configured in the repo. Authenticated inbox render not checked: the local seed login fails (CredentialsSignin).
- L6 Independent verifier: S1-S4 MET, no blockers, 22/22 focused tests, Bogota-day SQL probed at the 05:00 UTC boundary. Advisory 1 (server-flag notice only in a tooltip) fixed in 79489f3; advisories 2 (no-training claim, counsel) and 3-4 (double user lookup, token totals include TRANSCRIPTION rows, always 0 today) accepted.
- L7 RDD review approved with 4 informational warnings, no correction: R1-001 privacy copy (counsel, OPS-G7), R2-001 getAiSettings double user read, R2-002 rounding in toUsageDay, R3 `audioSeconds` assumed to be a JS number (SUM of DOUBLE PRECISION; wrap in Number() as hardening). Follow-ups, not blockers.
