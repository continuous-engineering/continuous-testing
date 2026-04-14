import { z } from 'zod'
import { getTenant } from '@/lib/auth'
import { withTenant } from '@/lib/db/query'
import { ok, handleError } from '@/lib/api'

type Params = { params: Promise<{ projectId: string; datasetId: string }> }

// POST /rows — append rows
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
    return ok(result, 201)
  } catch (e) { return handleError(e) }
}
