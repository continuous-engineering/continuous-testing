import { z } from 'zod'
import { getTenant } from '@/lib/auth'
import { withTenant } from '@/lib/db/query'
import { ok, handleError } from '@/lib/api'

const CreateBody = z.object({
  name:        z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  schema_json: z.record(z.unknown()).default({}),
  rows:        z.array(z.record(z.unknown())).default([]),
})

type Params = { params: Promise<{ projectId: string }> }

export async function GET(_req: Request, { params }: Params) {
  try {
    const { tenantId } = await getTenant()
    const { projectId } = await params
    const datasets = await withTenant(tenantId, (q) => q('datasets/list', [projectId]))
    return ok(datasets)
  } catch (e) { return handleError(e) }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const { tenantId } = await getTenant()
    const { projectId } = await params
    const body = CreateBody.parse(await req.json())

    const dataset = await withTenant(tenantId, async (q) => {
      const rows = await q('datasets/create', [
        projectId, body.name, body.description ?? null, JSON.stringify(body.schema_json),
      ])
      const ds = rows[0] as Record<string, string>

      if (body.rows.length > 0) {
        await q('datasets/insert-rows', [ds.id, 0, JSON.stringify(body.rows)])
        await q('datasets/update-row-count', [ds.id])
        const updated = await q('datasets/get-by-id', [ds.id])
        return updated[0]
      }
      return ds
    })

    return ok(dataset, 201)
  } catch (e) { return handleError(e) }
}
