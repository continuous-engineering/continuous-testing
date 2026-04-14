import { z } from 'zod'
import { getTenant } from '@/lib/auth'
import { withTenant } from '@/lib/db/query'
import { ok, handleError } from '@/lib/api'

type Params = { params: Promise<{ projectId: string; datasetId: string; rowId: string }> }

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { tenantId } = await getTenant()
    const { rowId } = await params
    const { data } = z.object({ data: z.record(z.unknown()) }).parse(await req.json())
    const rows = await withTenant(tenantId, (q) =>
      q('datasets/update-row', [rowId, JSON.stringify(data)]),
    )
    return ok(rows[0])
  } catch (e) { return handleError(e) }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { tenantId } = await getTenant()
    const { datasetId, rowId } = await params
    await withTenant(tenantId, (q) => q('datasets/delete-row', [rowId]))
    // Recount rows
    await withTenant(tenantId, (q) => q('datasets/update-row-count', [datasetId]))
    return ok({ deleted: true })
  } catch (e) { return handleError(e) }
}
