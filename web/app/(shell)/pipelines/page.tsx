'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
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
    // Default project selector to first project
    if (list[0] && !form.projectId) setForm(f => ({ ...f, projectId: list[0]!.id }))
  }

  useEffect(() => { void load() }, [])

  async function create() {
    if (!form.name.trim()) return
    setCreating(true)
    let projectId = form.projectId
    if (!projectId) {
      // No projects exist — create one first
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

  // Group by project
  const byProject = projects.map(p => ({
    project: p,
    pipelines: pipelines.filter(pl => pl.project_id === p.id),
  })).filter(g => g.pipelines.length > 0)

  return (
    <div className="p-6 flex flex-col gap-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-title" style={{ color: 'var(--ct-text-1)' }}>Pipelines</h1>
          <p className="text-body mt-1" style={{ color: 'var(--ct-text-2)' }}>
            All pipelines across your projects.
          </p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="text-label px-3 py-1.5 rounded-md"
          style={{ background: 'var(--ct-accent-500)', color: '#fff' }}>
          + New pipeline
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="rounded-md border p-5 flex flex-col gap-4"
          style={{ borderColor: 'var(--ct-border)', background: 'var(--ct-surface)' }}>
          <h2 className="text-heading" style={{ color: 'var(--ct-text-1)' }}>New pipeline</h2>

          {projects.length === 0 && (
            <div className="rounded-md border p-3" style={{ borderColor: 'var(--ct-flaky)', background: 'rgba(245,158,11,0.06)' }}>
              <p className="text-body" style={{ color: 'var(--ct-flaky)' }}>
                You have no projects yet. Creating a pipeline will also create a default project.
              </p>
              <button onClick={() => { setShowForm(false); router.push('/projects') }}
                className="text-label mt-2 underline" style={{ color: 'var(--ct-flaky)' }}>
                Create a project first →
              </button>
            </div>
          )}

          {projects.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-label" style={{ color: 'var(--ct-text-2)' }}>Project</label>
              <select value={form.projectId} onChange={e => setForm({ ...form, projectId: e.target.value })}
                className="text-body px-3 py-2 rounded-md border"
                style={{ background: 'var(--ct-surface-raised)', borderColor: 'var(--ct-border)', color: 'var(--ct-text-1)' }}>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-label" style={{ color: 'var(--ct-text-2)' }}>Pipeline name</label>
            <input autoFocus value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && create()}
              placeholder="e.g. Checkout flow, User registration, API smoke test"
              className="text-body px-3 py-2 rounded-md border"
              style={{ background: 'var(--ct-surface-raised)', borderColor: 'var(--ct-border)', color: 'var(--ct-text-1)', outline: 'none' }} />
          </div>

          <div className="flex gap-2">
            <button onClick={create} disabled={creating || !form.name.trim()}
              className="text-label px-3 py-2 rounded-md disabled:opacity-50"
              style={{ background: 'var(--ct-accent-500)', color: '#fff' }}>
              {creating ? 'Creating…' : 'Create & open'}
            </button>
            <button onClick={() => { setShowForm(false); setForm(f => ({ ...f, name: '' })) }}
              className="text-label px-3 py-2 rounded-md border"
              style={{ borderColor: 'var(--ct-border)', color: 'var(--ct-text-2)' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && pipelines.length === 0 && !showForm && (
        <div className="rounded-md border p-10 text-center flex flex-col gap-3"
          style={{ borderColor: 'var(--ct-border)', borderStyle: 'dashed' }}>
          <p className="text-body" style={{ color: 'var(--ct-text-2)' }}>No pipelines yet.</p>
          <p className="text-caption" style={{ color: 'var(--ct-text-3)' }}>
            A pipeline is a sequence of API, UI, or AI test steps that run together.
          </p>
          <button onClick={() => setShowForm(true)}
            className="text-label px-4 py-2 rounded-md self-center"
            style={{ background: 'var(--ct-accent-500)', color: '#fff' }}>
            + Create your first pipeline
          </button>
        </div>
      )}

      {/* Pipelines grouped by project */}
      {byProject.map(({ project, pipelines: pls }) => (
        <section key={project.id} className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <button onClick={() => router.push(`/projects/${project.id}`)}
              className="text-heading hover:underline" style={{ color: 'var(--ct-text-1)' }}>
              {project.name}
            </button>
            <button onClick={() => router.push(`/projects/${project.id}`)}
              className="text-caption" style={{ color: 'var(--ct-text-3)' }}>
              View project →
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {pls.map(p => (
              <div key={p.id}
                onClick={() => router.push(`/projects/${p.project_id}/pipelines/${p.id}`)}
                className="rounded-md border p-4 flex items-center gap-4 cursor-pointer hover:bg-[var(--ct-surface-raised)] transition-colors"
                style={{ borderColor: 'var(--ct-border)', background: 'var(--ct-surface)' }}>
                <div className="flex-1 min-w-0">
                  <span className="text-body font-medium" style={{ color: 'var(--ct-text-1)' }}>{p.name}</span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-caption" style={{ color: 'var(--ct-text-3)' }}>
                    {(p as Record<string,unknown>).step_count as number ?? 0} steps
                  </span>
                  <div className="flex gap-1">
                    {(p.runs_on ?? ['hosted']).map(tag => (
                      <span key={tag} className="text-caption px-1.5 py-0.5 rounded border"
                        style={{ borderColor: 'var(--ct-border)', color: 'var(--ct-text-3)', fontSize: 11 }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                  <span className="text-caption" style={{ color: 'var(--ct-text-3)' }}>→</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {loading && <p className="text-body" style={{ color: 'var(--ct-text-2)' }}>Loading…</p>}
    </div>
  )
}
