import { getTenant } from '@/lib/auth'
import { withTenant } from '@/lib/db/query'
import { ok, err, handleError } from '@/lib/api'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ runId: string }> }

export async function GET(_req: Request, { params }: Params) {
  try {
    const { tenantId } = await getTenant()
    const { runId } = await params
    const rows = await withTenant(tenantId, (q) => q('runs/get-by-id', [runId]))
    if (!rows.length) return err('Not found', 404)
    return ok(rows[0])
  } catch (e) { return handleError(e) }
}
