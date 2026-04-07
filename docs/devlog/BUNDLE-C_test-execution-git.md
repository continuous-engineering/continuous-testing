# BUNDLE C — Test Execution, Git, Logs
**Tasks:** C1–C5 | **Started:** 2026-04-07 | **Started-At:** 2026-04-07T00:00:00
**Status:** complete | **Est:** 90min | **Actual:** 50min | **Model:** sonnet

## Plan
- [x] C1 — src/routes/test-plans.js (Size: S)
- [x] C2 — src/routes/test-runs.js — async execution + score (Size: L)
- [x] C3 — src/routes/probe.js (Size: S)
- [x] C4 — src/routes/git.js — all 6 ops via simple-git (Size: M)
- [x] C5 — src/routes/logs.js (Size: XS)

## Execution Log

### C1 — test-plans.js
CRUD over run_configs array in config/test_plans.yaml. Full parity with Python.

### C2 — test-runs.js + src/executor.js
Introduced executor.js: callAgent (native fetch, 30s timeout via AbortSignal), extractResponseText (OpenAI + generic field detection), buildAuthHeaders, keywordScore, executeTest, buildRunRecord.
test-runs.js: GET (summary strip), GET /:run_id (full detail), POST (config-based batch + quick single-agent).
Batch run: iterates agents × suite_types, runs Promise.all per agent+suite, saves all runs atomically.

### C3 — probe.js
Single ad-hoc call. Returns { response, raw } or { error }.

### C4 — git.js
simple-git for all 6 ops. Base dir = parent of workspaces/ (project root).
status: workspace-scoped relative path. commit: add, reset results/ and logs/, then commit.
sync: fetch → rebase → on conflict abort + return file list.
smart-commit: groups files by scope (global/agents/workspace/config), one commit per group, rebase+push if all succeed.

### C5 — logs.js
store.readText() for GET, store.delete() for DELETE.

## Files Changed
- src/executor.js (new)
- src/routes/test-plans.js
- src/routes/test-runs.js
- src/routes/probe.js
- src/routes/git.js
- src/routes/logs.js

## Blockers — (none)

## Decisions
- Native fetch (Node 18+) — no axios dependency; AbortSignal.timeout(30000) for agent call timeout
- keywordScore is verbatim Python port — Bundle D replaces with embeddings
- Promise.all per agent — parallel within a suite, sequential across suites within agent
- simple-git throws on rebase conflict; catch + abort + return conflict list
- Git baseDir always = parent of workspaces/ dir — works for both dev (./workspaces) and prod (userData/workspaces)
