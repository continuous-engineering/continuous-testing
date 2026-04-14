'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useProjectPicker } from '@/lib/hooks/useProjectPicker'

type Dataset = {
  id: string; name: string; description: string | null
  row_count: number; schema_json: { columns?: { key: string; label: string; type: string }[] }
  created_at: string; updated_at: string
}

export default function DatasetsPage() {
  const router = useRouter()
  const { projectId, setProjectId, projects, loading: projectsLoading } = useProjectPicker()
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [loading,  setLoading]  = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form,     setForm]     = useState({ name: '', description: '' })
  const [creating, setCreating] = useState(false)

  const load = () => {
    if (!projectId) return
    setLoading(true)
    fetch(`/api/projects/${projectId}/datasets`).then(r => r.json())
      .then((d: { data: Dataset[] }) => { setDatasets(d.data ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }
  useEffect(load, [projectId])

  async function create() {
    if (!form.name.trim() || !projectId) return
    setCreating(true)
    const res = await fetch(`/api/projects/${projectId}/datasets`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name.trim(), description: form.description || undefined, schema_json: { columns: [] } }),
    })
    const d = await res.json() as { data: Dataset }
    setCreating(false); setShowForm(false); setForm({ name: '', description: '' })
    router.push(`/datasets/${d.data.id}`)
  }

  return (
    <div className="p-6 flex flex-col gap-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-title" style={{ color: 'var(--ct-text-1)' }}>Datasets</h1>
          <p className="text-body mt-1" style={{ color: 'var(--ct-text-2)' }}>
            Parameterised test data. Each dataset is a typed table — columns with types, rows of data.
            Attach a dataset to a pipeline run to repeat steps across every row.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!projectsLoading && projects.length > 1 && (
            <select value={projectId} onChange={e => setProjectId(e.target.value)}
              className="text-body px-3 py-1.5 rounded-md border"
              style={{ background: 'var(--ct-surface-raised)', borderColor: 'var(--ct-border)', color: 'var(--ct-text-1)' }}>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <button onClick={() => setShowForm(true)} disabled={!projectId}
            className="text-label px-3 py-1.5 rounded-md disabled:opacity-50"
            style={{ background: 'var(--ct-accent-500)', color: '#fff' }}>
            + New dataset
          </button>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="rounded-md border p-5 flex flex-col gap-4"
          style={{ borderColor: 'var(--ct-border)', background: 'var(--ct-surface)' }}>
          <h2 className="text-heading" style={{ color: 'var(--ct-text-1)' }}>New dataset</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-label" style={{ color: 'var(--ct-text-2)' }}>Name</label>
              <input autoFocus value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && create()}
                placeholder="e.g. Test users, Product catalogue, Search terms"
                className="text-body px-3 py-2 rounded-md border"
                style={{ background: 'var(--ct-surface-raised)', borderColor: 'var(--ct-border)', color: 'var(--ct-text-1)', outline: 'none' }} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-label" style={{ color: 'var(--ct-text-2)' }}>Description</label>
              <input value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="What is this data used for?"
                className="text-body px-3 py-2 rounded-md border"
                style={{ background: 'var(--ct-surface-raised)', borderColor: 'var(--ct-border)', color: 'var(--ct-text-1)', outline: 'none' }} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={create} disabled={creating || !form.name.trim()}
              className="text-label px-3 py-2 rounded-md disabled:opacity-50"
              style={{ background: 'var(--ct-accent-500)', color: '#fff' }}>
              {creating ? 'Creating…' : 'Create & open editor'}
            </button>
            <button onClick={() => { setShowForm(false); setForm({ name: '', description: '' }) }}
              className="text-label px-3 py-2 rounded-md border"
              style={{ borderColor: 'var(--ct-border)', color: 'var(--ct-text-2)' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {!projectId && !projectsLoading && (
        <div className="rounded-md border p-8 text-center" style={{ borderColor: 'var(--ct-border)', borderStyle: 'dashed' }}>
          <p className="text-body" style={{ color: 'var(--ct-text-2)' }}>No projects found. Create a project first.</p>
        </div>
      )}

      {projectId && !loading && datasets.length === 0 && !showForm && (
        <div className="rounded-md border p-10 text-center flex flex-col gap-3"
          style={{ borderColor: 'var(--ct-border)', borderStyle: 'dashed' }}>
          <p className="text-body" style={{ color: 'var(--ct-text-2)' }}>No datasets yet.</p>
          <p className="text-caption" style={{ color: 'var(--ct-text-3)' }}>
            Datasets let you run the same pipeline against many rows of data — test users, products, edge cases.
          </p>
          <button onClick={() => setShowForm(true)}
            className="text-label px-4 py-2 rounded-md self-center"
            style={{ background: 'var(--ct-accent-500)', color: '#fff' }}>
            + Create your first dataset
          </button>
        </div>
      )}

      {/* Dataset cards */}
      <div className="flex flex-col gap-3">
        {datasets.map(ds => {
          const cols = ds.schema_json?.columns ?? []
          return (
            <div key={ds.id}
              onClick={() => router.push(`/datasets/${ds.id}`)}
              className="rounded-md border p-4 flex items-center gap-4 cursor-pointer hover:bg-[var(--ct-surface-raised)] transition-colors"
              style={{ borderColor: 'var(--ct-border)', background: 'var(--ct-surface)' }}>
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <span className="text-body font-medium" style={{ color: 'var(--ct-text-1)' }}>{ds.name}</span>
                {ds.description && (
                  <span className="text-caption" style={{ color: 'var(--ct-text-2)' }}>{ds.description}</span>
                )}
                {cols.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap mt-0.5">
                    {cols.map(c => (
                      <span key={c.key} className="text-caption px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--ct-surface-overlay)', color: 'var(--ct-text-3)', fontSize: 11 }}>
                        {c.label} <span style={{ color: 'var(--ct-text-3)', opacity: 0.6 }}>{c.type}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className="text-title font-semibold tabular-nums" style={{ color: 'var(--ct-text-1)' }}>
                  {ds.row_count}
                </span>
                <span className="text-caption" style={{ color: 'var(--ct-text-3)' }}>
                  {ds.row_count === 1 ? 'row' : 'rows'}
                </span>
              </div>
              <span className="text-caption" style={{ color: 'var(--ct-text-3)' }}>→</span>
            </div>
          )
        })}
      </div>

      {loading && <p className="text-body" style={{ color: 'var(--ct-text-2)' }}>Loading…</p>}
    </div>
  )
}
