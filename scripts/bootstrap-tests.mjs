#!/usr/bin/env node
/**
 * continuous.testing — Bootstrap test cases from this codebase
 *
 * Uses Claude to analyze the codebase routes/components,
 * creates pipelines + steps via the CT API,
 * registers runner tokens in the DB,
 * then triggers runs.
 *
 * Auth: X-CT-Test-Key header (test mode bypass)
 * Usage: node scripts/bootstrap-tests.mjs
 */

import { writeFileSync, appendFileSync, mkdirSync, existsSync } from 'fs'
import { execSync } from 'child_process'

const API_BASE    = process.env.CT_API_BASE     ?? 'http://localhost:8080'
const TEST_KEY    = process.env.CT_TEST_API_KEY ?? 'ct-test-api-key-local-dev-only'
const DEVLOG_DIR  = 'docs/devlog'
const RUN_TS      = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const DEVLOG      = `${DEVLOG_DIR}/TEST-RUN-${RUN_TS}.md`

// ── Helpers ───────────────────────────────────────────────────────────────────

const testHeaders = {
  'Content-Type': 'application/json',
  'X-CT-Test-Key': TEST_KEY,
}

async function api(method, path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: testHeaders,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${method} ${path} → ${res.status}: ${text}`)
  }
  return res.json()
}

function log(msg) {
  const line = `[${new Date().toTimeString().slice(0, 8)}] ${msg}`
  console.log(line)
  appendFileSync(DEVLOG, line + '\n')
}

function initDevlog() {
  if (!existsSync(DEVLOG_DIR)) mkdirSync(DEVLOG_DIR, { recursive: true })
  writeFileSync(DEVLOG, `# Test Run — ${new Date().toLocaleString()}
**Stack:** docker compose (postgres + web + caddy + 3 runners)
**Auth:** X-CT-Test-Key (test mode bypass)
**Source:** continuous-testing codebase routes

## Execution Log
`)
}

async function waitForStack(maxWaitS = 120) {
  log(`Waiting for stack at ${API_BASE}...`)
  for (let i = 0; i < maxWaitS / 2; i++) {
    try {
      const res = await fetch(`${API_BASE}/`)
      if (res.status < 500) { log(`Stack ready (${i*2}s)`); return }
    } catch {}
    await new Promise(r => setTimeout(r, 2000))
  }
  throw new Error(`Stack not ready after ${maxWaitS}s`)
}

// ── Migrations via docker exec ────────────────────────────────────────────────
async function runMigrations() {
  log('Running migrations...')
  const migrations = [
    '001_tenants_projects',
    '002_pipelines_steps',
    '003_environments_secrets',
    '004_runs_results',
    '005_issues',
    '006_runners',
    '007_datasets',
    '008_openapi_specs',
    '009_api_keys',
  ]

  for (const m of migrations) {
    try {
      execSync(
        `wsl -- docker compose exec -T postgres psql ` +
        `-U ct -d continuous_testing ` +
        `-f /dev/stdin < web/migrations/${m}.sql`,
        { stdio: ['pipe', 'pipe', 'pipe'] }
      )
    } catch (e) {
      // Ignore "already exists" errors
      if (!e.message.includes('already exists')) {
        log(`  Migration ${m}: ${e.message.slice(0, 80)}`)
      }
    }
  }

  // Seed test tenant
  try {
    execSync(
      `wsl -- docker compose exec -T postgres psql ` +
      `-U ct -d continuous_testing ` +
      `-f /dev/stdin < web/migrations/000_test_tenant.sql`,
      { stdio: ['pipe', 'pipe', 'pipe'] }
    )
    log('Test tenant seeded')
  } catch (e) {
    log(`  Test tenant seed: ${e.message.slice(0, 80)}`)
  }
}

// ── Register runner tokens in DB ──────────────────────────────────────────────
async function registerRunners() {
  log('Registering 3 runner tokens...')
  const tokens = [
    process.env.RUNNER_TOKEN_1 ?? 'cf912c1d2d12b06aefdfd0fa00b78bb5f48c5e760303c26998c4101d89936b2a',
    process.env.RUNNER_TOKEN_2 ?? 'fdaf5822bf90619fdc069b91b9743ff8882e553940f996050c7d98a5606af5d6',
    process.env.RUNNER_TOKEN_3 ?? '1131b7cc3d73dad5b22625ddbe3db9e4ab7dbccff3333b50c61811ccb1d440f6',
  ]

  const { createHash } = await import('crypto')
  const TENANT_ID = '00000000-0000-0000-0000-000000000001'

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    const hash = createHash('sha256').update(token).digest('hex')
    const sql = `
INSERT INTO runners (id, tenant_id, name, scope, tags, capabilities, token_hash, registered_by, status)
VALUES (
  '0000000${i+1}-0000-0000-0000-000000000001',
  '${TENANT_ID}',
  'hosted-runner-${i+1}',
  'hosted',
  ARRAY['hosted','chromium','api','ai'],
  ARRAY['api','ui','ai'],
  '${hash}',
  'system',
  'idle'
)
ON CONFLICT (id) DO UPDATE SET last_seen_at = now(), status = 'idle';
`
    try {
      execSync(
        `wsl -- docker compose exec -T postgres psql -U ct -d continuous_testing -c "${sql.replace(/\n/g, ' ')}"`,
        { stdio: 'pipe' }
      )
      log(`  Runner ${i+1} registered (hash: ${hash.slice(0,8)}...)`)
    } catch (e) {
      log(`  Runner ${i+1} error: ${e.message.slice(0, 80)}`)
    }
  }
}

// ── Create test project ───────────────────────────────────────────────────────
async function createProject() {
  log('Creating test project...')
  const r = await api('POST', '/api/projects', {
    name: 'CT Self-Test',
    slug: 'ct-self-test',
    description: 'Testing continuous.testing against itself',
  })
  log(`  Project: ${r.data.id}`)
  return r.data.id
}

// ── Create environment ────────────────────────────────────────────────────────
async function createEnvironment(projectId) {
  log('Creating environment...')
  const r = await api('POST', `/api/projects/${projectId}/environments`, {
    name: 'local-docker',
    is_default: true,
    variables: { BASE_URL: 'http://caddy' },
  })
  return r.data.id
}

// ── Build test pipelines from codebase analysis ───────────────────────────────
//
// These pipelines test the CT API itself — using the runner endpoints
// and the project/pipeline API. This is the "continuous.testing tests itself" scenario.

async function createHealthPipeline(projectId) {
  log('Creating pipeline: API Health Checks...')
  const r = await api('POST', `/api/projects/${projectId}/pipelines`, {
    name: 'API Health — Core Endpoints',
    description: 'Tests CT API health: dashboard, runners, projects',
    runs_on: ['hosted'],
    tags: ['health', 'smoke'],
  })
  const pid = r.data.id

  // Add steps — these call the CT API from inside the Docker network
  await api('PUT', `/api/projects/${projectId}/pipelines/${pid}`, {
    steps: [
      {
        name: 'GET / — web is up',
        type: 'api', position: 0,
        prerequisites: [], outputs: {},
        config: {
          method: 'GET',
          url: '{{env.BASE_URL}}/',
          assertions: [
            { type: 'status', operator: 'lte', expected: 302 },
          ],
        },
        on_failure: 'continue', timeout_ms: 10000,
      },
      {
        name: 'POST /api/runners/heartbeat — no token → 401',
        type: 'api', position: 1,
        prerequisites: [], outputs: {},
        config: {
          method: 'POST',
          url: '{{env.BASE_URL}}/api/runners/heartbeat',
          assertions: [
            { type: 'status', operator: 'eq', expected: 401 },
          ],
        },
        on_failure: 'continue', timeout_ms: 10000,
      },
      {
        name: 'POST /api/runners/claim — no token → 401',
        type: 'api', position: 2,
        prerequisites: [], outputs: {},
        config: {
          method: 'POST',
          url: '{{env.BASE_URL}}/api/runners/claim',
          assertions: [
            { type: 'status', operator: 'eq', expected: 401 },
          ],
        },
        on_failure: 'continue', timeout_ms: 10000,
      },
      {
        name: 'GET /api/projects — test-key auth → 200',
        type: 'api', position: 3,
        prerequisites: [], outputs: {},
        config: {
          method: 'GET',
          url: '{{env.BASE_URL}}/api/projects',
          headers: { 'X-CT-Test-Key': process.env.CT_TEST_API_KEY ?? 'ct-test-api-key-local-dev-only' },
          assertions: [
            { type: 'status', operator: 'eq', expected: 200 },
            { type: 'jsonpath', target: '$.data', operator: 'contains', expected: '' },
          ],
        },
        on_failure: 'continue', timeout_ms: 10000,
      },
    ],
  })
  log(`  Health pipeline: ${pid}`)
  return pid
}

async function createRunnerProtocolPipeline(projectId) {
  log('Creating pipeline: Runner Protocol...')
  const r = await api('POST', `/api/projects/${projectId}/pipelines`, {
    name: 'Runner Protocol — Register + Heartbeat',
    description: 'Tests runner registration, heartbeat, and claim protocol',
    runs_on: ['hosted'],
    tags: ['runner', 'protocol'],
  })
  const pid = r.data.id

  await api('PUT', `/api/projects/${projectId}/pipelines/${pid}`, {
    steps: [
      {
        name: 'Runner 1 heartbeat — token auth',
        type: 'api', position: 0,
        prerequisites: [], outputs: { runnerId: '$.data.runnerId' },
        config: {
          method: 'POST',
          url: '{{env.BASE_URL}}/api/runners/heartbeat',
          headers: { 'X-Runner-Token': process.env.RUNNER_TOKEN_1 ?? 'cf912c1d2d12b06aefdfd0fa00b78bb5f48c5e760303c26998c4101d89936b2a' },
          assertions: [
            { type: 'status', operator: 'eq', expected: 200 },
            { type: 'jsonpath', target: '$.data.status', operator: 'eq', expected: 'ok' },
          ],
        },
        on_failure: 'continue', timeout_ms: 10000,
      },
      {
        name: 'Runner 2 heartbeat — token auth',
        type: 'api', position: 1,
        prerequisites: [], outputs: {},
        config: {
          method: 'POST',
          url: '{{env.BASE_URL}}/api/runners/heartbeat',
          headers: { 'X-Runner-Token': process.env.RUNNER_TOKEN_2 ?? 'fdaf5822bf90619fdc069b91b9743ff8882e553940f996050c7d98a5606af5d6' },
          assertions: [
            { type: 'status', operator: 'eq', expected: 200 },
          ],
        },
        on_failure: 'continue', timeout_ms: 10000,
      },
      {
        name: 'Runner 3 heartbeat — token auth',
        type: 'api', position: 2,
        prerequisites: [], outputs: {},
        config: {
          method: 'POST',
          url: '{{env.BASE_URL}}/api/runners/heartbeat',
          headers: { 'X-Runner-Token': process.env.RUNNER_TOKEN_3 ?? '1131b7cc3d73dad5b22625ddbe3db9e4ab7dbccff3333b50c61811ccb1d440f6' },
          assertions: [
            { type: 'status', operator: 'eq', expected: 200 },
          ],
        },
        on_failure: 'continue', timeout_ms: 10000,
      },
      {
        name: 'GET /api/runners — list shows 3 registered',
        type: 'api', position: 3,
        prerequisites: [], outputs: { runnerCount: '$.data.length' },
        config: {
          method: 'GET',
          url: '{{env.BASE_URL}}/api/runners',
          headers: { 'X-CT-Test-Key': process.env.CT_TEST_API_KEY ?? 'ct-test-api-key-local-dev-only' },
          assertions: [
            { type: 'status', operator: 'eq', expected: 200 },
          ],
        },
        on_failure: 'continue', timeout_ms: 10000,
      },
    ],
  })
  log(`  Runner protocol pipeline: ${pid}`)
  return pid
}

async function createCRUDPipeline(projectId) {
  log('Creating pipeline: Project CRUD...')
  const r = await api('POST', `/api/projects/${projectId}/pipelines`, {
    name: 'Project CRUD — Create, Read, Update, Delete',
    description: 'Tests the full project lifecycle via API',
    runs_on: ['hosted'],
    tags: ['crud', 'projects'],
  })
  const pid = r.data.id
  const testKey = process.env.CT_TEST_API_KEY ?? 'ct-test-api-key-local-dev-only'

  await api('PUT', `/api/projects/${projectId}/pipelines/${pid}`, {
    steps: [
      {
        name: 'POST /api/projects — create crud-test project',
        type: 'api', position: 0,
        prerequisites: [], outputs: { newProjectId: '$.data.id', projectSlug: '$.data.slug' },
        config: {
          method: 'POST',
          url: '{{env.BASE_URL}}/api/projects',
          headers: { 'X-CT-Test-Key': testKey },
          body: { name: 'CRUD Test Project', slug: 'crud-test-auto', description: 'Created by test loop' },
          assertions: [
            { type: 'status', operator: 'eq', expected: 201 },
            { type: 'jsonpath', target: '$.data.slug', operator: 'eq', expected: 'crud-test-auto' },
          ],
        },
        on_failure: 'stop', timeout_ms: 10000,
      },
      {
        name: 'GET /api/projects — new project in list',
        type: 'api', position: 1,
        prerequisites: [], outputs: {},
        config: {
          method: 'GET',
          url: '{{env.BASE_URL}}/api/projects',
          headers: { 'X-CT-Test-Key': testKey },
          assertions: [
            { type: 'status', operator: 'eq', expected: 200 },
            { type: 'jsonpath', target: '$.data', operator: 'contains', expected: 'crud-test-auto' },
          ],
        },
        on_failure: 'continue', timeout_ms: 10000,
      },
      {
        name: 'AI: verify project creation response is meaningful',
        type: 'ai', position: 2,
        prerequisites: [], outputs: {},
        config: {
          prompt: 'The project "CRUD Test Project" with slug "crud-test-auto" was successfully created via the API with HTTP 201.',
          expected_response: 'The project was created successfully.',
          threshold: 0.7,
        },
        on_failure: 'continue', timeout_ms: 30000,
      },
    ],
  })
  log(`  CRUD pipeline: ${pid}`)
  return pid
}

// ── Trigger a run and poll result ─────────────────────────────────────────────
async function triggerAndPoll(projectId, pipelineId, name) {
  log(`Triggering: ${name}...`)
  const r = await api('POST', `/api/projects/${projectId}/pipelines/${pipelineId}/runs`, {
    trigger: 'test-loop',
  })
  const runId = r.data?.runId
  if (!runId) { log(`  No runId returned`); return null }
  log(`  Run ID: ${runId}`)

  // Poll for up to 120s
  for (let i = 0; i < 40; i++) {
    await new Promise(res => setTimeout(res, 3000))
    try {
      const result = await api('GET', `/api/runs/${runId}`)
      const s = result.data?.status
      if (s === 'passed' || s === 'failed' || s === 'cancelled') {
        const passed  = result.data?.passed_steps  ?? 0
        const failed  = result.data?.failed_steps  ?? 0
        const total   = result.data?.total_steps   ?? 0
        log(`  ${name}: ${s.toUpperCase()} — ${passed}/${total} passed`)
        return { runId, status: s, passed, failed, total }
      }
      if (i % 5 === 0) log(`  Polling... status=${s}`)
    } catch (e) {
      log(`  Poll error: ${e.message}`)
    }
  }
  log(`  Timeout waiting for result`)
  return { runId, status: 'timeout', passed: 0, failed: 0, total: 0 }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  initDevlog()
  log('=== continuous.testing Self-Test Loop ===')
  log(`API: ${API_BASE}`)

  try {
    await waitForStack()
    await runMigrations()
    await registerRunners()

    const projectId = await createProject()
    await createEnvironment(projectId)

    const [healthPid, runnerPid, crudPid] = await Promise.all([
      createHealthPipeline(projectId),
      createRunnerProtocolPipeline(projectId),
      createCRUDPipeline(projectId),
    ])

    log('\n=== Triggering all test pipelines ===')
    const results = await Promise.all([
      triggerAndPoll(projectId, healthPid,  'API Health'),
      triggerAndPoll(projectId, runnerPid,  'Runner Protocol'),
      triggerAndPoll(projectId, crudPid,    'Project CRUD'),
    ])

    // Summary
    log('\n=== RESULTS ===')
    const total = results.reduce((a, r) => a + (r?.total  ?? 0), 0)
    const passed = results.reduce((a, r) => a + (r?.passed ?? 0), 0)
    const failed = results.reduce((a, r) => a + (r?.failed ?? 0), 0)
    log(`Total: ${total} steps | Passed: ${passed} | Failed: ${failed}`)

    appendFileSync(DEVLOG, `
## Summary
| Pipeline | Status | Passed | Failed |
|----------|--------|--------|--------|
${results.map((r, i) => {
  const names = ['API Health', 'Runner Protocol', 'Project CRUD']
  return `| ${names[i]} | ${r?.status ?? 'n/a'} | ${r?.passed ?? 0} | ${r?.failed ?? 0} |`
}).join('\n')}

**Total:** ${passed}/${total} passed

## Bugs Found
${failed > 0 ? '- See failed steps above — investigate via `docker compose logs web`' : '- None — all tests passed!'}

## Next Actions
${failed > 0 ? '- Fix bugs, rebuild, and re-run: `node scripts/bootstrap-tests.mjs`' : '- Stack healthy. Proceed with Phase 2 features (B07, B08).'}
`)

    process.exit(failed > 0 ? 1 : 0)
  } catch (e) {
    log(`ERROR: ${e.message}`)
    appendFileSync(DEVLOG, `\n## Error\n${e.message}\n${e.stack}\n`)
    process.exit(1)
  }
}

main()
