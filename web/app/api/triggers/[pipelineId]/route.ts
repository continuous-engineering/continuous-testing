/**
 * POST /api/triggers/:pipelineId
 * CI/CD webhook trigger — authenticated via X-CT-API-Key header (not Clerk).
 * Returns run_id immediately; execution is async via Postgres queue.
 * Used by GitHub Actions, Jenkins, CircleCI, any CI system.
 */
import { z } from 'zod'
import { createHash } from 'crypto'
import { one, withTenant } from '@/lib/db/query'
import { enqueueRunDag } from '@/lib/queue'
import { ok, err, handleError } from '@/lib/api'

export const dynamic = 'force-dynamic'

const TriggerBody = z.object({
  environment_id: z.string().uuid().optional(),
  trigger:        z.string().default('webhook'),
  ref:            z.string().optional(),  // git ref (branch/tag/sha) for context
  actor:          z.string().optional(),  // who triggered (CI user/bot)
}).catch({ trigger: 'webhook' })

type Params = { params: Promise<{ pipelineId: string }> }

export async function POST(req: Request, { params }: Params) {
  try {
    const { pipelineId } = await params

    // API key auth — not Clerk (CI systems don't have Clerk sessions)
    const apiKey = req.headers.get('x-ct-api-key')
    if (!apiKey) return err('Missing X-CT-API-Key header', 401)

    // Look up tenant by API key hash
    const keyHash = createHash('sha256').update(apiKey).digest('hex')
    const apiKeyRow = await one<{ tenant_id: string; project_id: string }>(
      'api-keys/get-by-hash', [keyHash],
    )
    if (!apiKeyRow) return err('Invalid API key', 401)

    const { tenant_id: tenantId } = apiKeyRow
    const body = TriggerBody.parse(await req.json().catch(() => ({})))

    // Verify pipeline exists + get runs_on tags
    const pipeline = await withTenant(tenantId, async (q) => {
      const rows = await q<{ id: string; runs_on: string[] }>('pipelines/get-with-steps', [pipelineId])
      return rows[0] ?? null
    })
    if (!pipeline) return err('Pipeline not found', 404)

    // Create run record
    const runs = await withTenant(tenantId, (q) =>
      q('runs/create', [pipelineId, body.environment_id ?? null, body.trigger, body.actor ?? 'webhook']),
    )
    const run = runs[0] as Record<string, string>

    // Enqueue — runner picks up by tag matching
    await enqueueRunDag({
      runId:        run['id'] ?? '',
      tenantId,
      requiredTags: pipeline.runs_on ?? ['hosted'],
    })

    return ok({ runId: run['id'], status: 'pending', pipelineId }, 202)
  } catch (e) { return handleError(e) }
}
