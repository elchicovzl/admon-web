# Feature: whatsapp-pr1-6-pr2-5
Objective: PR1.6 (auto-link WhatsApp contacts when a client is created or its phone changes) and PR2.5 (WhatsApp tab in the client profile) of the SDD change `whatsapp-ai-assistant` (Engram #2420).
Branches: `feat/whatsapp-m1-auto-link` (PR1.6), `feat/whatsapp-m2-client-tab` (PR2.5), both based on master. Delivery: stacked-to-main. Runner: `pnpm vitest run <path>`, plus `pnpm exec tsc --noEmit`.

## Specs
- S1 (1.6.1) "unique match links contact, sets MATCHED, lead CONVERTED with convertedClientId (LD-5); multiple clients -> flag AMBIGUOUS, no link; contacts with `matchLocked=true` or already linked untouched; throws inside are swallowed."
- S2 (1.6.1/1.6.2) "createClient/updateClient (phone changed only) /employee creation call the hook and never fail because of it." Employee creation goes through `createClient`.
- S3 (2.5.1) "`getClientConversations(clientId)` denies USER (S-CP-2, CP-4), returns newest-first (S-CP-1), empty state data (S-CP-3), excludes purged (rows absent, S-CP-4), no consent timestamps in payload (CP-3)." Access per amendment #2427: `requireWhatsAppAuth()`.
- S4 (2.5.2) "create `components/dashboard/clients/client-whatsapp-tab.tsx`; edit `app/dashboard/clients/[id]/page.tsx` wrapping existing sections unchanged in a \"Perfil\" tab (`components/ui/tabs.tsx`) plus \"WhatsApp\" tab trigger only for MANAGER/SUPER_ADMIN, `?tab=whatsapp` deep link." Trigger only for users with WhatsApp access.
- S5 (2.5.3) "Manual regression: all existing client profile sections render in same order (CP-5)."

## Tasks
- [x] T1 S1-S2 auto-link hook — inline — PR1.6 (RED 7 + 2 failing → GREEN 34 + 7; suite 1917/1918, pre-existing send.test failure)
- [ ] T2 S3 getClientConversations — inline — PR2.5
- [ ] T3 S4-S5 client profile tabs + WhatsApp tab + docs — inline — PR2.5

## Log
- L1 (2026-10-20, user): "dale sigamos con PR2.5 y PR1.6"
- L2 Route: inline (two small dependent-free units, each ~200 lines; below the writer threshold to pay off).
