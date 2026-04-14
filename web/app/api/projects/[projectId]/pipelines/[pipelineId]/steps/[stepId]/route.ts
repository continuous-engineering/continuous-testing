import { getTenant } from '@/lib/auth'
import { withTenant } from '@/lib/db/query'
import { ok, err, handleError } from '@/lib/api'

type Params = { params: Promise<{ projectId: string; pipelineId: string; stepId: string }> }

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { tenantId } = await getTenant()
    const { pipelineId, stepId } = await params

    const rows = await withTenant(tenantId, (q) =>
      q('steps/delete', [stepId, pipelineId]),
    )
    if (!rows.length) return err('Step not found', 404)
    return ok({ deleted: true })
  } catch (e) { return handleError(e) }
}
