import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import type { StepDef, StepResult, RunContext } from '../types'
import { interpolate } from '../interpolate'

let _client: Anthropic | null = null
function client(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _client
}

const AiConfig = z.object({
  prompt:            z.string(),
  expected_response: z.string(),
  threshold:         z.number().min(0).max(1).default(0.8),
  agent_url:         z.string().url().optional(),
  body_template:     z.record(z.unknown()).optional(),
  response_path:     z.string().optional(),
})

export async function runAiStep(
  step: StepDef,
  ctx: Record<string, unknown>,
  runCtx: RunContext,
): Promise<StepResult> {
  const startedAt = new Date()
  const rawConfig = interpolate(step.config, ctx, runCtx.env, runCtx.secrets) as Record<string, unknown>
  const config = AiConfig.parse(rawConfig)

  let agentResponse = ''
  let fetchError: string | null = null
  let latencyMs = 0

  if (config.agent_url) {
    try {
      const body = config.body_template ?? { message: config.prompt }
      const start = Date.now()
      const res = await fetch(config.agent_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(interpolate(body, ctx, runCtx.env, runCtx.secrets)),
      })
      latencyMs = Date.now() - start
      const json = await res.json() as Record<string, unknown>

      if (config.response_path) {
        agentResponse = String(extractNested(json, config.response_path) ?? '')
      } else {
        const choices = json['choices']
        const first = Array.isArray(choices) ? choices[0] : undefined
        const msg = first && typeof first === 'object' ? (first as Record<string, unknown>)['message'] : undefined
        const content = msg && typeof msg === 'object' ? (msg as Record<string, unknown>)['content'] : undefined
        agentResponse = String(content ?? json['response'] ?? json['content'] ?? json['text'] ?? JSON.stringify(json))
      }
    } catch (e) {
      fetchError = e instanceof Error ? e.message : String(e)
    }
  } else {
    agentResponse = config.prompt
  }

  if (fetchError) {
    const completedAt = new Date()
    return {
      stepId: step.id, status: 'failed', startedAt, completedAt,
      durationMs: completedAt.getTime() - startedAt.getTime(),
      ctxOutputs: {}, responseBody: null, responseMeta: {},
      assertions: [], errorMessage: fetchError, artifacts: [],
    }
  }

  const score = await computeSemanticScore(config.expected_response, agentResponse)
  const passed = score >= config.threshold
  const completedAt = new Date()

  return {
    stepId: step.id,
    status: passed ? 'passed' : 'failed',
    startedAt, completedAt,
    durationMs: completedAt.getTime() - startedAt.getTime(),
    ctxOutputs: {},
    responseBody: agentResponse,
    responseMeta: { score, threshold: config.threshold, latencyMs },
    assertions: [{ name: `semantic_similarity >= ${config.threshold}`, passed, expected: config.threshold, actual: score }],
    errorMessage: null, artifacts: [],
  }
}

async function computeSemanticScore(expected: string, actual: string): Promise<number> {
  const msg = await client().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 10,
    messages: [{
      role: 'user',
      content: `Rate semantic similarity 0.00-1.00 (two decimal places only, no other text):\nExpected: ${expected}\nActual: ${actual}`,
    }],
  })
  const text = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : '0'
  const score = parseFloat(text)
  return isNaN(score) ? 0 : Math.min(1, Math.max(0, score))
}

function extractNested(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((cur, key) => {
    if (cur && typeof cur === 'object') return (cur as Record<string, unknown>)[key]
    return undefined
  }, obj)
}
