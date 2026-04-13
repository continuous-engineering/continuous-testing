/**
 * continuous.testing Runner — Standalone Docker process
 *
 * Lifecycle:
 *   1. Register with SaaS (or verify existing registration)
 *   2. Poll /api/runners/claim for jobs
 *   3. On job: start mock server if needed, execute DAG, post results
 *   4. Heartbeat every 30s
 *   5. Repeat until SIGTERM
 */
import { executeDag } from './executor'
import { startMockServer } from './mock-server'
import type { StepDef, RunContext, StepResult } from './types'
import { writeFileSync } from 'fs'

const HEARTBEAT_FILE = '/tmp/ct-runner-heartbeat'

function touchHeartbeat(): void {
  try { writeFileSync(HEARTBEAT_FILE, Date.now().toString()) } catch { /* ignore */ }
}

const API_BASE  = process.env.CT_API_BASE   ?? 'https://api.continuous.testing'
const RUNNER_TOKEN = process.env.RUNNER_TOKEN ?? ''
const POLL_MS   = 5_000
const HB_MS     = 30_000

if (!RUNNER_TOKEN) {
  console.error('RUNNER_TOKEN env var is required')
  process.exit(1)
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type':    'application/json',
      'X-Runner-Token':  RUNNER_TOKEN,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API ${path} failed ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

// ─── Heartbeat ────────────────────────────────────────────────────────────────

function startHeartbeat(): NodeJS.Timeout {
  return setInterval(async () => {
    try {
      await apiPost('/api/runners/heartbeat')
      touchHeartbeat()
    } catch (e) {
      console.warn('[heartbeat] failed:', e instanceof Error ? e.message : e)
    }
  }, HB_MS)
}

// ─── Job handling ─────────────────────────────────────────────────────────────

type JobContext = {
  jobId: string
  runId: string
  dag: StepDef[]
  context: { env: Record<string, string>; secrets: Record<string, string>; mockDb?: Record<string, unknown> }
}

async function handleJob(job: JobContext, runnerId: string, runnerScope: string): Promise<void> {
  console.log(`[runner] claimed job ${job.jobId} for run ${job.runId}`)
  const runStart = Date.now()

  // Start mock server if db seed provided
  let mock: Awaited<ReturnType<typeof startMockServer>> | null = null
  if (job.context.mockDb) {
    mock = await startMockServer(job.context.mockDb)
    console.log(`[runner] mock server on port ${mock.port}`)
  }

  const runCtx: RunContext = {
    runId: job.runId,
    tenantId: '',    // not needed client-side
    runnerId,
    env:     { ...job.context.env, ...(mock ? { MOCK_BASE_URL: mock.baseUrl } : {}) },
    secrets: job.context.secrets,
    mockPort: mock?.port,
    apiBaseUrl: API_BASE,
    runnerToken: RUNNER_TOKEN,
  }

  await apiPost('/api/runners/result', {
    type: 'step_result',  // signal run started — not a real step result but updates run status
    jobId: job.jobId, runId: job.runId,
    stepId: '00000000-0000-0000-0000-000000000000',
    status: 'running', startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(), durationMs: 0,
    ctxOutputs: {}, responseBody: null, responseMeta: {},
    assertions: [], errorMessage: null, artifacts: [],
  }).catch(() => { /* best-effort run started event */ })

  const { passed, results } = await executeDag(
    job.dag,
    runCtx,
    async (result: StepResult) => {
      await apiPost('/api/runners/result', {
        type: 'step_result',
        jobId: job.jobId,
        runId: job.runId,
        stepId: result.stepId,
        status: result.status,
        startedAt: result.startedAt.toISOString(),
        completedAt: result.completedAt.toISOString(),
        durationMs: result.durationMs,
        ctxOutputs: result.ctxOutputs,
        responseBody: result.responseBody,
        responseMeta: result.responseMeta,
        assertions: result.assertions,
        errorMessage: result.errorMessage,
        artifacts: result.artifacts,
      })
    },
  )

  if (mock) await mock.stop()

  const runMinutes = (Date.now() - runStart) / 60_000
  await apiPost('/api/runners/result', {
    type: 'run_complete',
    jobId: job.jobId,
    runId: job.runId,
    runnerId,
    runnerScope,
    runnerMinutes: Math.round(runMinutes * 10000) / 10000,
    finalStatus: passed ? 'passed' : 'failed',
  })

  console.log(`[runner] run ${job.runId} ${passed ? 'PASSED' : 'FAILED'} in ${runMinutes.toFixed(2)}m`)
}

// ─── Poll loop ────────────────────────────────────────────────────────────────

async function pollOnce(runnerId: string, runnerScope: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/runners/claim`, {
    method: 'POST',
    headers: { 'X-Runner-Token': RUNNER_TOKEN, 'Content-Type': 'application/json' },
  })

  if (res.status === 204) return  // nothing to claim

  if (!res.ok) {
    console.warn(`[poll] claim failed: ${res.status}`)
    return
  }

  const raw = await res.json() as { data: JobContext } | JobContext
  const job = ('data' in raw ? raw.data : raw) as JobContext
  await handleJob(job, runnerId, runnerScope)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`[runner] starting — api: ${API_BASE}`)

  // Get runner identity from heartbeat response (contains runnerId)
  const hbRaw = await apiPost<{ data: { runnerId: string } } | { runnerId: string }>('/api/runners/heartbeat')
  // API wraps in { data: ... } — handle both shapes
  const runnerId = ('data' in hbRaw ? hbRaw.data.runnerId : hbRaw.runnerId)
  const runnerScope = process.env.RUNNER_SCOPE ?? 'self-hosted'

  console.log(`[runner] registered as ${runnerId} (${runnerScope})`)

  const hbTimer = startHeartbeat()

  process.on('SIGTERM', () => {
    console.log('[runner] SIGTERM received — stopping')
    clearInterval(hbTimer)
    process.exit(0)
  })

  while (true) {
    try {
      await pollOnce(runnerId, runnerScope)
    } catch (e) {
      console.error('[runner] poll error:', e instanceof Error ? e.message : e)
    }
    await new Promise((r) => setTimeout(r, POLL_MS))
  }
}

main().catch((e) => { console.error('[runner] fatal:', e); process.exit(1) })
