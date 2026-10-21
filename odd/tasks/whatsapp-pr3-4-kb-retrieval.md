# Feature: whatsapp-pr3-4-kb-retrieval
Objective: PR3.4 of the SDD change `whatsapp-ai-assistant` (Engram #2421): hybrid retrieval over the knowledge base (pgvector cosine + Spanish full-text, fused with RRF) with explicit status results, plus a manual evaluation script. No migration, no UI; the AI responder (PR3.6) is the consumer.
Branch: `feat/whatsapp-m3-kb-retrieval` (base master). Delivery: stacked-to-main. Runner: `pnpm vitest run <path>`, plus `pnpm exec tsc --noEmit`.

## Specs
- S1 (3.4.1) "Create `lib/knowledge/__tests__/rrf.test.ts`: `fuseRrf(vector,keyword,k=60)` ranking, ties, one-sided lists. (GREEN) `lib/knowledge/rrf.ts`."
- S2 (3.4.2) "Create `lib/knowledge/__tests__/retrieve.test.ts` (mock `$queryRaw`): vector top 20 + FTS top 20 (`websearch_to_tsquery('spanish')`) fused, top 6 with similarity, rrfScore, document ref; filters `isActive` and `embeddingModel`+`embeddingDimensions` equal config (never mixes, KB-6); below `AI_MIN_SIMILARITY` with no FTS hit -> `NO_SUFFICIENT_MATCH` (KB-10, S-KB-7); older-model-only chunks -> `REINDEX_REQUIRED`; deleted doc never returned (S-KB-5)."
- S3 (3.4.3) "Create `lib/knowledge/retrieve.ts`; create `scripts/eval-assistant.ts` skeleton (loads eval set JSON, reports sources/scores; run manually)."
- Contract (design #2419): `RetrievalResult = { status: 'OK'; chunks: RetrievedChunk[]; topSimilarity: number } | { status: 'NO_SUFFICIENT_MATCH'; topSimilarity: number | null } | { status: 'REINDEX_REQUIRED' }`.
- Acceptance: KB-5, KB-6, KB-10; S-KB-5/7/8.

## Tasks
- [x] T1 S1 RRF — inline (RED module missing → GREEN 7/7) — 8a1212d
- [x] T2 S2-S3 retrieval, eval script, docs — inline (RED module missing → GREEN 13/13)

## Log
- L1 (2026-10-20, user): "si" (go ahead with PR3.4).
- L2 Probe on local pgvector 0.8.7 (scratch DB, dropped): 20 000 vectors, 2% of them with the current model. Filtered `ORDER BY embedding <=> q LIMIT 20` returned 1 row with iterative scan off (ef_search 40) and 20 rows with `SET LOCAL hnsw.iterative_scan = relaxed_order` + `hnsw.ef_search = 100`, still an Index Scan on the HNSW index. Retrieval therefore runs inside a transaction that sets both. `relaxed_order` can return slightly unordered rows, so results are re-sorted by distance.
- L3 Carry-forward from PR3.2/PR3.3: chunks store `embeddingModel = openai/<model>` (`embeddingModelKey`); retrieval filters by that key and `embeddingDimensions`. Documents being re-indexed keep serving their previous chunks, so retrieval filters on `isActive` only, not on status.
- L4 Route: inline (one writer).
- L5 Real-DB probe (rows created and removed in local `admon`): inactive document excluded; old-model chunk excluded; nearest chunk first with similarity 1.000; keyword "afiliaciones empleados" matched "afiliar a un empleado" (Spanish stemming, GIN expression). `pnpm eval:assistant` loads the full module graph and fails cleanly without OPENAI_API_KEY ("[ai] OPENAI_API_KEY is not configured", exit 2).
- L6 Decisions: vector matches below AI_MIN_SIMILARITY are dropped from the fused list, keyword hits always count; `topSimilarity` is the max over both lists. REINDEX_REQUIRED reuses `getKnowledgeHealth` (shared with the page) when nothing matches.
- L7 Full suite: 2 failures, neither from this change: the known `send.test.ts` retry-limit one, and `lib/auth/__tests__/login-grant.test.ts > el permiso vence pronto` (timing-based, flaky under full-suite load; lib/auth unchanged vs master; passes 3/3 alone). Assess: medium, review not due (under_budget). Risk: none (read-only parameterized queries; no migration, no dependency).
