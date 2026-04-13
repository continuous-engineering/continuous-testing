import type { StepDef, StepResult, RunContext } from './types'
import { runApiStep } from './drivers/api'
import { runUiStep }  from './drivers/ui'
import { runAiStep }  from './drivers/ai'
import { extractPath } from './interpolate'

export async function executeDag(
  steps: StepDef[],
  runCtx: RunContext,
  onStepResult: (result: StepResult) => Promise<void>,
): Promise<{ passed: boolean; results: StepResult[] }> {
  const ctx: Record<string, unknown> = {}
  const results: StepResult[] = []
  const failed = new Set<string>()

  const inDegree = new Map<string, number>(steps.map((s) => [s.id, s.prerequisites.length]))
  const dependents = new Map<string, string[]>(steps.map((s) => [s.id, []]))
  for (const step of steps) {
    for (const prereq of step.prerequisites) {
      dependents.get(prereq)?.push(step.id)
    }
  }
  const stepById = new Map(steps.map((s) => [s.id, s]))
  let wave = steps.filter((s) => s.prerequisites.length === 0)

  while (wave.length > 0) {
    const waveResults = await Promise.all(
      wave.map(async (step) => {
        const blockedBy = step.prerequisites.find((p) => failed.has(p))
        if (blockedBy) {
          const r: StepResult = {
            stepId: step.id, status: step.on_failure === 'stop' ? 'skipped' : 'blocked',
            startedAt: new Date(), completedAt: new Date(), durationMs: 0,
            ctxOutputs: {}, responseBody: null, responseMeta: {},
            assertions: [], errorMessage: `Prerequisite ${blockedBy} failed`, artifacts: [],
          }
          await onStepResult(r)
          return r
        }
        return runStep(step, ctx, runCtx, onStepResult)
      }),
    )

    for (const result of waveResults) {
      results.push(result)
      if (result.status === 'failed') {
        failed.add(result.stepId)
        const step = stepById.get(result.stepId)!
        if (step.on_failure === 'stop') {
          const remaining = steps.filter((s) => !results.find((r) => r.stepId === s.id))
          for (const s of remaining) {
            const skipped: StepResult = {
              stepId: s.id, status: 'skipped', startedAt: new Date(),
              completedAt: new Date(), durationMs: 0, ctxOutputs: {},
              responseBody: null, responseMeta: {}, assertions: [],
              errorMessage: 'Upstream failure (on_failure=stop)', artifacts: [],
            }
            results.push(skipped)
            await onStepResult(skipped)
          }
          return { passed: false, results }
        }
      }
      for (const [key, value] of Object.entries(result.ctxOutputs)) ctx[key] = value
      for (const dep of dependents.get(result.stepId) ?? []) {
        inDegree.set(dep, (inDegree.get(dep) ?? 1) - 1)
      }
    }
    wave = steps.filter((s) => (inDegree.get(s.id) ?? 0) === 0 && !results.find((r) => r.stepId === s.id))
  }

  return {
    passed: results.every((r) => r.status === 'passed' || r.status === 'skipped'),
    results,
  }
}

async function runStep(
  step: StepDef,
  ctx: Record<string, unknown>,
  runCtx: RunContext,
  onStepResult: (result: StepResult) => Promise<void>,
): Promise<StepResult> {
  const startedAt = new Date()
  let result: StepResult
  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${step.timeout_ms}ms`)), step.timeout_ms),
    )
    const run: Promise<StepResult> = (() => {
      switch (step.type) {
        case 'api': return runApiStep(step, ctx, runCtx)
        case 'ui':  return runUiStep(step, ctx, runCtx)
        case 'ai':  return runAiStep(step, ctx, runCtx)
      }
    })()
    result = await Promise.race([run, timeout])
  } catch (e) {
    const completedAt = new Date()
    result = {
      stepId: step.id, status: 'failed', startedAt, completedAt,
      durationMs: completedAt.getTime() - startedAt.getTime(),
      ctxOutputs: {}, responseBody: null, responseMeta: {},
      assertions: [], errorMessage: e instanceof Error ? e.message : String(e), artifacts: [],
    }
  }

  // Extract declared outputs into ctx
  if (result.responseBody) {
    let parsed: unknown = result.responseBody
    try { parsed = JSON.parse(result.responseBody) } catch { /* leave as string */ }
    const ctxOutputs: Record<string, unknown> = {}
    for (const [key, pathExpr] of Object.entries(step.outputs)) {
      ctxOutputs[key] = extractPath(parsed, pathExpr)
    }
    result.ctxOutputs = ctxOutputs
  }

  await onStepResult(result)
  return result
}
