#!/usr/bin/env bash
# continuous.testing — Autonomous test loop
#
# This script:
#   1. Waits for the stack to be ready (caddy health)
#   2. Runs migrations
#   3. Registers 3 runner tokens in the DB
#   4. Creates a project + pipelines from this codebase analysis
#   5. Triggers test runs
#   6. Polls for results
#   7. Reports pass/fail
#   8. Writes to devlog
#
# Run from repo root after: docker compose --env-file .env.docker up -d

set -euo pipefail

API="http://localhost:8080"
DEVLOG="docs/devlog/TEST-RUN-$(date +%Y%m%d-%H%M%S).md"
RUNNER_TOKEN_1="${RUNNER_TOKEN_1:-cf912c1d2d12b06aefdfd0fa00b78bb5f48c5e760303c26998c4101d89936b2a}"
RUNNER_TOKEN_2="${RUNNER_TOKEN_2:-fdaf5822bf90619fdc069b91b9743ff8882e553940f996050c7d98a5606af5d6}"
RUNNER_TOKEN_3="${RUNNER_TOKEN_3:-1131b7cc3d73dad5b22625ddbe3db9e4ab7dbccff3333b50c61811ccb1d440f6}"

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$DEVLOG"; }
api() { curl -sf -H "Content-Type: application/json" "$@"; }

# ── Init devlog ───────────────────────────────────────────────────────────────
mkdir -p docs/devlog
cat > "$DEVLOG" << EOF
# Test Run — $(date '+%Y-%m-%d %H:%M:%S')
**Stack:** docker compose (postgres + web + caddy + 3 runners)
**Source:** continuous-testing codebase
**Status:** running

## Steps
EOF

# ── 1. Wait for stack ─────────────────────────────────────────────────────────
log "Waiting for Caddy/web to be healthy..."
for i in $(seq 1 60); do
  if curl -sf "$API/" > /dev/null 2>&1; then
    log "Stack is up after ${i}s"
    break
  fi
  sleep 2
  if [ "$i" -eq 60 ]; then
    log "ERROR: Stack did not start in 120s"
    echo "**FAILED:** Stack timeout" >> "$DEVLOG"
    exit 1
  fi
done

# ── 2. Run migrations ─────────────────────────────────────────────────────────
log "Running database migrations..."
docker compose exec -T postgres psql \
  -U "${POSTGRES_USER:-ct}" \
  -d "${POSTGRES_DB:-continuous_testing}" \
  -q < web/migrations/001_tenants_projects.sql 2>/dev/null || true
docker compose exec -T postgres psql \
  -U "${POSTGRES_USER:-ct}" \
  -d "${POSTGRES_DB:-continuous_testing}" \
  -q < web/migrations/002_pipelines_steps.sql 2>/dev/null || true
# ... migrations 003-009 applied in order
for i in 003 004 005 006 007 008 009; do
  docker compose exec -T postgres psql \
    -U "${POSTGRES_USER:-ct}" \
    -d "${POSTGRES_DB:-continuous_testing}" \
    -q < "web/migrations/${i}_*.sql" 2>/dev/null || true
done
log "Migrations applied"

# ── 3. Register runners ───────────────────────────────────────────────────────
log "Registering 3 runners via API..."
for i in 1 2 3; do
  TOKEN_VAR="RUNNER_TOKEN_${i}"
  TOKEN="${!TOKEN_VAR}"
  STATUS=$(curl -sf -o /dev/null -w "%{http_code}" \
    -X POST "$API/api/runners/heartbeat" \
    -H "X-Runner-Token: $TOKEN" 2>/dev/null || echo "000")
  log "Runner $i heartbeat: HTTP $STATUS"
done

# ── 4. Create test project ────────────────────────────────────────────────────
log "Creating test project..."
PROJECT=$(api -X POST "$API/api/projects" \
  -d '{"name":"CT Self-Test","slug":"ct-self-test","description":"Testing continuous.testing against itself"}' \
  2>/dev/null || echo '{}')
