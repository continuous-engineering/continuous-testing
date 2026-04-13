/**
 * POST /api/projects/:projectId/pipelines/:pipelineId/runs
 * Trigger a pipeline run. Returns run_id immediately, execution is async via BullMQ.
 * GET — list runs for this pipeline.
 */
import { z } from 'zod'
import { getTenant } from '@/lib/auth'
import { withTenant } from '@/lib/db/query'
import { ok, err, handleError } from '@/lib/api'
import { enqueueRunDag } from '@/lib/queue'

const TriggerBody = z.object({
  environment_id: z.string().uuid().optional(),
  trigger:        z.string().default('manual'),
})

type Params = { params: Promise<{ projectId: string; pipelineId: string }> }

export async function POST(req: Request, { params }: Params) {
  try {
    const { tenantId, userId } = await getTenant()
    const { pipelineId } = await params
    const body = TriggerBody.parse(await req.json().catch(() => ({})))

    // Verify pipeline exists + get runs_on tags
    const pipelines = await withTenant(tenantId, (q) => q('pipelines/get-with-steps', [pipelineId]))
    if (!pipelines.length) return err('Pipeline not found', 404)
    const pipeline = pipelines[0] as Record<string, unknown>

    // Create run record
    const runs = await withTenant(tenantId, (q) =>
      q('runs/create', [pipelineId, body.environment_id ?? null, body.trigger, userId]),
    )
    const run = runs[0] as Record<string, string>

    // Enqueue DAG job — runner picks it up by tag matching
    await enqueueRunDag({
      runId:        run.id ?? '',
      tenantId,
      pipelineId,
      environmentId: body.environment_id ?? null,
      requiredTags:  (pipeline.runs_on as string[]) ?? ['hosted'],
    })

    return ok({ runId: run.id, status: 'pending' }, 202)
  } catch (e) { return handleError(e) }
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const { tenantId } = await getTenant()
    const { pipelineId } = await params
    const runs = await withTenant(tenantId, (q) =>
      q('runs/list-by-pipeline', [pipelineId]),
    )
    return ok(runs)
  } catch (e) { return handleError(e) }
}
