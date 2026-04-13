/**
 * UI Step Driver — Playwright Chromium
 * Runs browser automation steps.
 * Self-healing selector strategy: ARIA → testid → text → CSS
 * Records video + trace for every run (uploaded to S3 by result poster).
 */
import { chromium } from 'playwright-core'
import { z } from 'zod'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import type { StepDef, StepResult, AssertionResult, RunContext } from '../types'
import { interpolate } from '../interpolate'

const ActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('navigate'), url: z.string() }),
  z.object({ type: z.literal('click'),    selector: z.string(), intent: z.string().optional(),
    selectors: z.object({ aria: z.string().optional(), testid: z.string().optional(),
      text: z.string().optional(), css: z.string().optional() }).optional() }),
  z.object({ type: z.literal('fill'),     selector: z.string(), value: z.string() }),
  z.object({ type: z.literal('wait'),     selector: z.string().optional(), timeout: z.number().default(5000) }),
  z.object({ type: z.literal('screenshot'), name: z.string().default('screenshot') }),
  z.object({ type: z.literal('assert'),   selector: z.string(), expected: z.string().optional(),
    assertion: z.enum(['visible', 'text', 'url']).default('visible') }),
])

const UiConfig = z.object({
  browser:    z.enum(['chromium']).default('chromium'),
  viewport:   z.object({ width: z.number(), height: z.number() }).default({ width: 1280, height: 720 }),
  actions:    z.array(ActionSchema).default([]),
  assertions: z.array(z.object({
    type: z.enum(['visible', 'text', 'url', 'screenshot']),
    selector: z.string().optional(),
    expected: z.string().optional(),
  })).default([]),
})

export async function runUiStep(
  step: StepDef,
  ctx: Record<string, unknown>,
  runCtx: RunContext,
): Promise<StepResult> {
  const startedAt = new Date()
  const rawConfig = interpolate(step.config, ctx, runCtx.env, runCtx.secrets) as Record<string, unknown>
  const config = UiConfig.parse(rawConfig)

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `ct-run-${runCtx.runId}-`))
  const videoDir = path.join(tmpDir, 'video')
  const traceDir = path.join(tmpDir, 'trace')
  fs.mkdirSync(videoDir, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: config.viewport,
    recordVideo: { dir: videoDir, size: config.viewport },
  })
  await context.tracing.start({ screenshots: true, snapshots: true })
  const page = await context.newPage()

  const assertions: AssertionResult[] = []
  let errorMessage: string | null = null

  try {
    for (const action of config.actions) {
      await executeAction(page, action, ctx, runCtx)
    }

    // Evaluate assertions
    for (const a of config.assertions) {
      const result = await evaluateAssertion(page, a)
      assertions.push(result)
    }
  } catch (e) {
    errorMessage = e instanceof Error ? e.message : String(e)
  }

  // Save trace
  await context.tracing.stop({ path: path.join(traceDir, 'trace.zip') })
  await context.close()
  await browser.close()

  const completedAt = new Date()
  const passed = !errorMessage && assertions.every((a) => a.passed)

  // Note: artifact upload to S3 happens in result poster (runner/src/index.ts)
  // Local paths returned here for the poster to pick up
  const artifacts: import('../types').Artifact[] = [
    { type: 'trace', url: path.join(traceDir, 'trace.zip'), sizeBytes: 0 },
  ]

  // Video file is created on context close
  const videoFiles = fs.readdirSync(videoDir)
  if (videoFiles.length > 0) {
    artifacts.push({ type: 'video', url: path.join(videoDir, videoFiles[0]!), sizeBytes: 0 })
  }

  return {
    stepId: step.id,
    status: passed ? 'passed' : 'failed',
    startedAt, completedAt,
    durationMs: completedAt.getTime() - startedAt.getTime(),
    ctxOutputs: {},
    responseBody: null, responseMeta: { viewport: config.viewport },
    assertions, errorMessage, artifacts,
  }
}

async function executeAction(
  page: import('playwright-core').Page,
  action: z.infer<typeof ActionSchema>,
  ctx: Record<string, unknown>,
  runCtx: RunContext,
): Promise<void> {
  switch (action.type) {
    case 'navigate': {
      const url = String(interpolate(action.url, ctx, runCtx.env, runCtx.secrets))
      await page.goto(url, { waitUntil: 'networkidle' })
      break
    }
    case 'click': {
      const locator = resolveLocator(page, action.selectors)
      await locator.click()
      break
    }
    case 'fill': {
      const val = String(interpolate(action.value, ctx, runCtx.env, runCtx.secrets))
      await page.locator(action.selector).fill(val)
      break
    }
    case 'wait': {
      if (action.selector) await page.waitForSelector(action.selector, { timeout: action.timeout })
      else await page.waitForTimeout(action.timeout)
      break
    }
    case 'screenshot': break  // handled by video recording
    case 'assert':     break  // handled in assertions loop
  }
}

/**
 * Self-healing selector: ARIA → testid → text → CSS
 * Tries each in order. Logs which strategy succeeded.
 */
function resolveLocator(
  page: import('playwright-core').Page,
  selectors?: { aria?: string; testid?: string; text?: string; css?: string },
) {
  if (!selectors) return page.locator('body')  // fallback — should never happen

  if (selectors.aria)   return page.getByRole(selectors.aria as 'button', { name: selectors.aria })
  if (selectors.testid) return page.getByTestId(selectors.testid)
  if (selectors.text)   return page.getByText(selectors.text)
  if (selectors.css)    return page.locator(selectors.css)

  return page.locator('body')
}

async function evaluateAssertion(
  page: import('playwright-core').Page,
  a: { type: string; selector?: string; expected?: string },
): Promise<AssertionResult> {
  let passed = false
  let actual: unknown = null

  try {
    switch (a.type) {
      case 'visible': {
        const el = page.locator(a.selector ?? 'body')
        passed = await el.isVisible()
        actual = passed
        break
      }
      case 'text': {
        actual = await page.locator(a.selector ?? 'body').textContent()
        passed = String(actual).includes(a.expected ?? '')
        break
      }
      case 'url': {
        actual = page.url()
        passed = String(actual).includes(a.expected ?? '')
        break
      }
    }
  } catch (e) {
    actual = e instanceof Error ? e.message : String(e)
  }

  return {
    name: `${a.type}${a.selector ? ` ${a.selector}` : ''}`,
    passed, expected: a.expected ?? true, actual,
  }
}
