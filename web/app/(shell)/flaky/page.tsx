'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { DenseTable, type Column } from '@/components/data/DenseTable'

type FlakyStep = {
  step_id: string
  step_name: string
  step_type: string
  pipeline_id: string
  pipeline_name: string
  project_id: string
  total_runs: number
  failures: number
  fail_pct: string
}

export default function FlakyPage() {
  const [steps, setSteps] = useState<FlakyStep[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/flaky')
      .then((r) => r.json())
      .then((d) => { setSteps((d as { data: FlakyStep[] }).data ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const columns: Column<FlakyStep>[] = [
    {
      key: 'step', header: 'Step', width: 'flex-1',
      render: (s) => (
        <div className="flex flex-col">
          <span className="text-body" style={{ color: 'var(--ct-text-1)' }}>{s.step_name}</span>
          <span className="text-caption" style={{ color: 'var(--ct-text-3)' }}>{s.step_type.toUpperCase()}</span>
        </div>
      ),
    },
    {
      key: 'pipeline', header: 'Pipeline', width: 'w-48',
      render: (s) => <span className="text-body" style={{ color: 'var(--ct-text-2)' }}>{s.pipeline_name}</span>,
    },
    {
      key: 'runs', header: 'Runs', width: 'w-16',
      render: (s) => <span className="text-body tabular-nums" style={{ color: 'var(--ct-text-2)' }}>{s.total_runs}</span>,
    },
    {
      key: 'failures', header: 'Failures', width: 'w-20',
      render: (s) => <span className="text-body tabular-nums" style={{ color: 'var(--ct-fail)' }}>{s.failures}</span>,
    },
    {
      key: 'rate', header: 'Fail rate', width: 'w-24',
      render: (s) => {
        const pct = parseFloat(s.fail_pct)
        const color = pct > 60 ? 'var(--ct-fail)' : 'var(--ct-flaky)'
        return (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--ct-border)', maxWidth: '60px' }}>
              <div style={{ width: `${pct}%`, background: color, height: '100%' }} />
            </div>
            <span className="text-label font-mono tabular-nums" style={{ color }}>{s.fail_pct}%</span>
          </div>
        )
      },
    },
  ]

  return (
    <div className="p-6 flex flex-col gap-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-title" style={{ color: 'var(--ct-text-1)' }}>Flaky Tests</h1>
          <p className="text-body mt-1" style={{ color: 'var(--ct-text-2)' }}>
            Steps with 5–95% failure rate over the last 30 days (min 5 runs)
          </p>
        </div>
        {!loading && (
          <span
            className="text-heading font-semibold"
            style={{ color: steps.length > 0 ? 'var(--ct-flaky)' : 'var(--ct-pass)' }}
          >
            {steps.length} flaky
          </span>
        )}
      </div>

      <div className="rounded-md border overflow-hidden" style={{ borderColor: 'var(--ct-border)' }}>
        <DenseTable
          columns={columns}
          rows={steps}
          getKey={(s) => s.step_id}
          emptyMessage={loading ? 'Loading…' : 'No flaky steps detected — all steps are either stable or consistently failing.'}
        />
      </div>
    </div>
  )
}
