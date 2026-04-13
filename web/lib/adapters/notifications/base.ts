export type NotificationEvent =
  | 'run_failed'
  | 'run_passed'
  | 'regression_detected'
  | 'flaky_detected'
  | 'coverage_dropped'

export type NotificationPayload = {
  event:       NotificationEvent
  tenantId:    string
  projectName: string
  pipelineName: string
  runId:       string
  runUrl:      string
  summary:     { passed: number; failed: number; total: number }
  timestamp:   string
}

export interface NotificationAdapter {
  send(payload: NotificationPayload): Promise<void>
}
