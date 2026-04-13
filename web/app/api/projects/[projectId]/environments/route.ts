import { z } from 'zod'
import { getTenant } from '@/lib/auth'
import { withTenant } from '@/lib/db/query'
import { ok, handleError } from '@/lib/api'

const CreateBody = z.object({
  name:       z.string().min(1).max(100),
  is_default: z.boolean().default(false),
  variables:  z.record(z.string()).default({}),
})

type Params = { params: Promise<{ projectId: string }> }

export async function GET(_req: Request, { params }: Params) {
  try {
    const { tenantId } = await getTenant()
    const { projectId } = await params
    const envs = await withTenant(tenantId, (q) => q('environments/list', [projectId]))
    return ok(envs)
  } catch (e) { return handleError(e) }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const { tenantId } = await getTenant()
    const { projectId } = await params
    const body = CreateBody.parse(await req.json())

    const env = await withTenant(tenantId, async (q) => {
      const rows = await q('environments/create', [
        projectId, body.name, body.is_default, JSON.stringify(body.variables),
      ])
      if (body.is_default) {
        await q('environments/set-default', [(rows[0] as Record<string,string>).id, projectId])
      }
      return rows[0]
    })

    return ok(env, 201)
  } catch (e) { return handleError(e) }
}
