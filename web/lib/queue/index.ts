/**
 * Postgres-native job queue — SELECT FOR UPDATE SKIP LOCKED
 * No Redis. No BullMQ. Jobs in runner_jobs table. ACID with business data.
 * ADR-003: dropped Redis — simpler infra, one less service.
 */
import pool from '@/lib/db/client'

type EnqueueRunDagOpts = {
  runId:        string
  tenantId:     string
  requiredTags: string[]
  priority?:    number
}

export async function enqueueRunDag(opts: EnqueueRunDagOpts): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`SET LOCAL app.tenant_id = '${opts.tenantId}'`)
    await client.query(
      `INSERT INTO runner_jobs (tenant_id, run_id, required_tags, priority, status)
       VALUES ($1, $2, $3::text[], $4, 'pending')`,
      [opts.tenantId, opts.runId, opts.requiredTags, opts.priority ?? 0],
    )
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}

// ── B10 / B11 — Not yet called (no callers built yet) ───────────────────────
//
// These stubs exist to define the interface for future interval workers.
// Implementation requires:
//   enqueueSyncIssues → INSERT INTO runner_jobs (type='sync_issues') or direct adapter call
//     Callers: run result handler (auto-issue creation on step failure), webhook inbound
//   enqueueNotification → call Slack/Email/Webhook adapter per pipeline notification config
//     Callers: run result handler (on run_complete event), issue status change handler
//
// Until the interval worker infrastructure (B10/B11) is built, these are no-ops.

export async function enqueueSyncIssues(_tenantId: string, _adapter: string): Promise<void> {
  // TODO B10: implement interval worker that calls adapter.push/pull/sync
}

export async function enqueueNotification(
  _tenantId: string, _event: string, _payload: Record<string, unknown>,
): Promise<void> {
  // TODO B11: implement notification adapter dispatch (Slack, Email, Webhook)
}
