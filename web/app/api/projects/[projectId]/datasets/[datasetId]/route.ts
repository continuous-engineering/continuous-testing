import { z } from 'zod'
import { getTenant } from '@/lib/auth'
import { withTenant } from '@/lib/db/query'
import { ok, err, handleError } from '@/lib/api'

type Params = { params: Promise<{ projectId: string; datasetId: string }> }

export async function GET(req: Request, { params }: Params) {
  try {
    const { tenantId } = await getTenant()
    const { datasetId } = await params
    const url = new URL(req.url)
    const limit  = Math.min(Number(url.searchParams.get('limit')  ?? 100), 1000)
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

// POST rows — append to existing dataset
export async function POST(req: Request, { params }: Params) {
  try {
    const { tenantId } = await getTenant()
    const { datasetId } = await params
    const { rows } = z.object({ rows: z.array(z.record(z.unknown())).min(1) }).parse(await req.json())

    const result = await withTenant(tenantId, async (q) => {
      const ds = await q('datasets/get-by-id', [datasetId])
      if (!ds.length) throw new Error('Not found')
      const current = (ds[0] as Record<string, number>).row_count
      await q('datasets/insert-rows', [datasetId, current, JSON.stringify(rows)])
      const updated = await q('datasets/update-row-count', [datasetId])
      return updated[0]
    })

    return ok(result)
  } catch (e) { return handleError(e) }
}
