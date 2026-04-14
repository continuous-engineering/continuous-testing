/**
 * Runner management API.
 * POST /api/runners — register a new runner (authenticated tenant user)
 * GET  /api/runners — list runners for tenant
 */
import { z } from 'zod'
import { createHash, randomBytes } from 'crypto'
import { getTenant } from '@/lib/auth'
import { withTenant } from '@/lib/db/query'
import { raw } from '@/lib/db/query'
import { ok, handleError } from '@/lib/api'

const RegisterBody = z.object({
  name:         z.string().min(1).max(100),
  tags:         z.array(z.string()).min(1),
  capabilities: z.array(z.enum(['api', 'ui', 'ai'])).default(['api']),
})

export async function POST(req: Request) {
  try {
    const { tenantId, userId } = await getTenant()
    const body = RegisterBody.parse(await req.json())

    // Generate token — issued once, hash stored
    const token = randomBytes(32).toString('hex')
    const tokenHash = createHash('sha256').update(token).digest('hex')

    // scope is always 'self-hosted' — enforced in SQL too. 'hosted' = platform only.
    const rows = await withTenant(tenantId, (q) =>
      q('runners/register', [
        tenantId, body.name,
        body.tags, body.capabilities, tokenHash, userId,
      ]),
    )
    const runner = rows[0] as Record<string, unknown>

    // Return token once — never stored in plaintext
    return ok({ ...runner, token }, 201)
  } catch (e) { return handleError(e) }
}

export async function GET() {
  try {
    const { tenantId } = await getTenant()
    const runners = await withTenant(tenantId, (q) => q('runners/list'))
    return ok(runners)
  } catch (e) { return handleError(e) }
}
