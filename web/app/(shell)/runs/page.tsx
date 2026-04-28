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
  batch_id: string | null; row_index: number | null; row_data: Record<string, unknown> | null
}

const STATUS_FILTERS: (StepStatus | '')[] = ['', 'failed', 'passed', 'running', 'pending']

function elapsed(start: string, end: string | null): string {
  const ms = end ? new Date(end).getTime() - new Date(start).getTime()
    : Date.now() - new Date(start).getTime()
  if (ms < 1000)  return `${ms}ms`
  if (ms < 60000) return `${(ms/1000).toFixed(1)}s`
  return `${Math.floor(ms/60000)}m ${Math.round((ms%60000)/1000)}s`
}

type BatchGroup = { batchId: string; pipeline_name: string; project_name: string; runs: Run[] }

function BatchGroupRow({ group, router, elapsed }: {
  group: BatchGroup
  router: ReturnType<typeof useRouter>
  elapsed: (start: string, end: string | null) => string
}) {
  const [collapsed, setCollapsed] = useState(true)
  const passedCount  = group.runs.filter(r => r.status === 'passed').length
  const failedCount  = group.runs.filter(r => r.status === 'failed').length
  const runningCount = group.runs.filter(r => r.status === 'running' || r.status === 'pending').length
  const batchStatus: StepStatus = failedCount > 0 ? 'failed' : runningCount > 0 ? 'running' : 'passed'

  return (
    <div className="rounded-md border overflow-hidden"
      style={{ borderColor: 'var(--ct-border)', borderLeftWidth: 3,
        borderLeftColor: batchStatus === 'passed' ? 'var(--ct-pass)' : batchStatus === 'failed' ? 'var(--ct-fail)' : 'var(--ct-running)' }}>
      <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-[var(--ct-surface-raised)]"
        style={{ background: 'var(--ct-surface)' }}
        onClick={() => setCollapsed(c => !c)}>
        <StepStatusBadge status={batchStatus} showLabel={false} />
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="text-body font-medium" style={{ color: 'var(--ct-text-1)' }}>{group.pipeline_name}</span>
            <span className="text-caption px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--ct-accent-400)', fontSize: 10 }}>
              ⊞ Dataset · {group.runs.length} rows
            </span>
            <span className="text-caption" style={{ color: 'var(--ct-text-3)' }}>{group.project_name}</span>
          </div>
          <span className="text-caption" style={{ color: 'var(--ct-text-3)' }}>
            {passedCount}/{group.runs.length} passed
            {failedCount > 0 && <span style={{ color: 'var(--ct-fail)' }}> · {failedCount} failed</span>}
            {runningCount > 0 && <span style={{ color: 'var(--ct-running)' }}> · {runningCount} running</span>}
          </span>
        </div>
        <span className="text-caption flex-shrink-0" style={{ color: 'var(--ct-text-3)' }}>
          {collapsed ? '▼' : '▲'}
        </span>
      </div>

      {!collapsed && group.runs.map(run => {
        const rowLabel = run.row_data ? Object.values(run.row_data).slice(0,2).map(v => String(v).slice(0,20)).join(', ') : `Row ${(run.row_index ?? 0) + 1}`
        return (
          <div key={run.id}
            onClick={() => router.push(`/runs/${run.id}`)}
            className="flex items-center gap-3 px-4 cursor-pointer hover:bg-[var(--ct-surface-raised)] transition-colors border-t"
            style={{ height: 36, borderColor: 'var(--ct-border)', background: 'var(--ct-surface-raised)' }}>
            <StepStatusBadge status={run.status} showLabel={false} />
            <span className="text-caption w-6 tabular-nums flex-shrink-0" style={{ color: 'var(--ct-text-3)' }}>
              #{(run.row_index ?? 0) + 1}
            </span>
            <span className="text-body flex-1 truncate" style={{ color: 'var(--ct-text-2)' }}>{rowLabel}</span>
            <span className="text-caption flex-shrink-0" style={{ color: 'var(--ct-text-3)' }}>
              {elapsed(run.started_at, run.completed_at)}
            </span>
            <span className="text-caption flex-shrink-0" style={{ color: 'var(--ct-text-3)' }}>→</span>
          </div>
        )
      })}
    </div>
  )
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

  // Group runs: batch runs collapse under a batch header, single runs stand alone
  const { singles, batches } = (() => {
    const batchMap = new Map<string, BatchGroup>()
    const singles: Run[] = []
    for (const r of runs) {
      if (r.batch_id) {
        const existing = batchMap.get(r.batch_id)
        if (existing) { existing.runs.push(r) }
        else batchMap.set(r.batch_id, { batchId: r.batch_id, pipeline_name: r.pipeline_name, project_name: r.project_name, runs: [r] })
      } else { singles.push(r) }
    }
    return { singles, batches: [...batchMap.values()] }
  })()

  // Merge singles + batch groups, sorted by most recent started_at
  const items: ({ type: 'single'; run: Run } | { type: 'batch'; group: BatchGroup })[] = [
    ...singles.map(r => ({ type: 'single' as const, run: r, ts: r.started_at })),
    ...batches.map(g => ({ type: 'batch' as const, group: g, ts: g.runs[0]?.started_at ?? '' })),
  ].sort((a, b) => b.ts.localeCompare(a.ts))

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
        {items.map((item, idx) => {
          if (item.type === 'single') {
            const run = item.run
            return (
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
                  <RunSummaryBar passed={run.passed_steps} failed={run.failed_steps} skipped={run.skipped_steps} running={0} total={run.total_steps} />
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-caption tabular-nums" style={{ color: 'var(--ct-text-2)' }}>{elapsed(run.started_at, run.completed_at)}</span>
                  <span className="text-caption" style={{ color: 'var(--ct-text-3)' }}>{run.trigger} · {new Date(run.started_at).toLocaleString()}</span>
                </div>
                <span className="text-caption flex-shrink-0" style={{ color: 'var(--ct-text-3)' }}>→</span>
              </div>
            )
          }

          // Batch group
          return <BatchGroupRow key={item.group.batchId} group={item.group} router={router} elapsed={elapsed} />
        })}
      </div>

      {loading && <p className="text-body" style={{ color: 'var(--ct-text-2)' }}>Loading…</p>}
    </div>
  )
}
