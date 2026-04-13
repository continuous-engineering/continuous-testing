import { getTenant } from '@/lib/auth'
import { withTenant } from '@/lib/db/query'
import { ok, handleError } from '@/lib/api'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { tenantId } = await getTenant()
    const steps = await withTenant(tenantId, (q) => q('analytics/flaky-steps'))
    return ok(steps)
  } catch (e) { return handleError(e) }
}
