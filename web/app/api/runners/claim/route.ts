/**
 * POST /api/runners/claim
 * Runner polls this to claim its next job.
 * Returns job + full context (DAG, env vars, decrypted secrets).
 * Auth via X-Runner-Token.
 *
 * ADR-001: One DAG = one runner. Tag dispatch: required_tags <@ runner.tags
 */
import { createHash } from 'crypto'
import { raw, query, withTenant } from '@/lib/db/query'
import pool from '@/lib/db/client'
import { readFileSync } from 'fs'
import { join } from 'path'
import { ok, err } from '@/lib/api'
import { decryptSecret } from '@/lib/crypto'

function sqlFile(name: string) {
  return readFileSync(join(process.cwd(), 'lib', 'queries', `${name}.sql`), 'utf-8')
}

export async function POST(req: Request) {
  const token = req.headers.get('x-runner-token')
  if (!token) return err('Missing X-Runner-Token', 401)

  const tokenHash = createHash('sha256').update(token).digest('hex')
  // raw() bypasses RLS — correct for cross-tenant token lookup
  const rows = await raw<{ id: string; tenant_id: string; tags: string[]; scope: string }>(
    `SELECT id, tenant_id, tags, scope FROM runners WHERE token_hash = $1 AND revoked_at IS NULL`,
    [tokenHash],
  )
  const runner = rows[0] ?? null
  if (!runner) return err('Invalid runner token', 401)

  // Claim next matching job (FOR UPDATE SKIP LOCKED in SQL)
  const client = await pool.connect()
  let job: Record<string, unknown> | null = null
  try {
    await client.query('BEGIN')
    if (runner.scope === 'hosted') {
      // Hosted runners have no tenant — set the RLS bypass flag so they can see all tenants' jobs
      await client.query(`SET LOCAL app.is_hosted_runner = 'true'`)
    } else {
      await client.query(`SET LOCAL app.tenant_id = '${runner.tenant_id}'`)
    }
    const { rows } = await client.query(
      sqlFile('runners/claim-job'),
      [runner.id, runner.tenant_id ?? null, runner.tags, runner.scope],
    )
    job = rows[0] ?? null
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    client.release()
    throw e
  } finally {
    client.release()
  }

  if (!job) return new Response(null, { status: 204 })  // Nothing to claim

  // Build full execution context for the runner.
  // ALWAYS use job.tenant_id — hosted runners have no tenant of their own.
  const runId    = job.run_id   as string
  const tenantId = job.tenant_id as string

  // Get run + pipeline + steps (all within tenant RLS context)
  const [run, pipeline, envVars] = await withTenant(tenantId, async (q) => {
    const runRows = await q<Record<string, unknown>>('runs/get-by-id', [runId])
    const run = runRows[0]
    if (!run) return [null, null, {}] as const

    const pipelineRows = await q<Record<string, unknown>>('pipelines/get-with-steps', [run.pipeline_id as string])
    const pipeline = pipelineRows[0] as Record<string, unknown> | undefined

    const envId = run.environment_id as string | null
    let envVars: Record<string, string> = {}
    if (envId) {
      const envRows = await q<Record<string, unknown>>('environments/get-by-id', [envId])
      envVars = (envRows[0]?.variables ?? {}) as Record<string, string>
    }
    return [run, pipeline, envVars] as const
  })
  if (!run || !pipeline) return err('Run not found', 404)

  // Collect referenced secret names from all step configs
  const steps = (pipeline.steps ?? []) as Record<string, unknown>[]
  const secretNames = extractSecretRefs(steps)
  let secrets: Record<string, string> = {}

  if (secretNames.length > 0) {
    const secretRows = await withTenant(tenantId, (q) =>
      q<{ name: string; encrypted_value: string }>('secrets/get-encrypted', [run.pipeline_id as string, secretNames]),
    )
    for (const row of secretRows) {
      secrets[row.name] = await decryptSecret(tenantId, row.encrypted_value)
    }
  }

  return ok({
    jobId:    job.id,
    runId,
    dag:      pipeline.steps,
    context: { env: envVars, secrets },
    // secrets decrypted in this response — runner holds in memory only
  })
}

/** Extract {{secrets.NAME}} references from all step configs */
function extractSecretRefs(steps: Record<string, unknown>[]): string[] {
  const refs = new Set<string>()
  const text = JSON.stringify(steps)
  for (const match of text.matchAll(/\{\{secrets\.([A-Z0-9_]+)\}\}/g)) {
    if (match[1]) refs.add(match[1])
  }
  return [...refs]
}
