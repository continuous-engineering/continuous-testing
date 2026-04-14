/**
 * POST /api/projects/:projectId/pipelines/import
 * Imports a pipeline from YAML (or JSON).
 *
 * Body: { yaml: string }  — the raw YAML/JSON text
 *
 * Returns: { pipelineId, stepCount } — navigate to the new pipeline
 */
import { load as parseYaml } from 'js-yaml'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { getTenant } from '@/lib/auth'
import { withTenant } from '@/lib/db/query'
import { ok, err, handleError } from '@/lib/api'

// ── YAML document schema ──────────────────────────────────────────────────────

const StepSchema = z.object({
  name:          z.string().min(1).max(100),
  type:          z.enum(['api', 'ui', 'ai']),
  prerequisites: z.array(z.string()).default([]),
  on_failure:    z.enum(['stop', 'continue']).default('stop'),
  timeout_ms:    z.number().int().min(1000).max(300_000).default(30_000),
  outputs:       z.record(z.string()).default({}),
  config:        z.record(z.unknown()).default({}),
})

const PipelineDocSchema = z.object({
  version:     z.string().optional(),
  name:        z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  runs_on:     z.array(z.string()).min(1).default(['hosted']),
  tags:        z.array(z.string()).default([]),
  steps:       z.array(StepSchema).default([]),
})

const Body = z.object({ yaml: z.string().min(1) })

type Params = { params: Promise<{ projectId: string }> }

export async function POST(req: Request, { params }: Params) {
  try {
    const { tenantId } = await getTenant()
    const { projectId } = await params
    const { yaml: text } = Body.parse(await req.json())

    // Parse YAML or JSON
    let raw: unknown
    try {
      raw = parseYaml(text)
    } catch (e) {
      return err(`YAML parse error: ${e instanceof Error ? e.message : String(e)}`, 422)
    }

    // Validate document structure
    const parsed = PipelineDocSchema.safeParse(raw)
    if (!parsed.success) {
      const msgs = parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')
      return err(`Invalid pipeline document: ${msgs}`, 422)
    }
    const doc = parsed.data

    // Resolve prerequisite names → UUIDs
    // Each step gets a fresh UUID; prerequisites reference by name
    const nameToId: Record<string, string> = {}
    for (const step of doc.steps) {
      nameToId[step.name] = randomUUID()
    }

    // Create the pipeline
    const pipeline = await withTenant(tenantId, async (q) => {
      const rows = await q<{ id: string }>('pipelines/create', [
        projectId,
        doc.name,
        doc.description ?? null,
        doc.runs_on,
        doc.tags,
      ])
      return rows[0]
    })
    if (!pipeline) return err('Failed to create pipeline', 500)

    // Create steps in order
    let savedCount = 0
    for (let i = 0; i < doc.steps.length; i++) {
      const s = doc.steps[i]!
      const stepId = nameToId[s.name]!

      // Resolve prerequisite names → UUIDs, skip unknown names with a warning
      const prereqs = s.prerequisites
        .map(name => nameToId[name])
        .filter((id): id is string => !!id)

      await withTenant(tenantId, (q) =>
        q('steps/upsert', [
          stepId, pipeline.id, s.name, s.type,
          prereqs, s.outputs, s.config,
          s.on_failure, s.timeout_ms, i,
        ]),
      )
      savedCount++
    }

    return ok({ pipelineId: pipeline.id, stepCount: savedCount }, 201)
  } catch (e) { return handleError(e) }
}
