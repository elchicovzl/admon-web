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
- [ ] T1 S1 chunker — inline
- [ ] T2 S2 extraction + deps — inline
- [ ] T3 S3-S4 ingest job, vector insert, worker registration, docs — inline

## Log
- L1 (2026-10-20, user): "si vamos con PR3.2"
- L2 Dependencies: `unpdf@1.8.1` (2026-08-13; 1.9.x is days old, skipped on purpose) and `mammoth@1.13.0` (2026-09-26). `@napi-rs/canvas` peer is optional (rendering only), not installed.
- L3 Route: inline (one writer; units depend on each other).
