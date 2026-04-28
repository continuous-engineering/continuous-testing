export type StepType = 'api' | 'ui' | 'ai'
export type StepStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped' | 'blocked'

export type StepDef = {
  id: string
  name: string
  type: StepType
  prerequisites: string[]
  outputs: Record<string, string>   // { "token": "$.response.body.access_token" }
  config: Record<string, unknown>
  on_failure: 'stop' | 'continue'
  timeout_ms: number
  position: number
}

export type RunContext = {
  runId: string
  tenantId: string
  pipelineId: string
  environmentId: string | null
  runnerId: string
  env: Record<string, string>        // env vars (plaintext)
  secrets: Record<string, string>    // decrypted secrets (in-memory only)
  row: Record<string, unknown>       // dataset row snapshot — {{row.KEY}}
}

export type StepResult = {
  stepId: string
  status: StepStatus
  startedAt: Date
  completedAt: Date
  durationMs: number
  ctxOutputs: Record<string, unknown>   // exported values for downstream ctx
  responseBody: string | null
  responseMeta: Record<string, unknown>
  assertions: AssertionResult[]
  errorMessage: string | null
  artifacts: Artifact[]
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

export type CtxMap = Record<string, unknown>  // live key-value store passed between steps
