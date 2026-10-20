# Feature: whatsapp-pr3-2-kb-ingest
Objective: PR3.2 of the SDD change `whatsapp-ai-assistant` (Engram #2421): text extraction (PDF, DOCX, TXT, MD), heading-aware chunking, and the `kb.ingest` job that embeds chunks into `knowledge_chunks`. No migration. Behind `WHATSAPP_ENABLED` (queue boot) like every job.
Branch: `feat/whatsapp-m3-kb-ingest` (base master). Delivery: stacked-to-main. Runner: `pnpm vitest run <path>`, plus `pnpm exec tsc --noEmit`.

## Specs
- S1 (3.2.1) "Create `lib/knowledge/__tests__/chunk.test.ts`: heading-aware, ~600 token target (chars/4), 800 max, ~80 overlap, ordinal metadata, deterministic. (KB-4) (GREEN) `lib/knowledge/chunk.ts`."
- S2 (3.2.2) "Create `lib/knowledge/__tests__/extract.test.ts` with fixtures: text PDF extracts; image-only PDF -> failure message \"El PDF no contiene texto extraíble (posiblemente escaneado). OCR no está soportado.\" (S-KB-3, KB-3); DOCX headings preserved; TXT/MD as-is; .xlsx rejected (S-KB-4, KB-2). (GREEN) Add deps `unpdf`, `mammoth`; create `lib/knowledge/extract.ts`."
- S3 (3.2.3) "Create `lib/knowledge/__tests__/ingest.test.ts` (mock prisma/embedMany): status PENDING->PROCESSING->READY with chunks+embeddings recording provider/model/dimension (S-KB-2); empty extraction -> FAILED zero chunks never indexed; embedding API down -> retry then FAILED retriable and PRIOR chunks remain (S-KB-9); replace is one `$transaction` delete-old+insert-new (KB-8, S-KB-6); batches of 64."
- S4 (3.2.4) "Create `lib/knowledge/ingest.ts`, `lib/knowledge/vector.ts` (`$executeRaw` insert with `::vector`), register `kb.ingest` worker (retry 2)."
- Acceptance: KB-2, KB-3, KB-4, KB-8, KB-9; S-KB-2/3/4/6/9.

## Tasks
- [x] T1 S1 chunker — inline (RED module missing → GREEN 10/10) — f05b43e
- [x] T2 S2 extraction + deps — inline (RED module missing → GREEN 10/10; fixtures generated: text.pdf, image-only.pdf, headings.docx) — f05b43e
- [x] T3 S3-S4 ingest job, vector insert, worker registration, docs — inline (RED modules missing → GREEN ingest 12, vector 4, worker 4, providers +1, bootstrap +1)

## Log
- L1 (2026-10-20, user): "si vamos con PR3.2"
- L2 Dependencies: `unpdf@1.8.1` (2026-08-13; 1.9.x is days old, skipped on purpose) and `mammoth@1.13.0` (2026-09-26). `@napi-rs/canvas` peer is optional (rendering only), not installed.
- L3 Route: inline (one writer; units depend on each other).
- L4 Deviation (S4 wording "`$executeRaw` insert with `::vector`"): chunks are inserted with `createManyAndReturn` (keeps Prisma cuid ids) and their vectors set with ONE raw `UPDATE ... FROM (VALUES ...)` per batch of 64 (`setEmbeddingsSql`), inside the same transaction. Same `::vector` raw path, fewer statements.
- L5 Provider key: chunks store `embeddingModel = "openai/<AI_EMBEDDING_MODEL>"` (`embeddingModelKey`), so the provider is recorded (S3) and retrieval (PR3.4) must compare with the same key.
- L6 Integration probe against local pgvector (script under node_modules/.cache, removed): createManyAndReturn + setEmbeddingsSql updated 3 rows; nearest-neighbour by `<=>` returned the right chunk (similarity 1); Spanish FTS matched "afiliaciones" against "afiliación" (stemming); delete cascaded to 0 chunks.
- L7 Who enqueues `kb.ingest` (upload/reindex actions) is PR3.3. Risk: item 5 (new dependencies unpdf, mammoth).
- L8 Independent verifier: S1-S4 PASS, no blockers (real pgvector: 300 chunks in batches 64x4+44, reindex 300->1, 3000 chunks in ~3.6 s; supply chain: no install scripts in 21 new transitive packages).
- L9 Fixed verifier advisories (RED 4 → GREEN 45/45): A1 a failed replacement transaction or non-finite vector on the last attempt now marks FAILED+retriable (was stuck PROCESSING); A2 the document row is locked `FOR UPDATE` before delete+insert (real-DB probe: two concurrent replaces left 200 rows without the lock, 100 with it); A3 `maxTokens` is honoured (packed body capped at min(target, max - overlap)).
- L10 Not fixed (advisories, recorded): A4 extraction quality (nested list items glued, table rows flattened, `# C#` heading loses `#`, headings inside code fences, Latin-1 TXT, `application/x-pdf`/zip MIME rejected, no DOCX unzip cap); A5 an oversized/missing R2 object is classified as transient and retried.
