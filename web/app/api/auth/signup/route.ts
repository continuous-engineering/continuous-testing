import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { raw } from '@/lib/db/query'
import { createSession, setSessionCookie } from '@/lib/auth'
import { ok, err, handleError } from '@/lib/api'

const Body = z.object({
  name:     z.string().min(1).max(100),
  email:    z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  orgName:  z.string().min(1).max(100).optional(),
})

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json())

    // Check duplicate email
    const existing = await raw(`SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL`, [body.email])
    if (existing.length > 0) return err('Email already registered', 409)

    const passwordHash = await bcrypt.hash(body.password, 12)

    // Create user + org in one transaction
    const client = await (await import('@/lib/db/client')).default.connect()
    let userId = '', orgId = ''
    try {
      await client.query('BEGIN')

      // User
      const { rows: [user] } = await client.query<{ id: string }>(
        `INSERT INTO users (email, name, password_hash) VALUES ($1,$2,$3) RETURNING id`,
        [body.email, body.name, passwordHash],
      )
      userId = user!.id

      // Org (use provided name or derive from email)
      const orgName = body.orgName ?? `${body.name}'s Workspace`
      const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
        + '-' + Math.random().toString(36).slice(2, 7)
      const { rows: [org] } = await client.query<{ id: string }>(
        `INSERT INTO orgs (name, slug) VALUES ($1,$2) RETURNING id`,
        [orgName, slug],
      )
      orgId = org!.id

      // Membership (admin)
      await client.query(
        `INSERT INTO org_members (org_id, user_id, role) VALUES ($1,$2,'admin')`,
        [orgId, userId],
      )

      // Link tenant
      await client.query(
        `INSERT INTO tenants (id, clerk_org_id, name, slug, org_id)
         VALUES (gen_random_uuid(), $1, $2, $3, $4)
         ON CONFLICT DO NOTHING`,
        [orgId, orgName, slug, orgId],
      )

      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }

    // Create session
    const token = await createSession(userId, orgId, {
      ua: req.headers.get('user-agent') ?? undefined,
    })
    await setSessionCookie(token)

    return ok({ userId, orgId, email: body.email, name: body.name }, 201)
  } catch (e) { return handleError(e) }
}
