import { z } from 'zod'
import { getTenant } from '@/lib/auth'
import { withTenant } from '@/lib/db/query'
import { ok, err, handleError } from '@/lib/api'

const UpdateBody = z.object({
  name:       z.string().min(1).max(100).optional(),
  is_default: z.boolean().optional(),
  variables:  z.record(z.string()).optional(),
})

type Params = { params: Promise<{ projectId: string; envId: string }> }

export async function GET(_req: Request, { params }: Params) {
  try {
    const { tenantId } = await getTenant()
    const { envId } = await params
    const rows = await withTenant(tenantId, (q) => q('environments/get-by-id', [envId]))
    if (!rows.length) return err('Not found', 404)
    return ok(rows[0])
  } catch (e) { return handleError(e) }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { tenantId } = await getTenant()
    const { projectId, envId } = await params
    const body = UpdateBody.parse(await req.json())
    const rows = await withTenant(tenantId, async (q) => {
      const updated = await q('environments/update', [
        envId, body.name ?? null, body.is_default ?? null,
        body.variables ? JSON.stringify(body.variables) : null,
      ])
      if (body.is_default && updated.length) {
        await q('environments/set-default', [envId, projectId])
      }
      return updated
    })
    if (!rows.length) return err('Not found', 404)
    return ok(rows[0])
  } catch (e) { return handleError(e) }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { tenantId } = await getTenant()
    const { envId } = await params
    const rows = await withTenant(tenantId, (q) => q('environments/delete', [envId]))
    if (!rows.length) return err('Not found', 404)
    return ok({ deleted: true })
  } catch (e) { return handleError(e) }
}
