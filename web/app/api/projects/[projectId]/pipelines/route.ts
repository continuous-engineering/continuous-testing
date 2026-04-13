import { z } from 'zod'
import { getTenant } from '@/lib/auth'
import { withTenant } from '@/lib/db/query'
import { ok, err, handleError } from '@/lib/api'
import { detectCycle } from '@/lib/dag'

const CreateBody = z.object({
  name:        z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  runs_on:     z.array(z.string()).min(1).default(['hosted']),
  tags:        z.array(z.string()).default([]),
})

type Params = { params: Promise<{ projectId: string }> }

export async function GET(_req: Request, { params }: Params) {
  try {
    const { tenantId } = await getTenant()
    const { projectId } = await params
    const pipelines = await withTenant(tenantId, (q) => q('pipelines/list', [projectId]))
    return ok(pipelines)
  } catch (e) { return handleError(e) }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const { tenantId } = await getTenant()
    const { projectId } = await params
    const body = CreateBody.parse(await req.json())

    const pipeline = await withTenant(tenantId, async (q) => {
      const rows = await q('pipelines/create', [
        projectId, body.name, body.description ?? null,
        body.runs_on, body.tags,
      ])
      return rows[0]
    })

    return ok(pipeline, 201)
  } catch (e) { return handleError(e) }
}
