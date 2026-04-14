'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { StepStatusBadge, type StepStatus } from '@/components/domain/StepStatusBadge'
import { RunSummaryBar } from '@/components/domain/RunSummaryBar'

type Run = {
  id: string; status: StepStatus; trigger: string
  started_at: string; completed_at: string | null; runner_minutes: number | null
  total_steps: number; passed_steps: number; failed_steps: number; skipped_steps: number
  pipeline_id: string; pipeline_name: string; project_id: string; project_name: string
}

const STATUS_FILTERS: (StepStatus | '')[] = ['', 'failed', 'passed', 'running', 'pending']

function elapsed(start: string, end: string | null): string {
  const ms = end ? new Date(end).getTime() - new Date(start).getTime()
    : Date.now() - new Date(start).getTime()
  if (ms < 1000)  return `${ms}ms`
  if (ms < 60000) return `${(ms/1000).toFixed(1)}s`
  return `${Math.floor(ms/60000)}m ${Math.round((ms%60000)/1000)}s`
}

export default function RunsPage() {
  const router = useRouter()
  const [runs,    setRuns]    = useState<Run[]>([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState<StepStatus | ''>('')

  const load = (status: StepStatus | '') => {
    setLoading(true)
    const q = status ? `?status=${status}` : ''
    fetch(`/api/runs${q}`)
      .then(r => r.json())
      .then((d: { data: Run[] }) => { setRuns(d.data ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load(filter) }, [filter])

  return (
    <div className="p-6 flex flex-col gap-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-title" style={{ color: 'var(--ct-text-1)' }}>Runs</h1>
        <div className="flex gap-1.5">
          {STATUS_FILTERS.map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className="text-label px-2.5 py-1 rounded-md border transition-colors"
              style={{
                borderColor: filter === s ? 'var(--ct-accent-500)' : 'var(--ct-border)',
                color:       filter === s ? 'var(--ct-accent-400)' : 'var(--ct-text-2)',
                background:  'var(--ct-surface)',
              }}>
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {!loading && runs.length === 0 && (
        <div className="rounded-md border p-8 text-center" style={{ borderColor: 'var(--ct-border)', borderStyle: 'dashed' }}>
          <p className="text-body" style={{ color: 'var(--ct-text-2)' }}>No runs yet.</p>
          <p className="text-caption mt-1" style={{ color: 'var(--ct-text-3)' }}>
            Open a pipeline and click ▶ Run to trigger your first test run.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {runs.map(run => (
          <div key={run.id}
            onClick={() => router.push(`/runs/${run.id}`)}
            className="rounded-md border p-4 flex items-center gap-4 cursor-pointer hover:bg-[var(--ct-surface-raised)] transition-colors"
            style={{ borderColor: 'var(--ct-border)', background: 'var(--ct-surface)',
              borderLeftWidth: 3,
              borderLeftColor: run.status === 'passed' ? 'var(--ct-pass)'
                : run.status === 'failed'  ? 'var(--ct-fail)'
                : run.status === 'running' ? 'var(--ct-running)'
                : 'var(--ct-border)',
            }}>
            <StepStatusBadge status={run.status} showLabel={false} />

            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-body font-medium truncate" style={{ color: 'var(--ct-text-1)' }}>
                  {run.pipeline_name}
                </span>
                <span className="text-caption flex-shrink-0" style={{ color: 'var(--ct-text-3)' }}>
                  {run.project_name}
                </span>
              </div>
              <RunSummaryBar
                passed={run.passed_steps} failed={run.failed_steps}
                skipped={run.skipped_steps} running={0}
                total={run.total_steps}
              />
            </div>

            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <span className="text-caption tabular-nums" style={{ color: 'var(--ct-text-2)' }}>
                {elapsed(run.started_at, run.completed_at)}
              </span>
              <span className="text-caption" style={{ color: 'var(--ct-text-3)' }}>
                {run.trigger} · {new Date(run.started_at).toLocaleString()}
              </span>
            </div>

            <span className="text-caption flex-shrink-0" style={{ color: 'var(--ct-text-3)' }}>→</span>
          </div>
        ))}
      </div>

      {loading && <p className="text-body" style={{ color: 'var(--ct-text-2)' }}>Loading…</p>}
    </div>
  )
}
