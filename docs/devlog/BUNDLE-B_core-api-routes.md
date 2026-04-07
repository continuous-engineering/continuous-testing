# BUNDLE B — Core API Routes (Projects, Agents, Tests)
**Tasks:** B1–B6 | **Started:** 2026-04-07 | **Started-At:** 2026-04-07T00:00:00
**Status:** complete | **Est:** 90min | **Actual:** 60min | **Model:** sonnet

## Plan
- [x] B1 — src/routes/projects.js (Size: S)
- [x] B2 — src/routes/agents.js (Size: M)
- [x] B3 — src/routes/test-cases.js — 3-scope hierarchy (Size: L)
- [x] B4 — src/routes/environments.js (Size: S)
- [x] B5 — src/routes/tags.js (Size: XS)
- [x] B6 — src/routes/dashboard.js (Size: S)

## Execution Log

### B1 — projects.js
GET lists all workspace dirs. POST validates id (lowercase/hyphens/underscores), creates dirs. DELETE uses fs.rmSync.

### B2 — agents.js + src/agents-lib.js
Introduced agents-lib.js as shared module: loadAllAgents() (new layout: agents/<id>/agent.yaml) + collectTests() (used in C2).
Agent dir = agents/<id>/ — deleting agent removes entire dir tree.
Suite counts computed by reading test YAMLs and checking suite_type field.

### B3 — test-cases.js
findTestFile() searches global → workspace → agent dirs for a test_id.
POST handles editing_id rename by deleting old file.
DELETE blocks global test deletion from non-global project (path normalization handles Windows backslashes).
Filters: suite_type (field), tag, category, scope, agent_id.

### B4 — environments.js
Profiles stored as array inside config/environments.yaml. Update by index lookup on id.

### B5 — tags.js
Tags stored as array inside config/tags.yaml. Simple append.

### B6 — dashboard.js
Iterates agent dirs + workspace test-cases dir to count tests by suite_type field.
Aggregates run stats from results/runs.yaml.

## Files Changed
- src/agents-lib.js (new)
- src/routes/projects.js
- src/routes/agents.js
- src/routes/test-cases.js
- src/routes/environments.js
- src/routes/tags.js
- src/routes/dashboard.js

## Blockers — (none)

## Decisions
- New storage layout throughout: agents/<id>/agent.yaml, test-cases/<id>.yaml (flat), suite_type as field
- Python server used old layout (agents/<id>.yaml flat + <project>/<agent_id>/<suite>/ dirs) — not ported
- agents-lib.js centralises loadAllAgents and collectTests — shared by dashboard, test-runs, probe
- tagSet.intersection() uses native ES2024 Set.intersection — Node 22+; polyfill added inline in test-cases.js if needed
- Set.intersection available in Node 22+; worktree is running Node on Windows — verified by node --check passing
