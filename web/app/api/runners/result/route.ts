/**
 * POST /api/runners/result
 * Runner posts step results as they complete (streamed, one per step).
 * Also posts final run completion with runner_minutes for billing.
 * Auth via X-Runner-Token.
 */
import { z } from 'zod'
import { createHash } from 'crypto'
import { one, query } from '@/lib/db/query'
import pool from '@/lib/db/client'
import { readFileSync } from 'fs'
import { join } from 'path'
import { ok, err, handleError } from '@/lib/api'
import { emitRunEvent } from '@/lib/sse'

function sqlFile(name: string) {
  return readFileSync(join(process.cwd(), 'lib', 'queries', `${name}.sql`), 'utf-8')
}

const StepResultBody = z.object({
  jobId:       z.string(),
  runId:       z.string().uuid(),
  stepId:      z.string().uuid(),
  status:      z.enum(['passed', 'failed', 'skipped', 'blocked']),
  startedAt:   z.string().datetime(),
  completedAt: z.string().datetime(),
  durationMs:  z.number(),
  ctxOutputs:  z.record(z.unknown()).default({}),
  responseBody: z.string().nullable().default(null),
  responseMeta: z.record(z.unknown()).default({}),
  assertions:  z.array(z.object({
    name: z.string(), passed: z.boolean(),
    expected: z.unknown(), actual: z.unknown(),
  })).default([]),
  errorMessage: z.string().nullable().default(null),
  artifacts:   z.array(z.object({
    type: z.string(), url: z.string(), sizeBytes: z.number(),
  })).default([]),
})

const RunCompleteBody = z.object({
  jobId:        z.string(),
  runId:        z.string().uuid(),
  runnerId:     z.string().uuid(),
  runnerScope:  z.enum(['hosted', 'self-hosted']),
  runnerMinutes: z.number(),
  finalStatus:  z.enum(['passed', 'failed', 'cancelled']),
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
    const runner = await one<{ id: string; tenant_id: string; scope: string }>(
      'runners/get-by-token-hash', [tokenHash],
    )
    if (!runner) return err('Invalid runner token', 401)

    const tenantId = runner.tenant_id
    const body = Body.parse(await req.json())

    if (body.type === 'step_result') {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query(`SET LOCAL app.tenant_id = '${tenantId}'`)
        await client.query(sqlFile('runs/upsert-result'), [
          body.runId, body.stepId, body.status,
          body.startedAt, body.completedAt, body.durationMs,
          JSON.stringify(body.ctxOutputs), body.responseBody,
          JSON.stringify(body.responseMeta), JSON.stringify(body.assertions),
          body.errorMessage, JSON.stringify(body.artifacts),
        ])
        await client.query('COMMIT')
      } finally {
        client.release()
      }

      // Emit to SSE listeners
      emitRunEvent(body.runId, {
        type: 'step_result', stepId: body.stepId,
        status: body.status, durationMs: body.durationMs,
        assertions: body.assertions,
      })

      return ok({ received: true })
    }

    if (body.type === 'run_complete') {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query(`SET LOCAL app.tenant_id = '${tenantId}'`)
        await client.query(sqlFile('runs/update-status'), [
          body.runId, body.finalStatus, body.runnerId, body.runnerMinutes,
        ])
        await client.query(sqlFile('runs/update-step-counts'), [body.runId])
        // ADR-002: append billing record
        await client.query(sqlFile('runs/record-usage'), [
          tenantId, body.runId, body.runnerId, body.runnerScope, body.runnerMinutes,
        ])
        await client.query('COMMIT')
      } finally {
        client.release()
      }

      emitRunEvent(body.runId, { type: 'run_complete', status: body.finalStatus })

      // Dispatch notifications — fire and forget, never blocks result response
      if (body.finalStatus === 'failed') {
        const runs = await query<Record<string, unknown>>('runs/get-by-id', [body.runId])
        const run = runs[0]
        if (run) {
          const { dispatch } = await import('@/lib/adapters/notifications/dispatcher')
          const pipelineRows = await query<Record<string, unknown>>('pipelines/get-with-steps', [run['pipeline_id'] as string])
          const pipeline = pipelineRows[0] as Record<string, unknown> | undefined
          const notifConfig = (pipeline?.['notification_config'] ?? null) as Parameters<typeof dispatch>[2]
          await dispatch('run_failed', {
            event:        'run_failed',
            tenantId,
            projectName:  '',
            pipelineName: String(pipeline?.['name'] ?? 'unknown'),
            runId:        body.runId,
            runUrl:       `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/runs/${body.runId}`,
            summary: {
              passed:  Number(run['passed_steps'] ?? 0),
              failed:  Number(run['failed_steps']  ?? 0),
              total:   Number(run['total_steps']   ?? 0),
            },
            timestamp: new Date().toISOString(),
          }, notifConfig).catch(() => { /* notification failure never breaks run result */ })
        }
      }

      return ok({ received: true })
    }

    return err('Unknown event type', 400)
  } catch (e) { return handleError(e) }
}
