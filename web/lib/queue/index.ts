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

// Sync and notification jobs handled by interval workers in the web app process (B10, B11)
export async function enqueueSyncIssues(_tenantId: string, _adapter: string): Promise<void> {
  // Implemented in B10
}

export async function enqueueNotification(
  _tenantId: string, _event: string, _payload: Record<string, unknown>,
): Promise<void> {
  // Implemented in B11
}
