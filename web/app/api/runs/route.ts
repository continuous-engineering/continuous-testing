import { getTenant } from '@/lib/auth'
import { withTenant } from '@/lib/db/query'
import { ok, handleError } from '@/lib/api'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const { tenantId } = await getTenant()
    const url         = new URL(req.url)
    const projectId   = url.searchParams.get('project') || null
    const status      = url.searchParams.get('status')  || null

    const rows = await withTenant(tenantId, (q) =>
      q('runs/list-recent', [projectId, status]),
    )
    return ok(rows)
  } catch (e) { return handleError(e) }
}
