# Feature: whatsapp-pr2-4-handoff
Objective: PR2.4 of the SDD change `whatsapp-ai-assistant` (Engram #2420/#2426): conversation handoff actions, manual contact link/unlink/confirm-unknown, leads page, plus the follow-ups carried from PR2.2c.
Branches: `feat/whatsapp-m2-handoff` (PR2.4a: follow-ups + server actions), `feat/whatsapp-m2-handoff-ui` (PR2.4b: header UI + leads page). Delivery: stacked-to-main (cached repo strategy). Runner: `pnpm vitest run <path>`, plus `pnpm exec tsc --noEmit` and `pnpm lint`.

## Specs
- S1 Follow-up: "Media route cap (`app/api/whatsapp/messages/media/route.ts:39-42`): chunked bodies are buffered without limit. Stream with a cap, or reject a missing Content-Length."
- S2 Follow-up: "Log invalid-signature 401s in the webhook route (reason/count only)."
- S3 Follow-up: "Search `LIMIT 1000` has no `ORDER BY` (`lib/whatsapp/search.ts:78-84`). Add `ORDER BY c.\"lastMessageAt\" DESC`."
- S4 Task 2.4.1/2.4.2 (handoff): "RBAC denial on every action; `takeConversation`, `returnToAi` (records actor), `setConversationAiPaused`, `closeConversation`, `reopenConversation(target)`". All guarded by `requireWhatsAppAuth()` (carry-forward #2426).
- S5 Task 2.4.1/2.4.2 (contacts): "`linkContactToClient` (MANUAL, matchLocked, lead CONVERTED), `unlinkContactFromClient` (matchLocked, UNMATCHED, lead ensured/reopened to NEW), `confirmContactAsUnknown` (creates Lead)". The user's own number is AMBIGUOUS in prod, so link must work from AMBIGUOUS.
- S6 Task 2.4.1/2.4.2 (leads): "lead `listLeads/updateLead/setLeadStatus/convertLead` (S-LD-4: client created with name/phone, contact linked, lead CONVERTED)". Removing a lead "must use `removeLead()`" (carry-forward #2426).
- S7 Task 2.4.3: "Create `components/dashboard/whatsapp/handoff-actions.tsx`, `ai-pause-toggle.tsx`, link/unlink dialogs, `app/dashboard/whatsapp/leads/page.tsx` and `components/dashboard/leads/*`; convert opens existing client form prefilled."
- Acceptance: WI-9, LD-3, LD-4, LD-5, CH-6; S-LD-4, S-CH-5.

## Tasks
- [x] T1 S1-S3 follow-ups — inline — PR2.4a — 591bbbc (RED 3 failing, GREEN 52/52)
- [x] T2 S4-S5 handoff + contact actions — inline — PR2.4a — 18b3847 (RED 30+4 failing, GREEN 106/106 + contacts 27/27)
- [x] T3 S6 lead actions — inline — PR2.4a — 92d092b (RED module missing, GREEN 19/19)
- [x] T4 S7 header handoff UI, AI pause toggle, link/unlink dialogs — inline — PR2.4b — 083191a (client-search 4/4 and handoff options 4/4 written test+impl together, RED not observed separately; searchClientsForLink RED 4 failing → GREEN 34/34)
- [x] T5 S6-S7 leads page + convert flow + docs — inline — PR2.4b — (leads helpers RED module missing → GREEN 5/5)

## Log
- L1 (2026-10-20, user): "seguimos con el PR2.4."
- L2 Route: all tasks inline (no writer trigger: units depend on each other, one writer).
- L3 PR2.4a done on `feat/whatsapp-m2-handoff` (3 commits, +1297/-29, mostly tests). Full suite 1880/1881: the one failure `send.test.ts > treats the retry-limit attempt as the last one` is pre-existing (send.ts and its test are unchanged vs master). `pnpm lint` is not runnable (ESLint not configured, interactive prompt); tsc clean on touched files (repo has unrelated pre-existing tsc errors).
- L4 Risk: item 2 (security: new access-guarded actions, webhook signature path). RDD assess: high_risk (hot_path webhook). Independent verifier, then RDD review.
- L5 Design: convert = existing client form prefilled (create) then `convertLead({leadId, clientId})` reusing `linkContactToClient`; `setLeadStatus` never sets CONVERTED and never reopens CONVERTED (unlink does); `confirmContactAsUnknown`/`unlinkContactFromClient` lift `leadSuppressed`; contact actions bump `conversation.updatedAt` so pollers refresh markers.
- L6 Independent verifier on PR2.4a: S1-S6 PASS, no blockers. Advisory 1 fixed (f953708: handoff actions never throw); advisory 2 documented (unlink writes idempotent, not one transaction because lead creation notifies).
- L7 RDD review PR2.4a (lineage review-0bae331be1883aff, lenses risk/resilience/reliability): consent granted by user, APPROVED, acknowledged (authority burned). Non-blocking follow-ups: R4-link-partial-failure (touch/summary after a committed contact write can report a generic error; retry is idempotent), R4-signature-log-unthrottled (one warn per forged request, no rate limit).
- L8 PR2.4b: `searchClientsForLink` + `lib/whatsapp/client-search.ts`; `lib/whatsapp/handoff.ts` (options mirror D9); `ClientFormDialog.createDefaults` (create mode only; existing callers unchanged); leads page `/dashboard/whatsapp/leads` + `components/dashboard/leads/*`; docs section "Atención y leads (PR2.4)". Full suite 1906/1907 (same pre-existing send.test failure). Manual browser check PENDING-OPERATOR (take/return/pause/close/reopen, link/unlink/confirm, convert prefilled, delete).
