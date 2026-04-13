/**
 * DAG Executor — ADR-001
 * One DAG = one runner = one process = one ctx map.
 * Runs steps in topological waves (Kahn's algorithm).
 * Steps within a wave run concurrently via Promise.all.
 */
import type { StepDef, StepResult, CtxMap, RunContext } from './types'
import { runApiStep } from './drivers/api'
import { runAiStep }  from './drivers/ai'
import { extractPath } from './interpolate'

export type StepResultCallback = (result: StepResult) => Promise<void>

export async function executeDag(
  steps: StepDef[],
  runCtx: RunContext,
  onStepResult: StepResultCallback,
): Promise<{ passed: boolean; results: StepResult[] }> {
  const ctx: CtxMap = {}
  const results: StepResult[] = []
  const failed = new Set<string>()   // step IDs that failed (propagates to dependents)

  // Build adjacency + in-degree for Kahn's algo
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
    // Execute entire wave concurrently
    const waveResults = await Promise.all(
      wave.map(async (step) => {
        // Check if any prerequisite failed
        const blockedBy = step.prerequisites.find((p) => failed.has(p))
        if (blockedBy) {
          const result: StepResult = {
            stepId: step.id,
            status: step.on_failure === 'stop' ? 'skipped' : 'blocked',
            startedAt: new Date(),
            completedAt: new Date(),
            durationMs: 0,
            ctxOutputs: {},
            responseBody: null,
            responseMeta: {},
            assertions: [],
            errorMessage: `Prerequisite step ${blockedBy} failed`,
            artifacts: [],
          }
          await onStepResult(result)
          return result
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
          // Mark all remaining as skipped — drain wave queue
          const remaining = steps.filter(
            (s) => !results.find((r) => r.stepId === s.id),
          )
          for (const s of remaining) {
            const skipped: StepResult = {
              stepId: s.id, status: 'skipped', startedAt: new Date(),
              completedAt: new Date(), durationMs: 0, ctxOutputs: {},
              responseBody: null, responseMeta: {}, assertions: [],
              errorMessage: 'Upstream step failed with on_failure=stop', artifacts: [],
            }
            results.push(skipped)
            await onStepResult(skipped)
          }
          return { passed: false, results }
        }
      }
      // Merge outputs into ctx
      for (const [key, value] of Object.entries(result.ctxOutputs)) {
        ctx[key] = value
      }
      // Decrement in-degree for dependents
      for (const dep of dependents.get(result.stepId) ?? []) {
        inDegree.set(dep, (inDegree.get(dep) ?? 1) - 1)
      }
    }

    // Next wave = steps with in-degree 0 not yet run
    wave = steps.filter(
      (s) => (inDegree.get(s.id) ?? 0) === 0 && !results.find((r) => r.stepId === s.id),
    )
  }

  const passed = results.every((r) => r.status === 'passed' || r.status === 'skipped')
  return { passed, results }
}

async function runStep(
  step: StepDef,
  ctx: CtxMap,
  runCtx: RunContext,
  onStepResult: StepResultCallback,
): Promise<StepResult> {
  const startedAt = new Date()

  let result: StepResult
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Step timed out after ${step.timeout_ms}ms`)), step.timeout_ms),
    )

    const stepPromise: Promise<StepResult> = (() => {
      switch (step.type) {
        case 'api': return runApiStep(step, ctx, runCtx)
        case 'ai':  return runAiStep(step, ctx, runCtx)
        case 'ui':  return Promise.resolve(notImplemented(step, startedAt, 'UI driver runs in B05'))
      }
    })()

    result = await Promise.race([stepPromise, timeoutPromise])
  } catch (e) {
    const completedAt = new Date()
    result = {
      stepId: step.id,
      status: 'failed',
      startedAt,
      completedAt,
      durationMs: completedAt.getTime() - startedAt.getTime(),
      ctxOutputs: {},
      responseBody: null,
      responseMeta: {},
      assertions: [],
      errorMessage: e instanceof Error ? e.message : String(e),
      artifacts: [],
    }
  }

  // Extract declared outputs into ctx
  const ctxOutputs: Record<string, unknown> = {}
  if (result.responseBody) {
    let parsed: unknown
    try { parsed = JSON.parse(result.responseBody) } catch { parsed = result.responseBody }
    for (const [key, path] of Object.entries(step.outputs)) {
      ctxOutputs[key] = extractPath(parsed, path)
    }
  }
  result.ctxOutputs = ctxOutputs

  await onStepResult(result)
  return result
}

function notImplemented(step: StepDef, startedAt: Date, reason: string): StepResult {
  return {
    stepId: step.id, status: 'failed', startedAt, completedAt: new Date(),
    durationMs: 0, ctxOutputs: {}, responseBody: null, responseMeta: {},
    assertions: [], errorMessage: reason, artifacts: [],
  }
}
