import { z } from 'zod'
import { getTenant } from '@/lib/auth'
import { withTenant } from '@/lib/db/query'
import { ok, err, handleError } from '@/lib/api'
import { encryptSecret } from '@/lib/crypto'

const UpdateBody = z.object({
  value: z.string().min(1),
})

type Params = { params: Promise<{ projectId: string; secretId: string }> }

// No GET single — listing is sufficient, value is never returned

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { tenantId } = await getTenant()
    const { secretId } = await params
    const { value } = UpdateBody.parse(await req.json())

    const { encrypted, keyVersion } = await encryptSecret(tenantId, value)

    const rows = await withTenant(tenantId, (q) =>
      q('secrets/update-value', [secretId, encrypted, keyVersion]),
    )
    if (!rows.length) return err('Not found', 404)
    return ok(rows[0])
  } catch (e) { return handleError(e) }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { tenantId } = await getTenant()
    const { secretId } = await params
    const rows = await withTenant(tenantId, (q) => q('secrets/delete', [secretId]))
    if (!rows.length) return err('Not found', 404)
    return ok({ deleted: true })
  } catch (e) { return handleError(e) }
}
