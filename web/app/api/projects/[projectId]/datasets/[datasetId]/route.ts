import { z } from 'zod'
import { getTenant } from '@/lib/auth'
import { withTenant } from '@/lib/db/query'
import { ok, err, handleError } from '@/lib/api'

type Params = { params: Promise<{ projectId: string; datasetId: string }> }

export async function GET(req: Request, { params }: Params) {
  try {
    const { tenantId } = await getTenant()
    const { datasetId } = await params
    const url    = new URL(req.url)
    const limit  = Math.min(Number(url.searchParams.get('limit')  ?? 500), 2000)
    const offset = Number(url.searchParams.get('offset') ?? 0)

    const [dataset, rows] = await withTenant(tenantId, async (q) => {
      const ds   = await q('datasets/get-by-id', [datasetId])
      const data = await q('datasets/list-rows', [datasetId, limit, offset])
      return [ds[0], data] as const
    })

    if (!dataset) return err('Not found', 404)
    return ok({ ...dataset as object, rows })
  } catch (e) { return handleError(e) }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { tenantId } = await getTenant()
    const { datasetId } = await params
    const body = z.object({
      name:        z.string().min(1).max(100).optional(),
      description: z.string().max(500).optional(),
      schema_json: z.record(z.unknown()).optional(),
    }).parse(await req.json())

    const rows = await withTenant(tenantId, (q) =>
      q('datasets/update-schema', [
        datasetId,
        body.name        ?? null,
        body.description ?? null,
        body.schema_json ? JSON.stringify(body.schema_json) : null,
      ]),
    )
    if (!rows.length) return err('Not found', 404)
    return ok(rows[0])
  } catch (e) { return handleError(e) }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { tenantId } = await getTenant()
    const { datasetId } = await params
    await withTenant(tenantId, (q) => q('datasets/delete', [datasetId]))
    return ok({ deleted: true })
  } catch (e) { return handleError(e) }
}
