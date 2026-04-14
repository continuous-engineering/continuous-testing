import { z } from 'zod'
import { getTenant } from '@/lib/auth'
import { withTenant } from '@/lib/db/query'
import { ok, handleError } from '@/lib/api'

const CreateBody = z.object({
  name:      z.string().min(1).max(100),
  version:   z.string().optional(),
  spec_json: z.record(z.unknown()),
})

type Params = { params: Promise<{ projectId: string }> }

export async function GET(_req: Request, { params }: Params) {
  try {
    const { tenantId } = await getTenant()
    const { projectId } = await params
    const rows = await withTenant(tenantId, (q) => q('specs/list', [projectId]))
    return ok(rows)
  } catch (e) { return handleError(e) }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const { tenantId } = await getTenant()
    const { projectId } = await params
    const body = CreateBody.parse(await req.json())

    // Count endpoints from spec paths
    const paths = (body.spec_json.paths ?? {}) as Record<string, Record<string, unknown>>
    const HTTP_METHODS = ['get','post','put','patch','delete','head','options']
    let endpointCount = 0
    for (const pathItem of Object.values(paths)) {
      for (const m of HTTP_METHODS) { if (pathItem[m]) endpointCount++ }
    }

    const rows = await withTenant(tenantId, (q) =>
      q('specs/create', [
        projectId, body.name, body.version ?? null,
        JSON.stringify(body.spec_json), endpointCount,
      ]),
    )
    return ok(rows[0], 201)
  } catch (e) { return handleError(e) }
}
