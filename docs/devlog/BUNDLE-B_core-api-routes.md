# BUNDLE B — Core API Routes (Projects, Agents, Tests)
**Tasks:** B1–B6 | **Started:** 2026-04-07 | **Started-At:** 2026-04-07T00:00:00
**Status:** in_progress | **Est:** 90min | **Model:** sonnet

## Plan
- [ ] B1 — src/routes/projects.js (Size: S)
- [ ] B2 — src/routes/agents.js (Size: M)
- [ ] B3 — src/routes/test-cases.js — 3-scope hierarchy (Size: L)
- [ ] B4 — src/routes/environments.js (Size: S)
- [ ] B5 — src/routes/tags.js (Size: XS)
- [ ] B6 — src/routes/dashboard.js (Size: S)

## Execution Log

## Files Changed

## Blockers — (none)

## Decisions
- All routes read from store.js + workspace.js — no logic in route files themselves
- Test-cases endpoint handles 3 scopes: global (_global/test-cases/), workspace (test-cases/), agent (agents/<id>/test-cases/)
- suite_type stored as field inside YAML — not encoded in path
- agent_id uses uuid v4, slugified from name
- test_id uses provided value or generated uuid
