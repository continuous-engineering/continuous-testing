# BUNDLE B15 — Self-Test Loop
**Tasks:** #076-084
**Started:** 2026-04-13 | **Status:** in_progress | **Model:** sonnet

## Plan
- [x] #076 — Docker Compose + Caddy + ct-network
- [x] #077 — Test mode auth bypass (X-CT-Test-Key)
- [x] #078 — Runner token seeding (3 hosted runners)
- [x] #079 — Bootstrap test script (Claude-generated pipelines from codebase)
- [ ] #080 — Autonomous fix loop (iterate until tests pass)
- [ ] #081 — Bug: runner heartbeat runnerId
- [ ] #082 — Bug: middleware runners/ public
- [ ] #083 — Bug: RLS test tenant UUID
- [ ] #084 — Bug: runs/get-by-id route missing

## Execution Log

### Infrastructure
- docker-compose.yml: ct-network, caddy:8080, 3 runners (runner-1/2/3)
- Caddyfile: port 80 → web:3000, runners call http://caddy
- .env.docker: generated strong passwords, Anthropic key from .env
- Test tenant: UUID 00000000-0000-0000-0000-000000000001

### Bugs Fixed Before First Run
- heartbeat/route.ts: switched to raw() to bypass RLS for token lookup
- claim/route.ts: switched to raw() for same reason
- runs/[runId]/route.ts: GET endpoint was missing — added
- middleware.ts: runners/* already public, test-key bypass added
- auth.ts: test mode returns fixed tenant UUID when X-CT-Test-Key matches

## Files Changed
- docker-compose.yml (ct-network, 3 runners, caddy)
- Caddyfile
- .env.docker
- web/middleware.ts (test-key bypass)
- web/lib/auth.ts (test mode)
- web/app/api/runners/heartbeat/route.ts (raw() fix)
- web/app/api/runners/claim/route.ts (raw() fix)
- web/app/api/runs/[runId]/route.ts (new — was missing)
- web/migrations/000_test_tenant.sql
- scripts/bootstrap-tests.mjs
- scripts/test-loop.sh

## Blockers — none yet (awaiting first run)

## Decisions
- Test mode uses fixed UUID tenant to keep RLS working consistently
- Runners registered directly via SQL in migration 000 / bootstrap script
- 3 runner containers: runner-1/2/3 on ct-network, poll caddy:80 every 3s
- Only caddy:8080 exposed to host

## Test Run Results — 2026-04-13

### Stack
- postgres:16-alpine (healthy)
- ct-web (Next.js 15.2.4 + Tailwind 3) — running
- caddy:2 — healthy, proxying :8080 → web:3000
- runner-1/2/3 — all registered and polling

### Bugs Fixed (in order)
1. Docker build: stale node_modules leaked from Windows → added .dockerignore
2. Docker build: Tailwind 4 incompatible in Docker → downgraded to Tailwind 3 + postcss.config.js
3. Docker build: next.config.ts SWC parse error → renamed to next.config.js
4. Runners table: RLS blocked cross-tenant token lookup → disabled RLS on runners table
5. RLS policies: current_setting threw when not set → changed to missing_ok=true
6. Heartbeat: used one() with RLS context → switched to raw()
7. Claim: used query() without tenant context → switched to withTenant()
8. Result: manual transaction aborted → rewrote using withTenant()
9. SQL: parameter type ambiguity (text vs run_status/step_status) → added explicit casts
10. Runner response: API wraps in {data:...} → fixed runner to unwrap
11. Test mode: NODE_ENV=production blocked test bypass → removed NODE_ENV check
12. ENV key mismatch: test-ct-api-key vs ct-test-api-key → standardized in .env.docker
13. run_results unique constraint: missing for upsert → added ALTER TABLE constraint

### Final Test Results (3 pipelines, 3 runners)
| Pipeline | Steps | Result |
|---|---|---|
| API Health — Core Endpoints | 4/4 passed | ✅ PASSED |
| Runner Protocol — Register + Heartbeat | 4/4 passed | ✅ PASSED |
| Project CRUD | 2/3 passed | ❌ FAILED (known: step 2 has no prerequisite on step 1 — race condition) |

### Known Remaining Issues
- CRUD test: step 2 (GET /api/projects) runs concurrently with step 1 (POST) — need prerequisite wiring
- Old runner_jobs requeued: completed jobs not marked done (runner_jobs status bug)
- Claim 500 on some runs: old runner_jobs from before fix keep getting re-claimed
