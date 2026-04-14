'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { StepStatusBadge, type StepStatus } from '@/components/domain/StepStatusBadge'
import { RunSummaryBar } from '@/components/domain/RunSummaryBar'

type Assertion = { name: string; passed: boolean; expected: unknown; actual: unknown }

type StepResult = {
  id: string; step_id: string; status: StepStatus
  started_at: string; completed_at: string; duration_ms: number
  assertions: Assertion[]; error_message: string | null
  response_body: string | null; response_meta: Record<string, unknown>
  ctx_outputs: Record<string, unknown>; artifacts: { type: string; url: string }[]
}

type RunDetail = {
  id: string; status: StepStatus; trigger: string
  started_at: string; completed_at: string | null; runner_minutes: number | null
  total_steps: number; passed_steps: number; failed_steps: number; skipped_steps: number
  pipeline_id: string; pipeline_name: string; project_id: string; project_name: string
  step_results: StepResult[]
}

function duration(ms: number): string {
  if (ms < 1000)  return `${ms}ms`
  if (ms < 60000) return `${(ms/1000).toFixed(1)}s`
  return `${Math.floor(ms/60000)}m ${Math.round((ms%60000)/1000)}s`
}

function elapsed(start: string, end: string | null): string {
  const ms = end ? new Date(end).getTime() - new Date(start).getTime()
    : Date.now() - new Date(start).getTime()
  return duration(ms)
}

const STATUS_BG: Partial<Record<StepStatus, string>> = {
  passed:  'rgba(16,185,129,0.06)',
  failed:  'rgba(239,68,68,0.06)',
  running: 'rgba(59,130,246,0.06)',
  skipped: 'transparent',
  pending: 'transparent',
}

