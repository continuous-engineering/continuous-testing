import { z } from 'zod'

// ─── Step config schemas per type ────────────────────────────────────────────

const HttpMethod = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])

const AssertionSchema = z.object({
  type:     z.enum(['status', 'header', 'jsonpath', 'regex', 'latency']),
  target:   z.string().optional(),   // header name or jsonpath expression
  operator: z.enum(['eq', 'ne', 'lt', 'gt', 'lte', 'gte', 'contains', 'matches']),
  expected: z.union([z.string(), z.number(), z.boolean()]),
})

export const ApiStepConfig = z.object({
  method:     HttpMethod,
  url:        z.string().min(1),
  headers:    z.record(z.string()).default({}),
  body:       z.unknown().optional(),
  auth:       z.object({ type: z.enum(['none', 'bearer', 'basic', 'api-key']), value: z.string() }).optional(),
  assertions: z.array(AssertionSchema).default([]),
})

export const UiStepConfig = z.object({
  browser:    z.enum(['chromium', 'firefox', 'webkit']).default('chromium'),
  viewport:   z.object({ width: z.number(), height: z.number() }).optional(),
  actions:    z.array(z.object({
    type:     z.enum(['navigate', 'click', 'fill', 'select', 'wait', 'screenshot', 'assert']),
    selector: z.string().optional(),
    value:    z.string().optional(),
    url:      z.string().optional(),
    intent:   z.string().optional(),   // semantic description for self-healing
    selectors: z.object({
      aria:    z.string().optional(),
      testid:  z.string().optional(),
      text:    z.string().optional(),
      css:     z.string().optional(),
    }).optional(),
  })).default([]),
  assertions: z.array(z.object({
    type:    z.enum(['visible', 'text', 'url', 'screenshot']),
    selector: z.string().optional(),
    expected: z.string().optional(),
  })).default([]),
})

export const AiStepConfig = z.object({
  prompt:           z.string().min(1),
  expected_response: z.string().min(1),
  threshold:        z.number().min(0).max(1).default(0.8),
  agent_url:        z.string().url().optional(),   // override default agent endpoint
  body_template:    z.record(z.unknown()).optional(),
  response_path:    z.string().optional(),          // jsonpath to extract response text
})

export const StepConfigByType = { api: ApiStepConfig, ui: UiStepConfig, ai: AiStepConfig } as const
export type StepType = keyof typeof StepConfigByType

// ─── DAG cycle detection ──────────────────────────────────────────────────────

type StepNode = { id: string; prerequisites: string[] }

/**
 * Kahn's algorithm — returns null if acyclic, or the cycle node IDs if cyclic.
 */
export function detectCycle(steps: StepNode[]): string[] | null {
  const inDegree = new Map<string, number>()
  const adj = new Map<string, string[]>()

  for (const s of steps) {
    if (!inDegree.has(s.id)) inDegree.set(s.id, 0)
    if (!adj.has(s.id)) adj.set(s.id, [])
    for (const pre of s.prerequisites) {
      inDegree.set(s.id, (inDegree.get(s.id) ?? 0) + 1)
      const children = adj.get(pre) ?? []
      children.push(s.id)
      adj.set(pre, children)
    }
  }

  const queue = [...inDegree.entries()].filter(([, d]) => d === 0).map(([id]) => id)
  let visited = 0

  while (queue.length > 0) {
    const node = queue.shift()!
    visited++
    for (const child of adj.get(node) ?? []) {
      const deg = (inDegree.get(child) ?? 0) - 1
      inDegree.set(child, deg)
      if (deg === 0) queue.push(child)
    }
  }

  if (visited === steps.length) return null
  // Return IDs still stuck in cycle
  return [...inDegree.entries()].filter(([, d]) => d > 0).map(([id]) => id)
}
