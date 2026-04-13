'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { DenseTable, type Column } from '@/components/data/DenseTable'
import { StepStatusBadge, type StepStatus } from '@/components/domain/StepStatusBadge'
import { RunSummaryBar } from '@/components/domain/RunSummaryBar'

type Pipeline = {
  id: string
  name: string
  description?: string
  runs_on: string[]
  step_count: number
  tags: string[]
}

type RecentRun = {
  id: string
  pipeline_id: string
  status: StepStatus
  total_steps: number
  passed_steps: number
  failed_steps: number
  skipped_steps: number
  trigger: string
  created_at: string
}

export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const router = useRouter()
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/projects/${projectId}/pipelines`)
      .then((r) => r.json())
      .then((d) => { setPipelines((d as { data: Pipeline[] }).data ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [projectId])

  const columns: Column<Pipeline>[] = [
    {
      key: 'name', header: 'Pipeline', width: 'flex-1',
      render: (p) => (
        <span className="text-body font-medium" style={{ color: 'var(--ct-text-1)' }}>{p.name}</span>
      ),
    },
    {
      key: 'steps', header: 'Steps', width: 'w-16',
      render: (p) => <span className="text-body" style={{ color: 'var(--ct-text-2)' }}>{p.step_count}</span>,
    },
    {
      key: 'runs_on', header: 'Runner', width: 'w-32',
      render: (p) => (
        <span className="text-caption" style={{ color: 'var(--ct-text-3)' }}>{p.runs_on.join(', ')}</span>
      ),
    },
  ]

  return (
    <div className="p-6 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-title" style={{ color: 'var(--ct-text-1)' }}>Pipelines</h1>
        <button
          className="text-label px-3 py-1.5 rounded-md font-medium"
          style={{ background: 'var(--ct-accent-500)', color: '#fff' }}
          onClick={() => {/* create pipeline modal — B06 task 032 extension */}}
        >
          + New pipeline
        </button>
      </div>

      <div className="rounded-md border overflow-hidden" style={{ borderColor: 'var(--ct-border)' }}>
        <DenseTable
          columns={columns}
          rows={pipelines}
          getKey={(p) => p.id}
          onRowClick={(p) => router.push(`/projects/${projectId}/pipelines/${p.id}`)}
          emptyMessage={loading ? 'Loading…' : 'No pipelines yet. Create your first pipeline.'}
        />
      </div>
    </div>
  )
}