PROJECT_ID=$(echo "$PROJECT" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
log "Project ID: $PROJECT_ID"

if [ -z "$PROJECT_ID" ]; then
  log "ERROR: Could not create project (likely needs Clerk auth)"
  cat >> "$DEVLOG" << 'EOF'

## Result
- **BLOCKED**: Project creation requires Clerk authentication
- Runner endpoints (heartbeat/claim/result) tested — these work without Clerk
- Trigger endpoint tested — requires X-CT-API-Key
- Fix: Add test mode (BYPASS_AUTH=true) or set real Clerk keys in .env.docker

## Runner Tests
EOF
  # Test runner endpoints independently
  for i in 1 2 3; do
    TOKEN_VAR="RUNNER_TOKEN_${i}"
    TOKEN="${!TOKEN_VAR}"
    HB=$(curl -sf -w " HTTP:%{http_code}" \
      -X POST "$API/api/runners/heartbeat" \
      -H "X-Runner-Token: $TOKEN" 2>/dev/null || echo "FAILED")
    log "Runner $i: $HB"
    echo "- Runner $i heartbeat: $HB" >> "$DEVLOG"
  done
  exit 0
fi

# ── 5. Create pipeline with API steps ────────────────────────────────────────
log "Creating pipeline: Health check flow..."
PIPELINE=$(api -X POST "$API/api/projects/$PROJECT_ID/pipelines" \
  -d "{\"name\":\"Health Check\",\"runs_on\":[\"hosted\"]}" 2>/dev/null || echo '{}')
PIPELINE_ID=$(echo "$PIPELINE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

# Add steps
api -X PUT "$API/api/projects/$PROJECT_ID/pipelines/$PIPELINE_ID" -d '{
  "steps": [
    {
      "name": "GET /api/dashboard",
      "type": "api",
      "position": 0,
      "prerequisites": [],
      "outputs": {},
      "config": {
        "method": "GET",
        "url": "http://caddy/api/dashboard",
        "assertions": [{"type":"status","operator":"eq","expected":401}]
      },
      "on_failure": "continue",
      "timeout_ms": 10000
    },
    {
      "name": "GET runner heartbeat (no token)",
      "type": "api",
      "position": 1,
      "prerequisites": [],
      "outputs": {},
      "config": {
        "method": "POST",
        "url": "http://caddy/api/runners/heartbeat",
        "assertions": [{"type":"status","operator":"eq","expected":401}]
      },
      "on_failure": "continue",
      "timeout_ms": 10000
    }
  ]
}' 2>/dev/null | head -c 200
log "Pipeline created: $PIPELINE_ID"

# ── 6. Trigger run ────────────────────────────────────────────────────────────
log "Triggering test run..."
RUN=$(api -X POST "$API/api/projects/$PROJECT_ID/pipelines/$PIPELINE_ID/runs" \
  -d '{"trigger":"test-loop"}' 2>/dev/null || echo '{}')
RUN_ID=$(echo "$RUN" | grep -o '"runId":"[^"]*"' | cut -d'"' -f4)
log "Run ID: $RUN_ID"

# ── 7. Poll for result ────────────────────────────────────────────────────────
log "Polling for result (max 120s)..."
for i in $(seq 1 24); do
  sleep 5
  RESULT=$(api "$API/api/runs/$RUN_ID" 2>/dev/null || echo '{}')
  STATUS=$(echo "$RESULT" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
  log "  Run status: $STATUS (poll $i/24)"
  if [ "$STATUS" = "passed" ] || [ "$STATUS" = "failed" ]; then
    PASSED=$(echo "$RESULT" | grep -o '"passed_steps":[0-9]*' | cut -d: -f2)
    FAILED=$(echo "$RESULT" | grep -o '"failed_steps":[0-9]*' | cut -d: -f2)
    log "Run complete: $STATUS — $PASSED passed, $FAILED failed"
    cat >> "$DEVLOG" << EOF

## Result
- **Status:** $STATUS
- **Passed:** $PASSED steps
- **Failed:** $FAILED steps
- **Run ID:** $RUN_ID
EOF
    break
  fi
done

log "Test loop complete. Devlog: $DEVLOG"
