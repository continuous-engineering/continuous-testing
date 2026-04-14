import { getTenant } from '@/lib/auth'
import { withTenant } from '@/lib/db/query'
import { ok, err, handleError } from '@/lib/api'

type Params = { params: Promise<{ projectId: string; specId: string }> }

export async function GET(_req: Request, { params }: Params) {
  try {
    const { tenantId } = await getTenant()
    const { specId } = await params
    const rows = await withTenant(tenantId, (q) => q('specs/get-by-id', [specId]))
    if (!rows.length) return err('Not found', 404)
    return ok(rows[0])
  } catch (e) { return handleError(e) }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { tenantId } = await getTenant()
    const { specId } = await params
    await withTenant(tenantId, (q) => q('specs/delete', [specId]))
    return ok({ deleted: true })
  } catch (e) { return handleError(e) }
}
