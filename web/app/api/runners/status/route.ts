/**
 * GET /api/runners/status
 * Returns runner list with live job queue stats — used by the runners status panel.
 */
import { getTenant } from '@/lib/auth'
import { withTenant, raw } from '@/lib/db/query'
import { ok, handleError } from '@/lib/api'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { tenantId } = await getTenant()

    const [runners, queue] = await Promise.all([
      withTenant(tenantId, (q) => q('runners/list')),
      raw<{ status: string; count: string }>(
        `SELECT status, count(*)::text FROM runner_jobs
         WHERE tenant_id = $1 AND status IN ('pending','running','failed')
         GROUP BY status`,
        [tenantId],
      ),
    ])

    const queueMap = Object.fromEntries(queue.map(r => [r.status, parseInt(r.count)]))

    return ok({ runners, queue: queueMap })
  } catch (e) { return handleError(e) }
}
