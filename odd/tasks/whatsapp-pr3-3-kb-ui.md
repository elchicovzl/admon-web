# Feature: whatsapp-pr3-3-kb-ui
Objective: PR3.3 of the SDD change `whatsapp-ai-assistant` (Engram #2421): knowledge-base actions (upload, list, delete, re-index, health), the knowledge page with status polling and the "re-indexación requerida" banner, plus the PR3.2 carry-forwards that must land before uploads are exposed.
Branch: `feat/whatsapp-m3-kb-ui` (base master). Delivery: stacked-to-main. Runner: `pnpm vitest run <path>`, plus `pnpm exec tsc --noEmit`.

## Specs
- S1 (3.3.1) "`lib/actions/__tests__/knowledge.actions.test.ts`: USER denied on upload/list/delete/reindex (S-KB-1, KB-1); >`KB_UPLOAD_MAX_BYTES` and bad MIME/extension rejected (KB-2); upload stores R2 `knowledge/{docId}/{name}` with uploader+timestamp and enqueues `kb.ingest` (KB-11); delete removes chunks in the same action (KB-7, S-KB-5); reindex enqueues; `health` returns REINDEX_REQUIRED when configured model has no chunks while older-model chunks exist (S-KB-8)." Access per amendment #2427: `requireWhatsAppAuth()`.
- S2 (3.3.2) "Create `lib/actions/knowledge.actions.ts`, `lib/validations/knowledge.schema.ts`, `lib/types/knowledge.types.ts`."
- S3 (3.3.3) "Create `app/dashboard/knowledge/page.tsx`, `components/dashboard/knowledge/*` (upload, status badges, polling for status, delete confirm, re-index, \"re-indexación requerida\" banner, skeletons); sidebar entry in `components/dashboard/app-sidebar.tsx` (MANAGER/SUPER_ADMIN)."
- S4 (PR3.2 carry-forwards, Engram #2461 L11, "MUST, before uploads are exposed"): "cap DOCX decompressed size (zip bomb, R1-docx-unzip-cap); classify missing/oversized R2 object as permanent (R3-storage-permanent-as-transient); enqueue kb.ingest with a per-document singletonKey."
- Acceptance: KB-1, KB-2, KB-7, KB-9, KB-11; S-KB-1/5/8.

## Tasks
- [x] T1 S4 carry-forwards (DOCX cap, permanent storage errors, per-document dedupe) — inline (RED 5 → GREEN; dedupe lands with T2 reindex claim) — eba876c
- [x] T2 S1-S2 knowledge service, actions, upload route — inline (RED modules missing → GREEN documents 17, actions 16, route 6) — 41d6ce7
- [x] T3 S3 knowledge page, components, navigation, docs — inline (status helpers 5/5, test+impl together; no component tests in repo)

## Log
- L1 (2026-10-20, user): "si" (go ahead with PR3.3).
- L2 Decision (S4 "per-document singletonKey"): on pg-boss's `standard` policy a `singletonKey` does not deduplicate, and the existing prod `kb.ingest` queue cannot change policy (`createQueue` is a no-op when it exists; `updateQueue` takes no policy). Dedupe is done in the app instead: upload enqueues once; re-index claims the document with a conditional `updateMany` (READY/FAILED, or PENDING/PROCESSING untouched for 15 min) before enqueueing. The PR3.2 row lock still prevents duplicate chunks if two runs overlap.
- L3 Decision (S3 page path): the page lives at `/dashboard/whatsapp/knowledge`, not `/dashboard/knowledge`, so the existing WhatsApp middleware gate and layout guard (`canAccessWhatsApp`, SUPER_ADMIN) cover it; there is no separate sidebar entry (the inbox header links to it, like Leads).
- L4 Uploads go through a route handler (`POST /api/whatsapp/knowledge`): Server Actions cap bodies at 1 MB and KB files go up to 15 MB (same reason as the media route).
- L5 Build warning found and fixed: webpack "Critical dependency: Accessing import.meta directly" from unpdf once the upload route imports it. `unpdf` and `mammoth` added to `serverExternalPackages` (next.config.mjs); warning gone. Smoke on `next start` build: page 307 → /login, unauthenticated upload POST → 401 after the route's module graph (incl. unpdf) loaded.
- L6 Suite 2031/2032 (pre-existing send.test failure), build OK. Risk: item 2 (new upload endpoint for untrusted files behind the access guard) and item 5 (next.config serverExternalPackages).
