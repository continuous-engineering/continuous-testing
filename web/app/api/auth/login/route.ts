import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { raw } from '@/lib/db/query'
import { createSession, setSessionCookie } from '@/lib/auth'
import { ok, err, handleError } from '@/lib/api'

const Body = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
  orgId:    z.string().uuid().optional(),  // optional: switch active org on login
})

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json())

    // Lookup user
    const users = await raw<{ id: string; name: string; password_hash: string }>(
      `SELECT id, name, password_hash FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [body.email],
    )
    const user = users[0]
    // Constant-time compare even on miss
    const hash = user?.password_hash ?? '$2b$12$invalidentryfortimingprotection'
    const match = await bcrypt.compare(body.password, hash)
    if (!user || !match) return err('Invalid email or password', 401)

    // Get active org — use provided orgId or first org the user belongs to
    let orgId = body.orgId
    if (!orgId) {
      const orgs = await raw<{ org_id: string }>(
        `SELECT org_id FROM org_members WHERE user_id = $1 LIMIT 1`,
        [user.id],
      )
      orgId = orgs[0]?.org_id
    }
    if (!orgId) return err('User has no organization — contact support', 403)

    // Verify membership
    const membership = await raw(
      `SELECT 1 FROM org_members WHERE user_id = $1 AND org_id = $2`,
      [user.id, orgId],
    )
    if (!membership.length) return err('Not a member of this organization', 403)

    const token = await createSession(user.id, orgId, {
      ua: req.headers.get('user-agent') ?? undefined,
    })
    await setSessionCookie(token)

    return ok({ userId: user.id, orgId, name: user.name, email: body.email })
  } catch (e) { return handleError(e) }
}
