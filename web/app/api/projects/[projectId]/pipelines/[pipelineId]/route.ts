import { z } from 'zod'
import { getTenant } from '@/lib/auth'
import { withTenant } from '@/lib/db/query'
import { ok, err, handleError } from '@/lib/api'
import { detectCycle, StepConfigByType } from '@/lib/dag'
import type { StepType } from '@/lib/dag'

const UpdateBody = z.object({
  name:        z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  runs_on:     z.array(z.string()).min(1).optional(),
  tags:        z.array(z.string()).optional(),
})

const StepUpsertBody = z.object({
  id:            z.string().uuid().optional(),
  name:          z.string().min(1).max(100),
  type:          z.enum(['api', 'ui', 'ai']),
  prerequisites: z.array(z.string().uuid()).default([]),
  outputs:       z.record(z.string()).default({}),
  config:        z.record(z.unknown()),
  on_failure:    z.enum(['stop', 'continue']).default('stop'),
  timeout_ms:    z.number().int().min(1000).max(300_000).default(30_000),
  position:      z.number().int().min(0).default(0),
})

type Params = { params: Promise<{ projectId: string; pipelineId: string }> }

export async function GET(_req: Request, { params }: Params) {
  try {
    const { tenantId } = await getTenant()
    const { pipelineId } = await params
    const rows = await withTenant(tenantId, (q) => q('pipelines/get-with-steps', [pipelineId]))
    if (!rows.length) return err('Not found', 404)
    return ok(rows[0])
  } catch (e) { return handleError(e) }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { tenantId } = await getTenant()
    const { pipelineId } = await params
    const body = UpdateBody.parse(await req.json())
    const rows = await withTenant(tenantId, (q) =>
      q('pipelines/update', [pipelineId, body.name ?? null, body.description ?? null, body.runs_on ?? null, body.tags ?? null]),
    )
    if (!rows.length) return err('Not found', 404)
    return ok(rows[0])
  } catch (e) { return handleError(e) }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { tenantId } = await getTenant()
    const { pipelineId } = await params
    const rows = await withTenant(tenantId, (q) => q('pipelines/delete', [pipelineId]))
    if (!rows.length) return err('Not found', 404)
    return ok({ deleted: true })
  } catch (e) { return handleError(e) }
}

// PUT /pipelines/:id/steps — replace full step set with DAG validation
export async function PUT(req: Request, { params }: Params) {
  try {
    const { tenantId } = await getTenant()
    const { pipelineId } = await params
    const { steps } = z.object({ steps: z.array(StepUpsertBody) }).parse(await req.json())

    // Validate each step's type-specific config
    for (const step of steps) {
      const schema = StepConfigByType[step.type as StepType]
      const result = schema.safeParse(step.config)
      if (!result.success) {
        return err(`Step "${step.name}" config invalid: ${result.error.errors.map(e => e.message).join(', ')}`, 422)
      }
    }

    // Validate DAG — no cycles
    const cycle = detectCycle(steps.map(s => ({ id: s.id ?? s.name, prerequisites: s.prerequisites })))
    if (cycle) return err(`Cycle detected involving steps: ${cycle.join(', ')}`, 422)

    // Upsert all steps in transaction
    const saved = await withTenant(tenantId, async (q) => {
      const results = []
      for (const step of steps) {
        const rows = await q('steps/upsert', [
          step.id ?? null, pipelineId, step.name, step.type,
          step.prerequisites, step.outputs, step.config,
          step.on_failure, step.timeout_ms, step.position,
        ])
        results.push(rows[0])
      }
      return results
    })

    return ok(saved)
  } catch (e) { return handleError(e) }
}
