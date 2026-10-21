# Feature: whatsapp-pr3-5-stt
Objective: PR3.5 of the SDD change `whatsapp-ai-assistant` (Engram #2421): media policy for the assistant, speech-to-text for WhatsApp voice notes (`ai.transcribe`), and AI usage records with cost estimates. No migration (tables and enums exist since PR1.1).
Branch: `feat/whatsapp-m3-stt` (base master). Delivery: stacked-to-main. Runner: `pnpm vitest run <path>`, plus `pnpm exec tsc --noEmit`.

## Specs
- S1 (3.5.1) "`lib/ai/__tests__/media-policy.test.ts`: `classifyMedia` audio<=10 min TRANSCRIBE; jpeg/png/webp<=5 MB VISION_IMAGE; PDF<=10 MB VISION_PDF; video/sticker/location/contacts/animated/DOCX/XLSX UNSUPPORTED; oversize TOO_LARGE (MH-6, S-MH-4/5). (GREEN) `lib/ai/responder/media-policy.ts`."
- S2 (3.5.2) "`lib/ai/__tests__/transcribe.test.ts` (mock STT): claim via `updateMany where {id, transcriptStatus: null}` so redelivery never double-transcribes (S-MH-7, MH-10); success persists transcript + logs `AiUsageRecord{kind TRANSCRIPTION, audioSeconds}` (MH-3, AI-13, S-MH-1); provider error/empty/>10 min retries (retry 2) then `transcriptStatus FAILED` (MH-4, S-MH-2) without blocking the conversation."
- S3 (3.5.3) "Create `lib/ai/transcribe.ts`, `lib/ai/responder/usage.ts` (record helpers incl. cost estimate), register `ai.transcribe` worker; connect the PR1.5 port (audio STORED -> enqueue)."
- S4 (3.5.4) "Surface transcript / \"transcripción fallida\" in thread (edit `components/dashboard/whatsapp/*` bubble) — covered by existing S-WI-7 manual check."
- Acceptance: MH-3, MH-4, MH-6, MH-10, AI-13; S-MH-1/2/4/5/7.

## Tasks
- [ ] T1 S1 media policy — inline
- [ ] T2 S2-S3 usage records, transcription, worker + port, docs — inline
- [ ] T4 S4 — already shipped in PR2.2 (`components/dashboard/whatsapp/message-media.tsx` `Transcript`: DONE text, «Transcripción fallida», «Transcribiendo…»); this PR makes the inbox refresh it

## Log
- L1 (2026-10-20, user): "si" (go ahead with PR3.5).
- L2 Decision: transcription is an AI call, so it runs only with `WHATSAPP_AI_ENABLED=true` (both when enqueueing and when the job runs, so turning the flag off stops queued jobs). With the flag off, audio stays untranscribed (`transcriptStatus` null) and staff listen to it. Knowledge-base ingestion stays the only model call that runs with AI off (an explicit manager action, PR3.2).
- L3 Inbox refresh: thread polling reads messages by `whatsapp_messages.updatedAt`; media rows do not touch it, so every transcript state change also bumps the message's `updatedAt`.
- L4 Route: inline (one writer).
