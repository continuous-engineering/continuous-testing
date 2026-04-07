# BUNDLE D — Semantic Scoring with Local Embeddings
**Tasks:** D1–D4 | **Started:** 2026-04-07 | **Started-At:** 2026-04-07T00:00:00
**Status:** in_progress | **Est:** 60min | **Model:** sonnet

## Plan
- [ ] D1 — src/scorer.js — cosine similarity via @xenova/transformers (Size: M)
- [ ] D2 — Replace keywordScore in executor.js with scorer.js (Size: S)
- [ ] D3 — IPC channels scorer:ready + scorer:progress in main.js (Size: S)
- [ ] D4 — UI badge in sidebar showing scorer status (Size: S)

## Execution Log

## Files Changed

## Blockers — (none)

## Decisions
- Model: Xenova/all-MiniLM-L6-v2 (ONNX, ~23MB, CPU-only)
- Scorer is singleton — lazy-loaded on first score() call
- main.js wires up IPC events during scorer warm-up
- UI badge added to sidebar in index.html via JS injection from app.js
- Falls back to keywordScore if model not yet loaded
