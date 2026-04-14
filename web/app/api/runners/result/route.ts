/**
 * POST /api/runners/result
 * Runner posts step results as they complete, then final run completion.
 * Auth via X-Runner-Token. Public route — no Clerk.
 */
import { z } from 'zod'
import { createHash } from 'crypto'
import { raw, withTenant, query } from '@/lib/db/query'
import { ok, err, handleError } from '@/lib/api'
import { emitRunEvent } from '@/lib/sse'

const StepResultBody = z.object({
  jobId:        z.string(),
  runId:        z.string().uuid(),
  stepId:       z.string().uuid(),
  status:       z.enum(['passed', 'failed', 'skipped', 'blocked', 'running']),
  startedAt:    z.string().datetime(),
  completedAt:  z.string().datetime(),
  durationMs:   z.number(),
  ctxOutputs:   z.record(z.unknown()).default({}),
  responseBody: z.string().nullable().default(null),
  responseMeta: z.record(z.unknown()).default({}),
  assertions:   z.array(z.object({
    name: z.string(), passed: z.boolean(),
    expected: z.unknown(), actual: z.unknown(),
  })).default([]),
  errorMessage: z.string().nullable().default(null),
  artifacts:    z.array(z.object({
    type: z.string(), url: z.string(), sizeBytes: z.number(),
  })).default([]),
})

const RunCompleteBody = z.object({
  jobId:         z.string(),
  runId:         z.string().uuid(),
  runnerId:      z.string().uuid(),
  runnerScope:   z.enum(['hosted', 'self-hosted']),
  runnerMinutes: z.number(),
  finalStatus:   z.enum(['passed', 'failed', 'cancelled']),
})

const Body = z.discriminatedUnion('type', [
  z.object({ type: z.literal('step_result'), ...StepResultBody.shape }),
  z.object({ type: z.literal('run_complete'), ...RunCompleteBody.shape }),
])

export async function POST(req: Request) {
  try {
    const token = req.headers.get('x-runner-token')
    if (!token) return err('Missing X-Runner-Token', 401)

    const tokenHash = createHash('sha256').update(token).digest('hex')
    const rows = await raw<{ id: string; tenant_id: string; scope: string }>(
      `SELECT id, tenant_id, scope FROM runners WHERE token_hash = $1 AND revoked_at IS NULL`,
      [tokenHash],
    )
    const runner = rows[0] ?? null
    if (!runner) return err('Invalid runner token', 401)

    const body = Body.parse(await req.json())

    // Hosted runners have tenant_id = NULL — resolve tenant from the run itself.
    // Self-hosted runners always match their own tenant.
    let tenantId: string = runner.tenant_id
    if (!tenantId) {
      const runRows = await raw<{ tenant_id: string }>(
        `SELECT tenant_id FROM runs WHERE id = $1 LIMIT 1`,
        [body.runId],
      )
      tenantId = runRows[0]?.tenant_id ?? ''
    }
    if (!tenantId) return err('Cannot resolve tenant for run', 500)

    if (body.type === 'step_result') {
      // Skip the runner's synthetic "run started" signal (nil step UUID — not a real step)
      const NIL_STEP = '00000000-0000-0000-0000-000000000000'
      if (body.stepId === NIL_STEP) return ok({ received: true })

      await withTenant(tenantId, (q) =>
        q('runs/upsert-result', [
          body.runId, body.stepId, body.status,
          body.startedAt, body.completedAt, body.durationMs,
          JSON.stringify(body.ctxOutputs), body.responseBody,
          JSON.stringify(body.responseMeta), JSON.stringify(body.assertions),
          body.errorMessage, JSON.stringify(body.artifacts),
        ]),
      )

      emitRunEvent(body.runId, {
        type:         'step_result',
        stepId:       body.stepId,
        status:       body.status,
        durationMs:   body.durationMs,
        assertions:   body.assertions,
        errorMessage: body.errorMessage,
        responseBody: body.responseBody ? body.responseBody.slice(0, 4000) : null,
        responseMeta: body.responseMeta,
      })

      return ok({ received: true })
    }

    if (body.type === 'run_complete') {
      await withTenant(tenantId, async (q) => {
        await q('runs/update-status', [
          body.runId, body.finalStatus, body.runnerId, body.runnerMinutes,
        ])
        await q('runs/update-step-counts', [body.runId])
        await q('runs/record-usage', [
          tenantId, body.runId, body.runnerId, body.runnerScope, body.runnerMinutes,
        ])
      })

      emitRunEvent(body.runId, { type: 'run_complete', status: body.finalStatus })

      // Fire-and-forget notification on failure (non-blocking)
      if (body.finalStatus === 'failed') {
        withTenant(tenantId, async (q) => {
          const runs = await q<Record<string, unknown>>('runs/get-by-id', [body.runId])
          const run = runs[0]
          if (!run) return
          const pipelineRows = await q<Record<string, unknown>>('pipelines/get-with-steps', [run['pipeline_id'] as string])
          const pipeline = pipelineRows[0] as Record<string, unknown> | undefined
          if (!pipeline?.['notification_config']) return
          const { dispatch } = await import('@/lib/adapters/notifications/dispatcher')
          await dispatch('run_failed', {
            event: 'run_failed', tenantId,
            projectName: '', pipelineName: String(pipeline['name'] ?? ''),
            runId: body.runId,
            runUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/runs/${body.runId}`,
            summary: {
              passed: Number(run['passed_steps'] ?? 0),
              failed: Number(run['failed_steps'] ?? 0),
              total:  Number(run['total_steps'] ?? 0),
            },
            timestamp: new Date().toISOString(),
          }, pipeline['notification_config'] as Parameters<typeof dispatch>[2])
        }).catch(() => { /* notification failure never blocks result */ })
      }

      return ok({ received: true })
    }

    return err('Unknown event type', 400)
  } catch (e) { return handleError(e) }
}
