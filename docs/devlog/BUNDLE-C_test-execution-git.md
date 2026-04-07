# BUNDLE C — Test Execution, Git, Logs
**Tasks:** C1–C5 | **Started:** 2026-04-07 | **Started-At:** 2026-04-07T00:00:00
**Status:** in_progress | **Est:** 90min | **Model:** sonnet

## Plan
- [ ] C1 — src/routes/test-plans.js (Size: S)
- [ ] C2 — src/routes/test-runs.js — async execution + score (Size: L)
- [ ] C3 — src/routes/probe.js (Size: S)
- [ ] C4 — src/routes/git.js — all 6 ops via simple-git (Size: M)
- [ ] C5 — src/routes/logs.js (Size: XS)

## Execution Log

## Files Changed

## Blockers — (none)

## Decisions
- Test execution uses Node.js fetch (native in Node 18+) for HTTP calls to agent endpoints
- Execution is synchronous per-test within a run (Promise.all across agents/suites)
- _keyword_score ported from Python verbatim — will be replaced in Bundle D
- simple-git used for all git operations (no subprocess calls)
- Git base dir is resolved from workspace.js getWorkspacesDirectory() parent
