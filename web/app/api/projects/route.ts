import { z } from 'zod'
import { getTenant } from '@/lib/auth'
import { withTenant } from '@/lib/db/query'
import { ok, err, handleError } from '@/lib/api'

const CreateBody = z.object({
  name:        z.string().min(1).max(100),
  slug:        z.string().min(1).max(60).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with dashes'),
  description: z.string().max(500).optional(),
})

export async function GET() {
  try {
    const { tenantId } = await getTenant()
    const projects = await withTenant(tenantId, (q) => q('projects/list'))
    return ok(projects)
  } catch (e) { return handleError(e) }
}

export async function POST(req: Request) {
  try {
    const { tenantId } = await getTenant()
    const body = CreateBody.parse(await req.json())

    const project = await withTenant(tenantId, async (q) => {
      const existing = await q('projects/get-by-slug', [body.slug])
      if (existing.length > 0) throw new Error('slug_taken')
      const rows = await q('projects/create', [body.name, body.slug, body.description ?? null])
      return rows[0]
    })

    return ok(project, 201)
  } catch (e) {
    if (e instanceof Error && e.message === 'slug_taken') return err('Slug already in use', 409)
    return handleError(e)
  }
}
