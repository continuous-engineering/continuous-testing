'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { StepStatusBadge, type StepStatus } from '@/components/domain/StepStatusBadge'
import { RunSummaryBar } from '@/components/domain/RunSummaryBar'
import { DenseTable, type Column } from '@/components/data/DenseTable'
import { cn } from '@/lib/utils'

type Health = { passed: number; failed: number; running: number; pending: number; cancelled: number; total: number; passRate: number }
type RecentRun = { id: string; pipeline_name: string; project_name: string; status: StepStatus; total_steps: number; passed_steps: number; failed_steps: number; skipped_steps: number; trigger: string; created_at: string; pipeline_id: string; project_id: string }
type RunnerStatus = { scope: string; status: string; count: string }
type FlakyStep = { step_id: string; step_name: string; step_type: string; pipeline_name: string; fail_pct: string }

type DashData = {
  health: Health
  recentRuns: RecentRun[]
  runnerStatus: RunnerStatus[]
  flakySteps: FlakyStep[]
  flakyCount: number
}

export default function DashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then((d) => { setData((d as { data: DashData }).data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const recentRunCols: Column<RecentRun>[] = [
    {
      key: 'pipeline', header: 'Pipeline', width: 'flex-1',
      render: (r) => (
        <div className="flex flex-col">
          <span className="text-body" style={{ color: 'var(--ct-text-1)' }}>{r.pipeline_name}</span>
          <span className="text-caption" style={{ color: 'var(--ct-text-3)' }}>{r.project_name}</span>
        </div>
      ),
    },
    {
      key: 'status', header: 'Status', width: 'w-24',
      render: (r) => <StepStatusBadge status={r.status} />,
    },
    {
      key: 'summary', header: 'Steps', width: 'w-48',
      render: (r) => (
        <RunSummaryBar
          passed={r.passed_steps} failed={r.failed_steps}
          skipped={r.skipped_steps} running={0}
          total={r.total_steps}
        />
      ),
    },
    {
      key: 'trigger', header: 'Trigger', width: 'w-20',
      render: (r) => <span className="text-caption" style={{ color: 'var(--ct-text-3)' }}>{r.trigger}</span>,
    },
  ]

  const flakyCols: Column<FlakyStep>[] = [
    {
      key: 'name', header: 'Step', width: 'flex-1',
      render: (s) => <span className="text-body" style={{ color: 'var(--ct-text-1)' }}>{s.step_name}</span>,
    },
    {
      key: 'pipeline', header: 'Pipeline', width: 'w-40',
      render: (s) => <span className="text-body" style={{ color: 'var(--ct-text-2)' }}>{s.pipeline_name}</span>,
    },
    {
      key: 'rate', header: 'Fail rate', width: 'w-20',
      render: (s) => (
        <span className="text-body font-mono tabular-nums" style={{ color: 'var(--ct-flaky)' }}>
          {s.fail_pct}%
        </span>
      ),
    },
  ]

  if (loading) return (
    <div className="p-6 text-body" style={{ color: 'var(--ct-text-2)' }}>Loading dashboard…</div>
  )

  return (
    <div className="p-6 flex flex-col gap-6 max-w-5xl">
      {/* ── Run health summary ── */}
      <div className="grid grid-cols-5 gap-3">
        {data && [
          { label: 'Passed',    value: data.health.passed,    color: 'var(--ct-pass)'    },
          { label: 'Failed',    value: data.health.failed,    color: 'var(--ct-fail)'    },
          { label: 'Running',   value: data.health.running,   color: 'var(--ct-running)' },
          { label: 'Pass rate', value: `${data.health.passRate}%`, color: data.health.passRate >= 90 ? 'var(--ct-pass)' : data.health.passRate >= 70 ? 'var(--ct-flaky)' : 'var(--ct-fail)' },
          { label: 'Flaky',     value: data.flakyCount,       color: data.flakyCount > 0 ? 'var(--ct-flaky)' : 'var(--ct-text-3)' },
        ].map((item) => (
          <div
            key={item.label}
            className="flex flex-col gap-1 rounded-md border p-3"
            style={{ borderColor: 'var(--ct-border)', background: 'var(--ct-surface)' }}
          >
            <span className="text-caption" style={{ color: 'var(--ct-text-3)' }}>{item.label}</span>
            <span className="text-title font-semibold" style={{ color: item.color }}>{item.value}</span>
            <span className="text-caption" style={{ color: 'var(--ct-text-3)' }}>last 24h</span>
          </div>
        ))}
      </div>

      {/* ── Two-column: Recent runs + Flaky ── */}
      <div className="grid grid-cols-2 gap-4">
        {/* Recent runs */}
        <div className="flex flex-col gap-2">
          <h2 className="text-heading" style={{ color: 'var(--ct-text-1)' }}>Recent runs</h2>
          <div className="rounded-md border overflow-hidden" style={{ borderColor: 'var(--ct-border)' }}>
            <DenseTable
              columns={recentRunCols}
              rows={data?.recentRuns ?? []}
              getKey={(r) => r.id}
              onRowClick={(r) => router.push(`/projects/${r.project_id}/pipelines/${r.pipeline_id}`)}
              emptyMessage="No runs yet"
            />
          </div>
        </div>

        {/* Flaky steps */}
        <div className="flex flex-col gap-2">
          <h2 className="text-heading" style={{ color: 'var(--ct-text-1)' }}>Flaky steps</h2>
          <div className="rounded-md border overflow-hidden" style={{ borderColor: 'var(--ct-border)' }}>
            <DenseTable
              columns={flakyCols}
              rows={data?.flakySteps ?? []}
              getKey={(s) => s.step_id}
              emptyMessage="No flaky steps detected"
            />
          </div>
        </div>
      </div>

      {/* ── Runner status ── */}
      {data && data.runnerStatus.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-heading" style={{ color: 'var(--ct-text-1)' }}>Runners</h2>
          <div className="flex flex-wrap gap-2">
            {data.runnerStatus.map((r) => (
              <div
                key={`${r.scope}-${r.status}`}
                className="flex items-center gap-2 rounded-md border px-3 py-1.5"
                style={{ borderColor: 'var(--ct-border)', background: 'var(--ct-surface)' }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: r.status === 'idle' ? 'var(--ct-pass)' : r.status === 'busy' ? 'var(--ct-running)' : 'var(--ct-skipped)' }}
                />
                <span className="text-label" style={{ color: 'var(--ct-text-2)' }}>
                  {r.count} {r.scope} {r.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
