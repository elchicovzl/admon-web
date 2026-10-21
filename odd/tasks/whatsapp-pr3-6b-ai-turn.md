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
- [ ] T1 S9 plumbing: schedule `ai.turn` from inbound (incl. first contact and reopen into AI), worker + enqueue, `onSent` hook (consent evidence, `lastAiSentAt`) — inline
- [ ] T2 S5-S8 commit layer: deterministic texts, FOR UPDATE commit of a reply / escalation, chat usage records — inline
- [ ] T3 S1-S8 turn orchestration (pre-checks, model call, guard, failure path) — inline
- [ ] T4 docs, full checks, independent verifier, RDD review — inline

## Log
- L1 (2026-10-20, user): "si" (go ahead with PR3.6b).
- L2 Explorer map (2026-10-20): nothing enqueues `ai.turn`; `scheduleAiTurn` is dropped in `persistMessage` (inbound.ts:290) and only true for AI→AI (state-machine.ts:117), not for first contact or CLOSED→AI reopen; `onSent` hook exists (send.ts:200-205) but nothing registers it; nothing writes `lastAiSentAt` (echoes rely on it); `applyTransition` never notifies (producer sends ESCALATION/AI_FAILURE after commit; dedup `escalation:<id>:<escalatedAt>`, `ai-failure:<id>`); AI sends must pass `expectedStateVersion` (send job fails STALE_STATE otherwise) and only template messages bypass the 24 h window.
- L3 Deviations from S9 (model constraint, PR3.1 L4 / PR3.6a L2): no `toolChoice:'required'` and no `temperature` (400 on claude-opus-5-5 / claude-sonnet-5-5). Use `toolChoice:'auto'`, strict tools, `stopWhen: [isStepCount(AI_MAX_STEPS), hasToolCall('sendReply'), hasToolCall('escalateToHuman')]`, `maxOutputTokens 600`, `maxRetries 2`, `providerOptions.anthropic.effort = 'medium'`. Verified in the installed packages: `isStepCount`, `stepCountIs`, `hasToolCall`, `tool` exported by ai@7.0.147; `effort` is an @ai-sdk/anthropic@4.0.84 provider option; user content accepts `ImagePart {type:'image', image, mediaType}` and `FilePart {type:'file', data, mediaType}`.
- L4 Route: inline (one writer; units depend on each other).
