import { z } from 'zod'
import { getTenant } from '@/lib/auth'
import { withTenant } from '@/lib/db/query'
import { ok, handleError } from '@/lib/api'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ projectId: string }> }

export async function GET(req: Request, { params }: Params) {
  try {
    const { tenantId } = await getTenant()
    const { projectId } = await params
    const url = new URL(req.url)
    const status = url.searchParams.get('status') || null
    const issues = await withTenant(tenantId, (q) => q('issues/list', [projectId, status]))
    return ok(issues)
  } catch (e) { return handleError(e) }
}
