/**
 * GET /api/runs/:runId/stream
 * Server-Sent Events — streams step results to the frontend as they complete.
 */
import { getTenant } from '@/lib/auth'
import { withTenant } from '@/lib/db/query'
import { handleError } from '@/lib/api'
import { subscribeToRun } from '@/lib/sse'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ runId: string }> }

export async function GET(_req: Request, { params }: Params) {
  try {
    const { tenantId } = await getTenant()
    const { runId } = await params

    const runs = await withTenant(tenantId, (q) => q('runs/get-by-id', [runId]))
    if (!runs.length) return new Response('Not found', { status: 404 })

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        const emit = (data: string) => {
          try { controller.enqueue(encoder.encode(data)) } catch { /* disconnected */ }
        }

        const unsubscribe = subscribeToRun(runId, emit)
        emit(`data: ${JSON.stringify({ type: 'connected', runId })}\n\n`)

        return unsubscribe
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type':  'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection':    'keep-alive',
      },
    })
  } catch (e) { return handleError(e) }
}
