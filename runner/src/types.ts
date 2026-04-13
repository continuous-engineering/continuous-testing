export type StepType = 'api' | 'ui' | 'ai'
export type StepStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped' | 'blocked'

export type StepDef = {
  id: string
  name: string
  type: StepType
  prerequisites: string[]
  outputs: Record<string, string>
  config: Record<string, unknown>
  on_failure: 'stop' | 'continue'
  timeout_ms: number
  position: number
}

export type RunContext = {
  runId: string
  tenantId: string
  runnerId: string
  env: Record<string, string>
  secrets: Record<string, string>
  mockPort?: number     // json-server port for this run
  apiBaseUrl: string    // CT SaaS API base URL
  runnerToken: string   // for posting results back
}

export type AssertionResult = {
  name: string
  passed: boolean
  expected: unknown
  actual: unknown
}

export type Artifact = {
  type: 'video' | 'trace' | 'screenshot' | 'har'
  url: string
  sizeBytes: number
}

export type StepResult = {
  stepId: string
  status: StepStatus
  startedAt: Date
  completedAt: Date
  durationMs: number
  ctxOutputs: Record<string, unknown>
  responseBody: string | null
  responseMeta: Record<string, unknown>
  assertions: AssertionResult[]
  errorMessage: string | null
  artifacts: Artifact[]
}
