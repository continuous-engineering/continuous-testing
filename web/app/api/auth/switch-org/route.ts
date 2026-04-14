import { z } from 'zod'
import { raw } from '@/lib/db/query'
import { getTenant, createSession, setSessionCookie } from '@/lib/auth'
import { ok, err, handleError } from '@/lib/api'

const Body = z.object({
  orgId: z.string().uuid(),
})

export async function POST(req: Request) {
  try {
    const { userId } = await getTenant()
    const { orgId } = Body.parse(await req.json())

    // Verify the user actually belongs to the requested org
    const membership = await raw<{ org_id: string; name: string }>(
      `SELECT om.org_id, o.name FROM org_members om JOIN orgs o ON o.id = om.org_id
       WHERE om.user_id = $1 AND om.org_id = $2`,
      [userId, orgId],
    )
    if (!membership.length) return err('Not a member of this organization', 403)

    // Issue a fresh session cookie scoped to the new org
    const token = await createSession(userId, orgId, {
      ua: req.headers.get('user-agent') ?? undefined,
    })
    await setSessionCookie(token)

    return ok({ orgId, name: membership[0]?.name ?? '' })
  } catch (e) { return handleError(e) }
}
