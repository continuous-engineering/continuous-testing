/**
 * PUT — bookmarklet POSTs recording here (CORS: * — auth via X-Recording-Token header)
 * GET — CT app reads the session (session-cookie auth)
 *
 * CORS is intentionally open on PUT/OPTIONS.
 * The X-Recording-Token authenticates the PUT — the bookmarklet has no session cookie
 * because it runs on a completely different origin.
 */
import { z } from 'zod'
import { getTenant } from '@/lib/auth'
import { getSession, saveActions } from '@/lib/recording'
import type { RecordedAction } from '@/lib/recording'
import { ok, err, handleError } from '@/lib/api'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Recording-Token',
}

const ActionSchema = z.object({
  type:     z.enum(['navigate', 'click', 'fill', 'select', 'assert', 'screenshot']),
  url:      z.string().optional(),
  selector: z.string().optional(),
  value:    z.string().optional(),
  intent:   z.string().optional(),
})

const Body = z.object({
  startUrl: z.string().default(''),
  actions:  z.array(ActionSchema),
})

type Params = { params: Promise<{ sessionId: string }> }

// OPTIONS — CORS preflight
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}

// PUT — bookmarklet submits recorded steps
export async function PUT(req: Request, { params }: Params) {
  try {
    const { sessionId } = await params
    const token = req.headers.get('x-recording-token') ?? ''

    let body: z.infer<typeof Body>
    try { body = Body.parse(await req.json()) }
    catch { return new Response(JSON.stringify({ error: 'Bad request' }), { status: 400, headers: CORS }) }

    const saved = await saveActions(sessionId, token, body.startUrl, body.actions as RecordedAction[])
    if (!saved) {
      return new Response(JSON.stringify({ error: 'Invalid session, token, or session expired' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
    return new Response(JSON.stringify({ saved: true, count: body.actions.length }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
}

// GET — CT app polls for session status
export async function GET(_req: Request, { params }: Params) {
  try {
    const { tenantId } = await getTenant()
    const { sessionId } = await params

    const session = await getSession(sessionId, tenantId)
    if (!session) return err('Session not found or expired', 404)

    return ok({
      sessionId:   session.id,
      status:      session.status,
      startUrl:    session.startUrl,
      actions:     session.actions,
      actionCount: session.actions.length,
      savedAt:     session.savedAt,
    })
  } catch (e) { return handleError(e) }
}
