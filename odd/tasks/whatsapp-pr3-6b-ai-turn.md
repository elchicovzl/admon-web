# Feature: whatsapp-pr3-6b-ai-turn
Objective: PR3.6b of the SDD change `whatsapp-ai-assistant` (Engram #2421): the `ai.turn` job that answers WhatsApp clients with Claude, wiring the PR3.6a pure modules, retrieval (PR3.4), transcripts (PR3.5) and the outbox. Stays off behind `WHATSAPP_AI_ENABLED` and `WhatsAppSettings.aiEnabled`. No migration.
Branch: `feat/whatsapp-m3-ai-turn` (base master). Delivery: stacked-to-main. Runner: `pnpm vitest run <path>`, plus `pnpm exec tsc --noEmit`.

## Specs
- S1 (3.6.7, kill switches) "kill switch off (env, DB `aiEnabled`, `aiPaused`) -> SKIPPED, no send, queued job no-ops (AI-1, AI-12, S-AI-9)".
- S2 (race) "state flips to HUMAN during LLM call -> commit tx `SELECT ... FOR UPDATE` finds not AI -> DISCARDED, usage still logged (CH-5, S-CH-2, S-AI-8); newer inbound arrived -> DISCARDED, job re-runs combined batch, proceeds after 2 discards".
- S3 (staleness, caps, cursor) "reply older than `AI_MAX_REPLY_AGE_MINUTES` skipped (threat: stale replay); daily cap reached -> escalate; duplicate/already-answered inbound (cursor `aiCursorAt`) -> no second reply (S-AI-13)".
- S4 (provider failure) "provider throws after `maxRetries` -> records FAILED, ESCALATED(AI_FAILURE), one neutral holding message, AI_FAILURE notification, pg-boss does not retry (AI-14, S-AI-11)".
- S5 (consent) "consent prefix on first substantive reply, stored `consentNoticeSentAt` only when carrier reaches SENT, FAILED carrier -> next turn prefixes again and no substantive answer is delivered without notice (AI-5, S-AI-12)".
- S6 (handoff) "USER_REQUEST in hours -> ESCALATED + \"Un asesor lo atenderá en breve\" + notifications; Saturday -> out-of-hours text, `escalatedOutOfHours`, `attentionDueAt=nextBusinessSlot`, Notification still sent (AI-9, S-AI-4/5, NT-3); AI_ESCALATE while HUMAN rejected (S-CH-8)". (PR4.2 dropped: no email.)
- S7 (media) "unsupported-only batch -> deterministic reply with NO LLM call, failure count++, DOCUMENT_REVIEW at cap (S-MH-4/5); transcription failed -> asks client to write (S-MH-2)"; images and PDFs within the media policy are given to the model (MH-5).
- S8 (records) "stored message has source AI, `sourceChunkIds`, `usageRecordId` (AI-16); usage has model, tokens, tool calls, retrieval scores (AI-13)".
- S9 (3.6.8) "`lib/ai/responder/turn.ts` (generateText with `toolChoice:'required'`, `stopWhen: stepCountIs(4)`, `maxOutputTokens 600`, temperature 0.2, `maxRetries 2`), register `ai.turn` stately worker (singletonKey conversationId, startAfter 8); wire inbound to schedule the turn only when `aiEffective` and state AI; send path sets consent fields via `onSent` hook from PR1.4; EscalationReason used by `transitions`."
- S10 (3.6.9) manual harness (AI on in dev with the test number) — PENDING-OPERATOR.

## Tasks
- [x] T1 S9 plumbing: schedule `ai.turn` from inbound (incl. first contact and reopen into AI), worker + enqueue, `onSent` hook (consent evidence, `lastAiSentAt`) — inline (RED 1 + 2 modules missing → GREEN) — 15f3663
- [x] T2 S5-S8 commit layer: deterministic texts, FOR UPDATE commit of a reply / escalation, chat usage records — inline (RED modules missing → GREEN texts 3, commit 12; chat usage recorder written with its test) — b49220f
- [x] T3 S1-S8 turn orchestration (pre-checks, model call, guard, failure path) — inline (RED module missing → GREEN turn 21; worker 9 written with its implementation; real AI SDK loop 2)
- [ ] T4 docs, full checks, independent verifier (3 blockers → fix 8df7c0f, recheck pending), RDD review — inline

## Log
- L1 (2026-10-20, user): "si" (go ahead with PR3.6b).
- L2 Explorer map (2026-10-20): nothing enqueues `ai.turn`; `scheduleAiTurn` is dropped in `persistMessage` (inbound.ts:290) and only true for AI→AI (state-machine.ts:117), not for first contact or CLOSED→AI reopen; `onSent` hook exists (send.ts:200-205) but nothing registers it; nothing writes `lastAiSentAt` (echoes rely on it); `applyTransition` never notifies (producer sends ESCALATION/AI_FAILURE after commit; dedup `escalation:<id>:<escalatedAt>`, `ai-failure:<id>`); AI sends must pass `expectedStateVersion` (send job fails STALE_STATE otherwise) and only template messages bypass the 24 h window.
- L3 Deviations from S9 (model constraint, PR3.1 L4 / PR3.6a L2): no `toolChoice:'required'` and no `temperature` (400 on claude-opus-5-5 / claude-sonnet-5-5). Use `toolChoice:'auto'`, strict tools, `stopWhen: [isStepCount(AI_MAX_STEPS), hasToolCall('sendReply'), hasToolCall('escalateToHuman')]`, `maxOutputTokens 600`, `maxRetries 2`, `providerOptions.anthropic.effort = 'medium'`. Verified in the installed packages: `isStepCount`, `stepCountIs`, `hasToolCall`, `tool` exported by ai@7.0.147; `effort` is an @ai-sdk/anthropic@4.0.84 provider option; user content accepts `ImagePart {type:'image', image, mediaType}` and `FilePart {type:'file', data, mediaType}`.
- L4 Route: inline (one writer; units depend on each other).
- L5 Added `EscalationReason.TURN_LIMIT` for AI_MAX_TURNS_PER_DAY (stored as a string, no migration). Daily limit counts AI outbound messages in the last 24 h.
- L6 Real checks beyond mocks: the commit's `SELECT … FOR UPDATE` ran against the local DB (BEGIN/ROLLBACK, no change); the real AI SDK loop with `MockLanguageModelV4` (ai/test) confirmed a terminal tool without `execute` ends the loop after sendReply/escalateToHuman and `steps[].toolCalls` carries `toolName` + parsed `input`.
- L7 Not done: a real Claude call (no ANTHROPIC_API_KEY locally) — S10 manual harness and the eval set stay PENDING-OPERATOR.
- L8 Independent verifier (high risk: items 4 concurrency, 1 stored data): S4-S9 pass; 3 blockers. (1) S1: the AI switch was not re-read at commit. (2) S2: "proceeds after 2 discards" was ineffective, because the stately queue drops the worker's re-enqueue when an inbound message has already queued a job, losing the count carried in job data. (3) S3: a CLOSED→AI reopen replayed the staff-handled backlog. Advisories fixed in the same batch: the second-resolution `timestamp` cursor, now `createdAt`; SDK-invalid tool calls are now ignored; reserved escalation reasons from the model now map to LOW_CONFIDENCE; the guard no longer crashes when `sourceIds` is missing; a cap of 4 attachments per turn; a note for a failed voice note sent with text; TURN_LIMIT no longer counts FAILED sends; the commit comment about pause. Not fixed: the escalateToHuman summary is still unused, and a crash between commit and enqueue (pre-existing pattern).
- L9 Correction batch `8df7c0f`. Fixes:
  - `checkStillOurs` re-reads `isAiGloballyEnabled(tx)` under the lock (an AI_FAILURE escalation still goes through).
  - Discards are counted from `ai_usage_records` (CHAT_TURN, DISCARDED, error NEWER_INBOUND, since the oldest pending `createdAt`). The job data no longer carries them.
  - A reopen sets `aiCursorAt = createdAt - 1 ms` in the inbound transaction.
  - The turn reads the newest 50 messages by `createdAt`.

  Checks:
  - `pnpm vitest run lib/ai lib/whatsapp lib/queue`: 770/771 (the one failure is the base's `send.test` retry-limit test).
  - Full suite: 2219/2220 (same failure).
  - `tsc`: no errors in the touched files; 35 errors in unrelated modules were already there.
