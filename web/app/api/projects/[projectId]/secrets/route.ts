import { z } from 'zod'
import { getTenant } from '@/lib/auth'
import { withTenant } from '@/lib/db/query'
import { ok, handleError } from '@/lib/api'
import { encryptSecret } from '@/lib/crypto'

const CreateBody = z.object({
  name:  z.string().min(1).max(100).regex(/^[A-Z0-9_]+$/, 'Secret names must be UPPER_SNAKE_CASE'),
  value: z.string().min(1),
})

type Params = { params: Promise<{ projectId: string }> }

export async function GET(_req: Request, { params }: Params) {
  try {
    const { tenantId } = await getTenant()
    const { projectId } = await params
    // encrypted_value excluded in query — only metadata returned
    const secrets = await withTenant(tenantId, (q) => q('secrets/list', [projectId]))
    return ok(secrets)
  } catch (e) { return handleError(e) }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const { tenantId, userId } = await getTenant()
    const { projectId } = await params
    const body = CreateBody.parse(await req.json())

    // Encrypt before storing — plaintext never reaches DB
    const { encrypted, keyVersion } = await encryptSecret(tenantId, body.value)

    const secret = await withTenant(tenantId, async (q) => {
      const rows = await q('secrets/create', [projectId, body.name, encrypted, keyVersion, userId])
      return rows[0]
    })

    return ok(secret, 201)
    // value field absent from response — intentional
  } catch (e) { return handleError(e) }
}
