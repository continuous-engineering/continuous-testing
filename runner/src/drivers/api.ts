import { z } from 'zod'
import type { StepDef, StepResult, AssertionResult, RunContext } from '../types'
import { interpolate, extractPath } from '../interpolate'

const AssertionSchema = z.object({
  type:     z.enum(['status', 'header', 'jsonpath', 'regex', 'latency']),
  target:   z.string().optional(),
  operator: z.enum(['eq', 'ne', 'lt', 'gt', 'lte', 'gte', 'contains', 'matches']),
  expected: z.union([z.string(), z.number(), z.boolean()]),
})

const ApiConfig = z.object({
  method:     z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']),
  url:        z.string(),
  headers:    z.record(z.string()).default({}),
  body:       z.unknown().optional(),
  auth:       z.object({ type: z.enum(['none', 'bearer', 'basic', 'api-key']), value: z.string() }).optional(),
  assertions: z.array(AssertionSchema).default([]),
})

type AssertionDef = z.infer<typeof AssertionSchema>

export async function runApiStep(
  step: StepDef,
  ctx: Record<string, unknown>,
  runCtx: RunContext,
): Promise<StepResult> {
  const startedAt = new Date()
  const rawConfig = interpolate(step.config, ctx, runCtx.env, runCtx.secrets, runCtx.row) as Record<string, unknown>
  const config = ApiConfig.parse(rawConfig)

  let responseBody = ''
  let responseStatus = 0
  let responseHeaders: Record<string, string> = {}
  let latencyMs = 0
  let fetchError: string | null = null

  try {
    const headers: Record<string, string> = { ...config.headers }
    if (config.auth?.type === 'bearer') headers['Authorization'] = `Bearer ${config.auth.value}`
    if (config.auth?.type === 'basic')  headers['Authorization'] = `Basic ${Buffer.from(config.auth.value).toString('base64')}`
    if (config.auth?.type === 'api-key') headers['X-API-Key'] = config.auth.value

    const start = Date.now()
    const res = await fetch(config.url, {
      method: config.method,
      headers,
      body: config.body != null ? JSON.stringify(config.body) : undefined,
    })
    latencyMs = Date.now() - start
    responseStatus = res.status
    responseBody = await res.text()
    res.headers.forEach((v, k) => { responseHeaders[k] = v })
  } catch (e) {
    fetchError = e instanceof Error ? e.message : String(e)
  }

  let parsedBody: unknown = responseBody
  try { parsedBody = JSON.parse(responseBody) } catch { /* leave as string */ }

  const assertions: AssertionResult[] = fetchError
    ? []
    : (config.assertions as AssertionDef[]).map((a) =>
        evaluateAssertion(a, responseStatus, responseHeaders, parsedBody, latencyMs),
      )

  const completedAt = new Date()
  return {
    stepId: step.id,
    status: !fetchError && assertions.every((a) => a.passed) ? 'passed' : 'failed',
    startedAt, completedAt,
    durationMs: completedAt.getTime() - startedAt.getTime(),
    ctxOutputs: {},
    responseBody, responseMeta: { status: responseStatus, headers: responseHeaders, latencyMs },
    assertions, errorMessage: fetchError, artifacts: [],
  }
}

function evaluateAssertion(
  a: AssertionDef, status: number,
  headers: Record<string, string>, body: unknown, latencyMs: number,
): AssertionResult {
  let actual: unknown
  switch (a.type) {
    case 'status':   actual = status; break
    case 'header':   actual = headers[a.target?.toLowerCase() ?? '']; break
    case 'jsonpath': actual = extractPath(body, a.target ?? ''); break
    case 'regex':    actual = typeof body === 'string' ? body : JSON.stringify(body); break
    case 'latency':  actual = latencyMs; break
    default:         actual = null
  }
  const exp = a.expected
  let passed = false
  switch (a.operator) {
    case 'eq':       passed = actual == exp; break
    case 'ne':       passed = actual != exp; break
    case 'lt':       passed = Number(actual) < Number(exp); break
    case 'gt':       passed = Number(actual) > Number(exp); break
    case 'lte':      passed = Number(actual) <= Number(exp); break
    case 'gte':      passed = Number(actual) >= Number(exp); break
    case 'contains': passed = String(actual).includes(String(exp)); break
    case 'matches':  passed = new RegExp(String(exp)).test(String(actual)); break
  }
  return {
    name: `${a.type}${a.target ? ` ${a.target}` : ''} ${a.operator} ${exp}`,
    passed, expected: exp, actual,
  }
}
