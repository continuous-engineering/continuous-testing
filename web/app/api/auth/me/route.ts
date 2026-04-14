import { getTenant } from '@/lib/auth'
import { raw } from '@/lib/db/query'
import { ok, handleError } from '@/lib/api'

export const dynamic = 'force-dynamic'

const TEST_USER_ID = '00000000-0000-0000-0000-000000000099'

export async function GET() {
  try {
    const { userId, tenantId } = await getTenant()

    // Test bypass user — return synthetic data without hitting users table
    if (userId === TEST_USER_ID) {
      return ok({
        user:        { id: userId, email: 'test@ct.internal', name: 'CT Test User' },
        orgs:        [{ org_id: tenantId, name: 'CT Self-Test', slug: 'ct-self-test', plan: 'starter', role: 'admin' }],
        activeOrgId: tenantId,
      })
    }

    const users = await raw<{ id: string; email: string; name: string }>(
      `SELECT id, email, name FROM users WHERE id = $1`, [userId],
    )
    const orgs = await raw<{ org_id: string; name: string; slug: string; plan: string; role: string }>(
      `SELECT om.org_id, o.name, o.slug, o.plan, om.role
       FROM org_members om JOIN orgs o ON o.id = om.org_id
       WHERE om.user_id = $1 ORDER BY o.name`,
      [userId],
    )
    return ok({ user: users[0] ?? null, orgs, activeOrgId: tenantId })
  } catch (e) { return handleError(e) }
}
