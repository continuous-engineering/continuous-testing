import { getTenant } from '@/lib/auth'
import { withTenant } from '@/lib/db/query'
import { ok, handleError } from '@/lib/api'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { tenantId } = await getTenant()

    const [health, recentRuns, runnerStatus, flaky] = await withTenant(tenantId, async (q) => {
      return Promise.all([
        q('analytics/run-health-24h'),
        q('analytics/recent-runs'),
        q('analytics/runner-status'),
        q('analytics/flaky-steps'),
      ])
    })

    // Aggregate health counts
    type HealthRow = { status: string; count: string }
    const counts = { passed: 0, failed: 0, running: 0, pending: 0, cancelled: 0 }
    for (const row of health as HealthRow[]) {
      const n = parseInt(row.count, 10)
      if (row.status in counts) counts[row.status as keyof typeof counts] = n
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0)
    const passRate = total > 0 ? Math.round((counts.passed / total) * 100) : 0

    return ok({
      health:        { ...counts, total, passRate },
      recentRuns,
      runnerStatus,
      flakySteps:    flaky,
      flakyCount:    (flaky as unknown[]).length,
    })
  } catch (e) { return handleError(e) }
}
