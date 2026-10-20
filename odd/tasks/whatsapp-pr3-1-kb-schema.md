# Feature: whatsapp-pr3-1-kb-schema
Objective: PR3.1 of the SDD change `whatsapp-ai-assistant` (Engram #2421): knowledge-base schema with raw pgvector/FTS indexes, a migration guard, and AI provider modules. Everything stays behind `WHATSAPP_AI_ENABLED=false`.
Branch: `feat/whatsapp-m3-kb-schema` (base master). Delivery: stacked-to-main. Runner: `pnpm vitest run <path>`, plus `pnpm exec tsc --noEmit`.

## Specs
- S1 (3.1.1) "Create `lib/__tests__/migration-guard.test.ts`: later migrations never drop the HNSW/GIN index names (`knowledge_chunks_embedding_hnsw`, `knowledge_chunks_content_fts`); the extension migration exists before the KB migration (timestamp order). (XC-3, D13)"
- S2 (3.1.2) "Edit `prisma/schema.prisma`: enum KnowledgeDocumentStatus, models KnowledgeDocument, KnowledgeChunk (`embedding Unsupported(\"vector(1536)\")?`, embeddingModel, embeddingDimensions), `User` back-relation. Migration via `--create-only`; hand-append HNSW `vector_cosine_ops`, GIN `to_tsvector('spanish', content)`, RLS. Verify `migrate dev` drift behaviour on raw indexes; fallback is exact scan (record result)." Model per design #2419.
- S3 (3.1.3) "Create `lib/ai/__tests__/providers.test.ts`: `chatModel()` reads Anthropic and `AI_CHAT_MODEL`; `embeddingModel()`/`transcriptionModel()` OpenAI; fail with clear error when keys missing and AI enabled; no import-time env reads. (A11, D20)"
- S4 (3.1.4) "Add deps `ai` (v5), `@ai-sdk/anthropic`, `@ai-sdk/openai` in `package.json`; create `lib/ai/providers.ts`. Verify exact AI SDK 5 API names with context7."
- Acceptance: KB-4, KB-6, A11, XC-3. [OPS] `pnpm db:deploy` by hand on production BEFORE merge (repo rule: backup first).

## Tasks
- [x] T1 S1 migration guard — inline (RED 2 failing → GREEN 3/3)
- [x] T2 S2 schema + migration (HNSW, GIN, RLS) — inline (migration 20261020120000_knowledge_base applied locally; indexes and RLS verified in pg_indexes/pg_class)
- [x] T3 S3-S4 providers + deps — inline (RED module missing → GREEN 7/7; real v7 packages construct models offline)

## Log
- L1 (2026-10-20, user): "listo sigamos" (continue the plan: M3 starts with PR3.1).
- L2 Decision (technical, deviation from S4 "v5"): use AI SDK v7 (`ai@7`, `@ai-sdk/anthropic@4`, `@ai-sdk/openai@4`). v7 is stable since 2026-06-25; v5 is two majors behind. All three majors need `zod ^3.25.76`, so zod goes from 3.25.67 to the latest 3.25.x patch. APIs verified with context7 (/vercel/ai/ai_7.0.0): `createAnthropic({ apiKey })`, `createOpenAI({ apiKey })`, `.embedding(id)` with `providerOptions.openai.dimensions`, `.transcription(id)` with `transcribe()` (no longer experimental).
- L3 Provider split is the user's decision Q11 (#2416): Claude via `@ai-sdk/anthropic` for chat/vision, OpenAI for embeddings and STT. Not reopened.
- L4 Carry-forward for PR3.6b: with `claude-opus-5-5` (the recommended `AI_CHAT_MODEL`), forced tool choice (`toolChoice: 'required'` maps to Anthropic `any`) and `temperature` return HTTP 400. The design's `toolChoice:'required'` and temperature 0.2 must change to `auto` + prompt instruction (+ `strict`), no temperature.
- L5 Route: inline (one writer, units depend on each other).
- L6 Drift result (S2 asked to record it): after applying, `prisma migrate diff` (DB → schema) proposes `DROP INDEX knowledge_chunks_embedding_hnsw` (Prisma cannot express HNSW); the GIN index is not reported. Plus the known servicios_alegra FK drift, stripped from the migration as in earlier PRs. Mitigation: migration guard + CLAUDE.md note. Exact-scan fallback not needed.
- L7 SQL generated with `prisma migrate diff --from-url <local> --to-schema-datamodel` instead of `migrate dev --create-only` (migrate dev hangs on the servicios_alegra drift, Engram #2430).
- L8 Risk: item 1 (persisted format: new tables and raw indexes in production) and item 5 (dependencies: ai@7, @ai-sdk/*@4, zod patch 3.25.67→3.25.76).