export default function RunDetailPage() {
  const { runId } = useParams<{ runId: string }>()
  const router    = useRouter()
  const [run,     setRun]     = useState<RunDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch(`/api/runs/${runId}`)
      .then(r => r.json())
      .then((d: { data: RunDetail }) => {
        const r = d.data
        setRun(r)
        // Auto-expand failed steps
        const failedIds = new Set(r.step_results.filter(s => s.status === 'failed').map(s => s.step_id))
        setExpanded(failedIds)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [runId])

  function toggle(stepId: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(stepId) ? next.delete(stepId) : next.add(stepId)
      return next
    })
  }

  if (loading) return <div className="p-6 text-body" style={{ color: 'var(--ct-text-2)' }}>Loading run…</div>
  if (!run)    return <div className="p-6 text-body" style={{ color: 'var(--ct-fail)' }}>Run not found.</div>

  const resultMap = Object.fromEntries(run.step_results.map(r => [r.step_id, r]))
  const steps = run.step_results.map(r => ({ id: r.step_id, name: `Step ${r.step_id.slice(0,8)}`, type: 'api' }))

  return (
    <div className="p-6 flex flex-col gap-6 max-w-3xl">
      {/* Back */}
      <button onClick={() => router.push('/runs')}
        className="text-caption self-start" style={{ color: 'var(--ct-text-3)' }}>
        ← All runs
      </button>

      {/* Run header */}
      <div className="rounded-md border p-5 flex flex-col gap-4"
        style={{ borderColor: 'var(--ct-border)', background: 'var(--ct-surface)', borderLeftWidth: 3,
          borderLeftColor: run.status === 'passed' ? 'var(--ct-pass)' : run.status === 'failed' ? 'var(--ct-fail)' : 'var(--ct-running)' }}>
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <StepStatusBadge status={run.status} />
              <span className="text-heading font-semibold" style={{ color: 'var(--ct-text-1)' }}>
                {run.pipeline_name}
              </span>
            </div>
            <span className="text-caption font-mono" style={{ color: 'var(--ct-text-3)' }}>{run.id}</span>
          </div>
          <div className="text-right flex flex-col gap-1">
            <span className="text-caption" style={{ color: 'var(--ct-text-2)' }}>
              {elapsed(run.started_at, run.completed_at)} total
            </span>
            <span className="text-caption" style={{ color: 'var(--ct-text-3)' }}>
              {run.trigger} · {new Date(run.started_at).toLocaleString()}
            </span>
            {run.runner_minutes != null && (
              <span className="text-caption" style={{ color: 'var(--ct-text-3)' }}>
                {run.runner_minutes.toFixed(2)} runner-min
              </span>
            )}
          </div>
        </div>

        <RunSummaryBar
          passed={run.passed_steps} failed={run.failed_steps}
          skipped={run.skipped_steps} running={0}
          total={run.total_steps}
        />

        <div className="flex gap-4 text-caption">
          <span style={{ color: 'var(--ct-pass)' }}>✓ {run.passed_steps} passed</span>
          {run.failed_steps > 0  && <span style={{ color: 'var(--ct-fail)' }}>✕ {run.failed_steps} failed</span>}
          {run.skipped_steps > 0 && <span style={{ color: 'var(--ct-text-3)' }}>↷ {run.skipped_steps} skipped</span>}
        </div>
      </div>

      {/* Step results */}
      <div className="flex flex-col gap-2">
        <h2 className="text-heading" style={{ color: 'var(--ct-text-1)' }}>Steps</h2>

        {steps.length === 0 && (
          <p className="text-body" style={{ color: 'var(--ct-text-3)' }}>No step results yet.</p>
        )}

        {steps.map((step, i) => {
          const result = resultMap[step.id]
          const isOpen = expanded.has(step.id)
          const status = result?.status ?? 'pending'

          return (
            <div key={step.id} className="rounded-md border overflow-hidden"
              style={{ borderColor: 'var(--ct-border)', background: STATUS_BG[status] ?? 'var(--ct-surface)' }}>
              {/* Step header — always visible */}
              <button onClick={() => result && toggle(step.id)}
                className="w-full flex items-center gap-3 px-4 text-left"
                style={{ height: 44, cursor: result ? 'pointer' : 'default' }}>
                <span className="text-caption flex-shrink-0 w-5 text-right tabular-nums"
                  style={{ color: 'var(--ct-text-3)' }}>{i + 1}</span>
                <StepStatusBadge status={status} showLabel={false} />
                <span className="text-body font-medium flex-1 min-w-0 truncate"
                  style={{ color: 'var(--ct-text-1)' }}>{step.name}</span>
                <span className="text-caption flex-shrink-0 px-1.5 py-0.5 rounded"
                  style={{ background: 'var(--ct-surface-overlay)', color: 'var(--ct-text-3)' }}>
                  {(step.type as string).toUpperCase()}
                </span>
                {result && (
                  <span className="text-caption flex-shrink-0 tabular-nums"
                    style={{ color: 'var(--ct-text-3)', width: 48, textAlign: 'right' }}>
                    {duration(result.duration_ms)}
                  </span>
                )}
                {(result?.assertions?.length ?? 0) > 0 && result && (
                  <span className="text-caption flex-shrink-0"
                    style={{ color: result.assertions.every(a => a.passed) ? 'var(--ct-pass)' : 'var(--ct-fail)' }}>
                    {result.assertions.filter(a => a.passed).length}/{result.assertions.length}
                  </span>
                )}
                {result && <span className="text-caption flex-shrink-0" style={{ color: 'var(--ct-text-3)' }}>{isOpen ? '▲' : '▼'}</span>}
              </button>

              {/* Expanded detail */}
              {result && isOpen && (
                <div className="flex flex-col gap-4 px-4 pb-4 border-t"
                  style={{ borderColor: 'var(--ct-border)' }}>

                  {/* Error */}
                  {result.error_message && (
                    <div className="flex flex-col gap-1 pt-3">
                      <p className="text-label" style={{ color: 'var(--ct-fail)' }}>Error</p>
                      <pre className="text-caption font-mono p-3 rounded whitespace-pre-wrap break-all"
                        style={{ background: 'rgba(239,68,68,0.08)', color: 'var(--ct-fail)', fontSize: 12, maxHeight: 160, overflow: 'auto' }}>
                        {result.error_message}
                      </pre>
                    </div>
                  )}

                  {/* Assertions */}
                  {result.assertions.length > 0 && (
                    <div className="flex flex-col gap-1.5 pt-3">
                      <p className="text-label" style={{ color: 'var(--ct-text-2)' }}>Assertions</p>
                      {result.assertions.map((a, ai) => (
                        <div key={ai} className="flex items-start gap-2">
                          <span className="flex-shrink-0 font-mono text-sm w-4"
                            style={{ color: a.passed ? 'var(--ct-pass)' : 'var(--ct-fail)' }}>
                            {a.passed ? '✓' : '✕'}
                          </span>
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="text-body" style={{ color: a.passed ? 'var(--ct-text-1)' : 'var(--ct-fail)' }}>
                              {a.name}
                            </span>
                            {!a.passed && (
                              <span className="text-caption font-mono" style={{ color: 'var(--ct-text-3)' }}>
                                expected <code>{JSON.stringify(a.expected)}</code> · got <code>{JSON.stringify(a.actual)}</code>
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Response */}
                  {result.response_body && (
                    <div className="flex flex-col gap-1.5 pt-2">
                      <div className="flex items-center gap-2">
                        <p className="text-label" style={{ color: 'var(--ct-text-2)' }}>Response</p>
                        {result.response_meta?.status != null && (
                          <code className="text-caption px-1.5 py-0.5 rounded"
                            style={{ background: 'var(--ct-surface-overlay)', color: 'var(--ct-accent-400)' }}>
                            {String(result.response_meta.status)}
                          </code>
                        )}
                        {result.response_meta?.latency_ms != null && (
                          <span className="text-caption" style={{ color: 'var(--ct-text-3)' }}>
                            {String(result.response_meta.latency_ms)}ms
                          </span>
                        )}
                      </div>
                      <pre className="text-caption font-mono p-3 rounded whitespace-pre-wrap break-all overflow-auto"
                        style={{ background: 'var(--ct-surface-overlay)', color: 'var(--ct-text-1)', fontSize: 11, maxHeight: 240 }}>
                        {(() => { try { return JSON.stringify(JSON.parse(result.response_body!), null, 2) } catch { return result.response_body } })()}
                      </pre>
                    </div>
                  )}

                  {/* Context outputs (for chained steps) */}
                  {Object.keys(result.ctx_outputs ?? {}).length > 0 && (
                    <div className="flex flex-col gap-1 pt-2">
                      <p className="text-label" style={{ color: 'var(--ct-text-2)' }}>Outputs (passed to next steps)</p>
                      <div className="flex flex-col gap-1">
                        {Object.entries(result.ctx_outputs).map(([k, v]) => (
                          <div key={k} className="flex items-center gap-2">
                            <code className="text-caption px-1.5 py-0.5 rounded"
                              style={{ background: 'var(--ct-surface-overlay)', color: 'var(--ct-accent-400)' }}>
                              {k}
                            </code>
                            <span className="text-caption font-mono" style={{ color: 'var(--ct-text-2)' }}>
                              {JSON.stringify(v)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Timing */}
                  <div className="flex gap-4 text-caption pt-1" style={{ color: 'var(--ct-text-3)' }}>
                    <span>Started {new Date(result.started_at).toLocaleTimeString()}</span>
                    <span>{duration(result.duration_ms)}</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
