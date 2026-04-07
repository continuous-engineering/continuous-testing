# BUNDLE D — Semantic Scoring with Local Embeddings
**Tasks:** D1–D4 | **Started:** 2026-04-07 | **Started-At:** 2026-04-07T00:00:00
**Status:** complete | **Est:** 60min | **Actual:** 30min | **Model:** sonnet

## Plan
- [x] D1 — src/scorer.js — cosine similarity via @xenova/transformers (Size: M)
- [x] D2 — Replace keywordScore in executor.js with scorer.js (Size: S)
- [x] D3 — IPC channels scorer:ready + scorer:progress in main.js (Size: S)
- [x] D4 — UI badge in sidebar showing scorer status (Size: S)

## Execution Log

### D1 — src/scorer.js
Singleton module: init(onProgress) + score(expected, actual).
Model: Xenova/all-MiniLM-L6-v2 (quantized ONNX, ~23MB).
Cache dir: userData/models in prod, default Xenova cache in dev.
Concurrent init() calls wait on same promise (loadListeners pattern).
Falls back to keywordScore on model load failure or 500ms timeout.

### D2 — executor.js
Removed local keywordScore function. Added require('./scorer').
executeTest now calls await scorer.score(expected, text) — async.

### D3 — main.js
warmUpScorer() called after ready-to-show to avoid blocking window display.
Sends scorer:progress(pct) and scorer:ready IPC events to renderer via mainWindow.webContents.send.

### D4 — index.html + app.js
Added scorer status section at bottom of sidebar: dot indicator + label.
app.js: onScorerProgress updates dot to orange + shows download %. onScorerReady turns dot green + "Ready".
Guard: if window.electronAPI is undefined (browser mode), IPC block is skipped — no errors.

## Files Changed
- src/scorer.js (new)
- src/executor.js (replaced keywordScore with scorer.score)
- main.js (warmUpScorer + IPC send)
- static/index.html (scorer badge in sidebar)
- static/app.js (IPC listeners at top of file)

## Blockers — (none)

## Decisions
- Scorer warm-up deferred to after ready-to-show — window opens instantly, model loads in background
- 500ms fallback timeout in score() for first call — if model still loading, keyword overlap used (consistent with Bundle C behavior during warmup)
- Model cached in userData/models — survives app updates, downloaded once
- keywordScore preserved in scorer.js as fallback and export for tests
