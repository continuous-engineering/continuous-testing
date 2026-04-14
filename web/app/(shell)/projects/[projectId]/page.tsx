'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { DenseTable, type Column } from '@/components/data/DenseTable'
import { StepStatusBadge, type StepStatus } from '@/components/domain/StepStatusBadge'

type ProjectMeta = { name: string; description: string | null; owner: string | null; labels: string[] }

type Pipeline = {
  id: string
  name: string
  description?: string
  runs_on: string[]
  step_count: number
  tags: string[]
}

export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const router = useRouter()
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [meta, setMeta]           = useState<ProjectMeta | null>(null)
  const [loading, setLoading]     = useState(true)
  const [creating, setCreating]   = useState(false)
  const [newName, setNewName]     = useState('')
  const [showForm, setShowForm]   = useState(false)

  const load = () => {
    fetch(`/api/projects/${projectId}/pipelines`)
      .then((r) => r.json())
      .then((d) => { setPipelines((d as { data: Pipeline[] }).data ?? []); setLoading(false) })
      .catch(() => setLoading(false))
    fetch(`/api/projects/${projectId}`)
      .then(r => r.json())
      .then((d: { data: ProjectMeta }) => setMeta(d.data))
      .catch(() => {})
  }

  useEffect(load, [projectId])

  async function createPipeline() {
    if (!newName.trim()) return
    setCreating(true)
    const res = await fetch(`/api/projects/${projectId}/pipelines`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), runs_on: ['hosted'] }),
    })
    const d = await res.json() as { data: { id: string } }
    setCreating(false)
    setShowForm(false)
    setNewName('')
    router.push(`/projects/${projectId}/pipelines/${d.data.id}`)
  }

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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-title" style={{ color: 'var(--ct-text-1)' }}>{meta?.name ?? 'Pipelines'}</h1>
          {meta?.description && (
            <p className="text-body mt-1 max-w-lg" style={{ color: 'var(--ct-text-2)' }}>{meta.description}</p>
          )}
          <div className="flex items-center gap-3 mt-1">
            {meta?.owner && (
              <span className="text-caption" style={{ color: 'var(--ct-text-3)' }}>👤 {meta.owner}</span>
            )}
            {meta?.labels?.map(l => (
              <span key={l} className="text-caption px-1.5 py-0.5 rounded-full border"
                style={{ borderColor: 'var(--ct-accent-500)', color: 'var(--ct-accent-400)', background: 'rgba(16,185,129,0.08)', fontSize: 11 }}>
                {l}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(`/projects/${projectId}/settings`)}
            className="text-label px-3 py-1.5 rounded-md border"
            style={{ borderColor: 'var(--ct-border)', color: 'var(--ct-text-2)' }}
          >
            Settings
          </button>
          <button
            className="text-label px-3 py-1.5 rounded-md font-medium"
            style={{ background: 'var(--ct-accent-500)', color: '#fff' }}
            onClick={() => setShowForm(true)}
          >
            + New pipeline
          </button>
        </div>
      </div>

      {/* Inline create form */}
      {showForm && (
        <div
          className="rounded-md border p-4 flex gap-3 items-end"
          style={{ borderColor: 'var(--ct-border)', background: 'var(--ct-surface)' }}
        >
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-label" style={{ color: 'var(--ct-text-2)' }}>Pipeline name</label>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') createPipeline() }}
              placeholder="e.g. Checkout flow"
              className="text-body px-3 py-2 rounded-md border"
              style={{ background: 'var(--ct-surface-raised)', borderColor: 'var(--ct-border)', color: 'var(--ct-text-1)' }}
            />
          </div>
          <button
            onClick={createPipeline}
            disabled={creating || !newName.trim()}
            className="text-label px-3 py-2 rounded-md disabled:opacity-50"
            style={{ background: 'var(--ct-accent-500)', color: '#fff' }}
          >
            {creating ? 'Creating…' : 'Create'}
          </button>
          <button
            onClick={() => { setShowForm(false); setNewName('') }}
            className="text-label px-3 py-2 rounded-md border"
            style={{ borderColor: 'var(--ct-border)', color: 'var(--ct-text-2)' }}
          >
            Cancel
          </button>
        </div>
      )}

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
