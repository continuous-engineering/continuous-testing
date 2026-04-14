import { z } from 'zod'
import { getTenant } from '@/lib/auth'
import { withTenant } from '@/lib/db/query'
import { ok, err, handleError } from '@/lib/api'

const UpdateBody = z.object({
  name:               z.string().min(1).max(100).optional(),
  description:        z.string().max(2000).optional(),
  owner:              z.string().max(200).optional().nullable(),
  labels:             z.array(z.string()).optional(),
  homepage_url:       z.string().url().max(500).optional().nullable(),
  report_recipients:  z.array(z.string().email()).optional(),
  metadata:           z.record(z.unknown()).optional(),
})

type Params = { params: Promise<{ projectId: string }> }

export async function GET(_req: Request, { params }: Params) {
  try {
    const { tenantId } = await getTenant()
    const { projectId } = await params
    const rows = await withTenant(tenantId, (q) => q('projects/get-by-id', [projectId]))
    if (!rows.length) return err('Not found', 404)
    return ok(rows[0])
  } catch (e) { return handleError(e) }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { tenantId } = await getTenant()
    const { projectId } = await params
    const body = UpdateBody.parse(await req.json())
    const rows = await withTenant(tenantId, (q) =>
      q('projects/update', [
        projectId,
        body.name              ?? null,
        body.description       ?? null,
        body.owner             ?? null,
        body.labels            ?? null,
        body.homepage_url      ?? null,
        body.report_recipients ?? null,
        body.metadata ? JSON.stringify(body.metadata) : null,
      ]),
    )
    if (!rows.length) return err('Not found', 404)
    return ok(rows[0])
  } catch (e) { return handleError(e) }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { tenantId } = await getTenant()
    const { projectId } = await params
    const rows = await withTenant(tenantId, (q) => q('projects/delete', [projectId]))
    if (!rows.length) return err('Not found', 404)
    return ok({ deleted: true })
  } catch (e) { return handleError(e) }
}
