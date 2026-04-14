/**
 * GET /api/projects/:projectId/pipelines/:pipelineId/export
 * Exports a pipeline as a portable YAML file.
 *
 * Format design:
 *   - prerequisites reference step NAMES (not UUIDs) — portable across workspaces
 *   - position is implicit from step order in the YAML list
 *   - defaults omitted (on_failure: stop, timeout_ms: 30000) for clean YAML
 *   - UUIDs stripped — import generates fresh ones
 */
import { dump } from 'js-yaml'
import { getTenant } from '@/lib/auth'
import { withTenant } from '@/lib/db/query'
import { err, handleError } from '@/lib/api'

type StepRow = {
  id: string; name: string; type: string; position: number
  prerequisites: string[]; outputs: Record<string, string>
  config: Record<string, unknown>; on_failure: string; timeout_ms: number
}

type PipelineRow = {
  id: string; name: string; description: string | null
  runs_on: string[]; tags: string[]; steps: StepRow[]
}

type Params = { params: Promise<{ projectId: string; pipelineId: string }> }

export async function GET(_req: Request, { params }: Params) {
  try {
    const { tenantId } = await getTenant()
    const { pipelineId } = await params

    const rows = await withTenant(tenantId, (q) =>
      q<PipelineRow>('pipelines/get-with-steps', [pipelineId]),
    )
    if (!rows.length) return err('Not found', 404)

    const p = rows[0]!
    const steps = [...p.steps].sort((a, b) => a.position - b.position)

    // Build name→id lookup for prerequisite resolution
    const idToName = Object.fromEntries(steps.map(s => [s.id, s.name]))

    // Build the YAML document — only include non-default fields
    const doc: Record<string, unknown> = {
      version: '1',
      name:    p.name,
    }
    if (p.description)         doc.description = p.description
    if (p.runs_on.length)      doc.runs_on     = p.runs_on
    if (p.tags?.length)        doc.tags        = p.tags

    doc.steps = steps.map(s => {
      const step: Record<string, unknown> = { name: s.name, type: s.type }

      if (s.prerequisites.length) {
        step.prerequisites = s.prerequisites.map(id => idToName[id] ?? id)
      }
      if (s.on_failure !== 'stop')      step.on_failure  = s.on_failure
      if (s.timeout_ms !== 30_000)      step.timeout_ms  = s.timeout_ms
      if (Object.keys(s.outputs).length) step.outputs    = s.outputs

      // Clean up config: remove empty/null values for readability
      const config = Object.fromEntries(
        Object.entries(s.config).filter(([, v]) => v !== null && v !== '' && !(Array.isArray(v) && !v.length)),
      )
      if (Object.keys(config).length) step.config = config

      return step
    })

    const yaml = [
      `# continuous.testing pipeline — ${p.name}`,
      `# Export format v1. Import via: Settings → Import → Paste YAML`,
      `# Docs: https://docs.continuous.testing/pipelines/yaml`,
      '',
      dump(doc, { lineWidth: 120, noRefs: true }),
    ].join('\n')

    const filename = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.yaml'

    return new Response(yaml, {
      status: 200,
      headers: {
        'Content-Type':        'application/yaml; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (e) { return handleError(e) }
}
