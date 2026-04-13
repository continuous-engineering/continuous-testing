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
