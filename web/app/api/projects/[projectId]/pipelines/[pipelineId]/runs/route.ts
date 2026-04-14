/**
 * POST /api/projects/:projectId/pipelines/:pipelineId/runs
 * Trigger a pipeline run (or a batch of runs if dataset_id is provided).
 *
 * Single run:  { trigger?, environment_id? }
 *              → { runId, status }
 *
 * Dataset run: { dataset_id, trigger?, environment_id? }
 *              → { batchId, runs: [{ runId, rowIndex }], total }
 *              Creates one run per dataset row, each with row_data snapshotted.
 *
 * GET — list runs for this pipeline.
 */
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { getTenant } from '@/lib/auth'
import { withTenant } from '@/lib/db/query'
import { ok, err, handleError } from '@/lib/api'
import { enqueueRunDag } from '@/lib/queue'

const TriggerBody = z.object({
  environment_id: z.string().uuid().optional(),
  dataset_id:     z.string().uuid().optional(),
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

    if (body.dataset_id) {
      // ── Dataset batch: one run per row ──────────────────────────────
      const datasetRows = await withTenant(tenantId, async (q) => {
        const ds = await q('datasets/get-by-id', [body.dataset_id!])
        if (!ds.length) throw new Error('Dataset not found')
        return q('datasets/list-rows', [body.dataset_id!, 2000, 0])
      })

      if (!datasetRows.length) return err('Dataset has no rows', 422)

      const batchId = randomUUID()
      const runs: { runId: string; rowIndex: number }[] = []

      for (const row of datasetRows as Array<{ id: string; row_index: number; data: Record<string, unknown> }>) {
        const created = await withTenant(tenantId, async (q) => {
          const r = await q('runs/create', [
            pipelineId,
            body.environment_id ?? null,
            body.dataset_id,
            JSON.stringify(row.data),
            row.row_index,
            batchId,
            body.trigger,
            userId,
          ])
          return r[0] as Record<string, string>
        })

        await enqueueRunDag({
          runId:        created.id ?? '',
          tenantId,
          requiredTags: (pipeline.runs_on as string[]) ?? ['hosted'],
        })

        runs.push({ runId: created.id ?? '', rowIndex: row.row_index })
      }

      return ok({ batchId, runs, total: runs.length }, 202)
    }

    // ── Single run ───────────────────────────────────────────────────
    const created = await withTenant(tenantId, async (q) => {
      const r = await q('runs/create', [
        pipelineId,
        body.environment_id ?? null,
        null, null, null, null,    // no dataset
        body.trigger,
        userId,
      ])
      return r[0] as Record<string, string>
    })

    await enqueueRunDag({
      runId:        created.id ?? '',
      tenantId,
      requiredTags: (pipeline.runs_on as string[]) ?? ['hosted'],
    })

    return ok({ runId: created.id, status: 'pending' }, 202)
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
