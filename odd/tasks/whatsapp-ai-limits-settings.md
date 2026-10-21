# Feature: whatsapp-ai-limits-settings
Objective: AI cost and abuse limits editable by a SUPER_ADMIN in Configuración → WhatsApp: a global daily spend cap (new), AI replies per number per day, consecutive failures before escalating, forbidden topics; and no voice-note transcription for escalated or over-limit conversations.
Branch: `feat/whatsapp-ai-limits-settings` (base master a60508a). Delivery: stacked-to-main. Runner: `pnpm vitest run <path>`, plus `pnpm exec tsc --noEmit`. Migration: additive columns on `whatsapp_settings`; prod `db:deploy` with backup BEFORE merge.

## Specs
- S1 User choice "Costo y abuso (Recomendado)": "Tope de gasto diario global en USD (nuevo), respuestas de IA por número por día, fallas seguidas antes de escalar, temas prohibidos, y no transcribir audios en conversaciones escaladas o que pasaron el tope."
- S2 "debemos tener en la configuracion estos settings sean modificables coloca una seccion de wassapp para eso": a WhatsApp section in `/dashboard/settings`, SUPER_ADMIN only (role read from the database).
- S3 Precedence (assumption, stated to the user): a value saved in the database wins; an empty field falls back to the server env (`AI_MAX_TURNS_PER_DAY`, `AI_MAX_CONSECUTIVE_FAILURES`). Forbidden topics = env list plus the saved list. No daily cap when empty.
- S4 Daily spend = sum of `ai_usage_records.estimatedCostUsd` since Bogota midnight (same day as "Uso de IA"). At or over the cap, a turn escalates without calling the model (new reason BUDGET_LIMIT) and transcriptions of conversations the AI attends are skipped (see S5).
- S5 Transcription is skipped when the conversation is ESCALATED, when its AI replies in the last 24 h reached the per-number limit, or when the daily cap is reached. HUMAN conversations keep transcribing (advisors use the transcript), even past the per-number limit or the daily cap.
- S6 Keys, models and the `WHATSAPP_ENABLED` / `WHATSAPP_AI_ENABLED` flags stay in env.

## Tasks
- [x] T1 S3-S4 schema + migration + `lib/ai/limits.ts` + tests — inline (RED module missing → GREEN 10; migration applied locally, `migrate diff` clean) — 48cf205
- [x] T2 S4 turn uses effective limits + BUDGET_LIMIT; S5 transcription gate — inline (RED 4 + 3 → GREEN, 177 AI tests) — d9ced1d
- [x] T3 S2 actions (get/update, SUPER_ADMIN) + settings form + docs — inline (RED → GREEN 108; limits module run against local Postgres, row restored)
- [ ] T4 checks, prod migration (backup first), verifier (Risk items 1 and 2), RDD

## Log
- L1 (2026-10-20, user): "si debemos tener en la configuracion estos settings sean modificables coloca una seccion de wassapp para eso"
- L2 (2026-10-20, user) scope answer: "Costo y abuso (Recomendado)".
- L3 Route: inline (one behavior chain; units depend on each other). Risk: item 1 (new persisted columns, prod migration) and item 2 (SUPER_ADMIN-only settings that control spend).
- L4 Checks: full suite 2273 pass, 1 fail = known pre-existing `send.test.ts` retry-limit. tsc 35 errors, all pre-existing, none in touched files. Settings page not rendered with a login (local seed login fails).
- L5 `prisma format` reformatted the whole schema; reverted and kept only the WhatsAppSettings columns (aligned by hand).
- L6 Independent verifier: S1-S4, S6 MET; S5 NOT MET (B1: HUMAN conversations stopped transcribing past the per-number limit or the cap, e.g. TURN_LIMIT → Atender → HUMAN). Fixed: HUMAN never skips; regression tests for both cases; S4/S5 wording aligned with what the user was told ("en HUMAN sí, el asesor usa la transcripción"). Migration verified additive on a singleton row with aiEnabled=true (BEGIN/ROLLBACK). Advisories accepted: topic limits count raw lines, reused denial message, skipped notes keep a null transcript state.
- L7 Prod backup before migration: `~/Documents/admon-backups/admon-prod-20261020-2330-pre-ai-limits.dump` (pg_dump 18 from the local admon-postgres container; local pg_dump 17 cannot dump a v18 server).
- L8 Prod migration applied 2026-10-20 23:3x (45/45, none pending); row unchanged: aiEnabled=true, new columns null/{}. Isolated Prisma config in the scratchpad (repo prisma.config.ts overrides with .env.local), deleted after use.
