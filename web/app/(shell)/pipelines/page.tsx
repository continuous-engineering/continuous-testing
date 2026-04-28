'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'

type Project  = { id: string; name: string; slug: string }
type Pipeline = { id: string; name: string; runs_on: string[]; step_count: number; project_id: string; project_name: string }

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) + '-' + Math.random().toString(36).slice(2, 6)
}

export default function PipelinesPage() {
  const router = useRouter()
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [projects,  setProjects]  = useState<Project[]>([])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [creating,  setCreating]  = useState(false)
  const [filter,    setFilter]    = useState('')
  const [form, setForm] = useState({ name: '', projectId: '' })

  async function load() {
    setLoading(true)
    const pr = await fetch('/api/projects').then(r => r.json()) as { data: Project[] }
    const list = pr.data ?? []
    setProjects(list)

    const all: Pipeline[] = []
    await Promise.all(list.map(async proj => {
      const pp = await fetch(`/api/projects/${proj.id}/pipelines`).then(r => r.json()) as { data: Pipeline[] }
      for (const p of pp.data ?? []) all.push({ ...p, project_id: proj.id, project_name: proj.name })
    }))
    setPipelines(all)
    setLoading(false)
    if (list[0] && !form.projectId) setForm(f => ({ ...f, projectId: list[0]!.id }))
  }

  useEffect(() => { void load() }, [])

  async function create() {
    if (!form.name.trim()) return
    setCreating(true)
    let projectId = form.projectId
    if (!projectId) {
      const np = await fetch('/api/projects', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'My Project', slug: slugify('my-project') }),
      }).then(r => r.json()) as { data: Project }
      projectId = np.data.id
    }
    const pp = await fetch(`/api/projects/${projectId}/pipelines`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name.trim(), runs_on: ['hosted'] }),
    }).then(r => r.json()) as { data: { id: string } }
    router.push(`/projects/${projectId}/pipelines/${pp.data.id}`)
  }

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return pipelines
    return pipelines.filter(p =>
      p.name.toLowerCase().includes(q) || p.project_name.toLowerCase().includes(q)
    )
  }, [pipelines, filter])

  return (
    <div className="flex flex-col h-full">
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 px-4 border-b flex-shrink-0"
        style={{ height: 'var(--ct-row-h)', borderColor: 'var(--ct-border)', background: 'var(--ct-surface)' }}>
        <h1 className="text-label font-semibold flex-shrink-0" style={{ color: 'var(--ct-text-1)' }}>
          Pipelines
        </h1>
        <span className="text-caption flex-shrink-0" style={{ color: 'var(--ct-text-3)' }}>
          {loading ? '…' : `${pipelines.length}`}
        </span>
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filter…"
          className="text-body flex-1 min-w-0 px-2 py-0.5 rounded border"
          style={{
            background: 'var(--ct-surface-raised)',
            borderColor: 'var(--ct-border)',
            color: 'var(--ct-text-1)',
            outline: 'none',
            maxWidth: 260,
          }}
        />
        <div className="flex-1" />
        <button onClick={() => setShowForm(v => !v)}
          className="text-label px-3 rounded flex-shrink-0"
          style={{
            height: 26,
            background: showForm ? 'var(--ct-surface-raised)' : 'var(--ct-accent-500)',
            color: showForm ? 'var(--ct-text-2)' : '#fff',
            border: showForm ? '1px solid var(--ct-border)' : 'none',
          }}>
          {showForm ? 'Cancel' : '+ New pipeline'}
        </button>
      </div>

      {/* ── Create form (inline, compact) ── */}
      {showForm && (
        <div className="flex items-center gap-3 px-4 border-b flex-shrink-0"
          style={{ height: 44, borderColor: 'var(--ct-border)', background: 'var(--ct-surface-raised)' }}>
          {projects.length > 0 && (
            <select value={form.projectId} onChange={e => setForm({ ...form, projectId: e.target.value })}
              className="text-body px-2 py-0.5 rounded border flex-shrink-0"
              style={{ background: 'var(--ct-surface)', borderColor: 'var(--ct-border)', color: 'var(--ct-text-1)', maxWidth: 160 }}>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <input autoFocus value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            onKeyDown={e => e.key === 'Enter' && create()}
            placeholder="Pipeline name"
            className="text-body flex-1 min-w-0 px-2 py-0.5 rounded border"
            style={{ background: 'var(--ct-surface)', borderColor: 'var(--ct-border)', color: 'var(--ct-text-1)', outline: 'none', maxWidth: 320 }}
          />
          <button onClick={create} disabled={creating || !form.name.trim()}
            className="text-label px-3 rounded flex-shrink-0 disabled:opacity-40"
            style={{ height: 26, background: 'var(--ct-accent-500)', color: '#fff' }}>
            {creating ? 'Creating…' : 'Create'}
          </button>
          {projects.length === 0 && (
            <span className="text-caption" style={{ color: 'var(--ct-flaky)' }}>
              No projects —{' '}
              <button onClick={() => router.push('/projects')} className="underline">create one first</button>
            </span>
          )}
        </div>
      )}

      {/* ── Table header ── */}
      {!loading && pipelines.length > 0 && (
        <div className="flex items-center border-b flex-shrink-0 sticky top-0 z-10"
          style={{ height: 'var(--ct-row-h)', borderColor: 'var(--ct-border)', background: 'var(--ct-surface)', paddingInline: 'var(--ct-row-px)' }}>
          <span className="text-label uppercase tracking-wide flex-1 min-w-0 truncate" style={{ color: 'var(--ct-text-3)' }}>Pipeline</span>
          <span className="text-label uppercase tracking-wide flex-shrink-0 w-36" style={{ color: 'var(--ct-text-3)' }}>Project</span>
          <span className="text-label uppercase tracking-wide flex-shrink-0 w-16 text-right" style={{ color: 'var(--ct-text-3)' }}>Steps</span>
          <span className="text-label uppercase tracking-wide flex-shrink-0 w-24 text-right" style={{ color: 'var(--ct-text-3)' }}>Runner</span>
        </div>
      )}

      {/* ── Rows ── */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="ct-row" style={{ color: 'var(--ct-text-3)' }}>
            <span className="text-body">Loading…</span>
          </div>
        )}

        {!loading && pipelines.length === 0 && !showForm && (
          <div className="flex flex-col items-center justify-center gap-3 p-12" style={{ color: 'var(--ct-text-3)' }}>
            <p className="text-body">No pipelines yet.</p>
            <p className="text-caption" style={{ color: 'var(--ct-text-3)' }}>
              A pipeline is a sequence of API, UI, or AI test steps that run together.
            </p>
            <button onClick={() => setShowForm(true)}
              className="text-label px-4 rounded"
              style={{ height: 28, background: 'var(--ct-accent-500)', color: '#fff' }}>
              + Create your first pipeline
            </button>
          </div>
        )}

        {filtered.map(p => (
          <div key={p.id}
            className="ct-row cursor-pointer"
            style={{ gap: 'var(--ct-row-gap)', paddingInline: 'var(--ct-row-px)' }}
            onClick={() => router.push(`/projects/${p.project_id}/pipelines/${p.id}`)}>
            <span className="text-body flex-1 min-w-0 truncate font-medium" style={{ color: 'var(--ct-text-1)' }}>
              {p.name}
            </span>
            <span className="text-body flex-shrink-0 w-36 truncate" style={{ color: 'var(--ct-text-2)' }}>
              {p.project_name}
            </span>
            <span className="text-body flex-shrink-0 w-16 text-right tabular-nums" style={{ color: 'var(--ct-text-3)' }}>
              {(p as Record<string, unknown>).step_count as number ?? 0}
            </span>
            <div className="flex-shrink-0 w-24 flex justify-end gap-1">
              {(p.runs_on ?? ['hosted']).map(tag => (
                <span key={tag} className="text-caption px-1.5 rounded border"
                  style={{ borderColor: 'var(--ct-border)', color: 'var(--ct-text-3)', fontSize: 11, lineHeight: '18px' }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
        ))}

        {!loading && filter && filtered.length === 0 && (
          <div className="ct-row" style={{ color: 'var(--ct-text-3)' }}>
            <span className="text-body">No pipelines match &ldquo;{filter}&rdquo;</span>
          </div>
        )}
      </div>
    </div>
  )
}
