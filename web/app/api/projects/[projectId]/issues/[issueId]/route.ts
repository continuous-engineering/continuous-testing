import { z } from 'zod'
import { getTenant } from '@/lib/auth'
import { withTenant } from '@/lib/db/query'
import { ok, err, handleError } from '@/lib/api'

const UpdateBody = z.object({
  status:   z.enum(['open', 'acknowledged', 'in_progress', 'resolved']).optional(),
  assignee: z.string().optional(),
})

type Params = { params: Promise<{ projectId: string; issueId: string }> }

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { tenantId } = await getTenant()
    const { issueId } = await params
    const body = UpdateBody.parse(await req.json())
    const rows = await withTenant(tenantId, (q) =>
      q('issues/update-status', [issueId, body.status ?? null, body.assignee ?? null]),
    )
    if (!rows.length) return err('Not found', 404)
    return ok(rows[0])
  } catch (e) { return handleError(e) }
}
