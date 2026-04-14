'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Project = {
  id: string
  name: string
  slug: string
  description: string | null
  owner: string | null
  labels: string[]
  homepage_url: string | null
  report_recipients: string[]
  metadata: Record<string, string>
  created_at: string
  updated_at: string
}

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'project'
}

export default function ProjectsPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form,     setForm]     = useState({ name: '', description: '', owner: '' })
  const [creating, setCreating] = useState(false)
  const [error,    setError]    = useState('')

  const load = () => {
    fetch('/api/projects').then(r => r.json())
      .then((d: { data: Project[] }) => { setProjects(d.data ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }
  useEffect(load, [])

  async function create() {
    if (!form.name.trim()) return
    setCreating(true); setError('')
    const slug = slugify(form.name) + '-' + Math.random().toString(36).slice(2, 6)
    const res  = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name.trim(), slug, description: form.description || undefined }),
    })
    const d = await res.json() as { data: Project; error?: string }
    if (!res.ok) { setCreating(false); setError(d.error ?? 'Failed'); return }

    // Patch owner immediately if provided
    if (form.owner.trim()) {
      await fetch(`/api/projects/${d.data.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner: form.owner.trim() }),
      })
    }
    setCreating(false); setShowForm(false); setForm({ name: '', description: '', owner: '' })
    load()
  }

  return (
    <div className="p-6 flex flex-col gap-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-title" style={{ color: 'var(--ct-text-1)' }}>Projects</h1>
          <p className="text-body mt-1" style={{ color: 'var(--ct-text-2)' }}>
            Each project groups pipelines, API specs, secrets, and environments. Reports are sent per project.
          </p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="text-label px-3 py-1.5 rounded-md"
          style={{ background: 'var(--ct-accent-500)', color: '#fff' }}>
          + New project
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="rounded-md border p-5 flex flex-col gap-4"
          style={{ borderColor: 'var(--ct-border)', background: 'var(--ct-surface)' }}>
          <h2 className="text-heading" style={{ color: 'var(--ct-text-1)' }}>New project</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-label" style={{ color: 'var(--ct-text-2)' }}>Name *</label>
              <input autoFocus value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && create()}
                placeholder="e.g. Checkout API"
                className="text-body px-3 py-2 rounded-md border"
                style={{ background: 'var(--ct-surface-raised)', borderColor: 'var(--ct-border)', color: 'var(--ct-text-1)', outline: 'none' }} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-label" style={{ color: 'var(--ct-text-2)' }}>Owner</label>
              <input value={form.owner}
                onChange={e => setForm({ ...form, owner: e.target.value })}
                placeholder="e.g. Platform Team"
                className="text-body px-3 py-2 rounded-md border"
                style={{ background: 'var(--ct-surface-raised)', borderColor: 'var(--ct-border)', color: 'var(--ct-text-1)', outline: 'none' }} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-label" style={{ color: 'var(--ct-text-2)' }}>Description</label>
            <textarea value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={2} placeholder="What does this project test?"
              className="text-body px-3 py-2 rounded-md border resize-none"
              style={{ background: 'var(--ct-surface-raised)', borderColor: 'var(--ct-border)', color: 'var(--ct-text-1)', outline: 'none' }} />
          </div>
          {error && <p className="text-caption" style={{ color: 'var(--ct-fail)' }}>{error}</p>}
          <div className="flex gap-2">
            <button onClick={create} disabled={creating || !form.name.trim()}
              className="text-label px-3 py-2 rounded-md disabled:opacity-50"
              style={{ background: 'var(--ct-accent-500)', color: '#fff' }}>
              {creating ? 'Creating…' : 'Create project'}
            </button>
            <button onClick={() => { setShowForm(false); setForm({ name: '', description: '', owner: '' }); setError('') }}
              className="text-label px-3 py-2 rounded-md border"
              style={{ borderColor: 'var(--ct-border)', color: 'var(--ct-text-2)' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && projects.length === 0 && !showForm && (
        <div className="rounded-md border p-10 text-center flex flex-col gap-3"
          style={{ borderColor: 'var(--ct-border)', borderStyle: 'dashed' }}>
          <p className="text-body" style={{ color: 'var(--ct-text-2)' }}>No projects yet.</p>
          <p className="text-caption" style={{ color: 'var(--ct-text-3)' }}>
            Create a project to group pipelines, import API specs, and manage secrets.
          </p>
          <button onClick={() => setShowForm(true)}
            className="text-label px-4 py-2 rounded-md self-center"
            style={{ background: 'var(--ct-accent-500)', color: '#fff' }}>
            + Create your first project
          </button>
        </div>
      )}

      {/* Project cards */}
      {projects.length > 0 && (
        <div className="flex flex-col gap-3">
          {projects.map(p => (
            <div key={p.id}
              className="rounded-md border overflow-hidden"
              style={{ borderColor: 'var(--ct-border)', background: 'var(--ct-surface)' }}>
              {/* Card header — clickable */}
              <div className="flex items-start justify-between px-4 py-3 cursor-pointer hover:bg-[var(--ct-surface-raised)] transition-colors"
                onClick={() => router.push(`/projects/${p.id}`)}>
                <div className="flex flex-col gap-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-heading font-semibold" style={{ color: 'var(--ct-text-1)' }}>{p.name}</span>
                    {p.labels?.map(l => (
                      <span key={l} className="text-caption px-1.5 py-0.5 rounded-full border flex-shrink-0"
                        style={{ borderColor: 'var(--ct-accent-500)', color: 'var(--ct-accent-400)', background: 'rgba(16,185,129,0.08)', fontSize: 11 }}>
                        {l}
                      </span>
                    ))}
                  </div>
                  {p.description && (
                    <p className="text-body" style={{ color: 'var(--ct-text-2)' }}>{p.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-1">
                    {p.owner && (
                      <span className="text-caption" style={{ color: 'var(--ct-text-3)' }}>
                        👤 {p.owner}
                      </span>
                    )}
                    {p.homepage_url && (
                      <a href={p.homepage_url} target="_blank" rel="noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="text-caption underline" style={{ color: 'var(--ct-text-3)' }}>
                        {p.homepage_url.replace(/^https?:\/\//, '')}
                      </a>
                    )}
                    <span className="text-caption" style={{ color: 'var(--ct-text-3)' }}>
                      Updated {new Date(p.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                  <button
                    onClick={e => { e.stopPropagation(); router.push(`/projects/${p.id}/settings`) }}
                    className="text-caption px-2.5 py-1 rounded-md border transition-colors hover:text-[var(--ct-text-1)]"
                    style={{ borderColor: 'var(--ct-border)', color: 'var(--ct-text-3)' }}>
                    Settings
                  </button>
                  <span className="text-caption px-2 py-1" style={{ color: 'var(--ct-accent-400)' }}>
                    Pipelines →
                  </span>
                </div>
              </div>

              {/* Metadata strip */}
              {p.metadata && Object.keys(p.metadata).length > 0 && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-2 border-t"
                  style={{ borderColor: 'var(--ct-border)', background: 'var(--ct-surface-raised)' }}>
                  {Object.entries(p.metadata).map(([k, v]) => (
                    <span key={k} className="text-caption" style={{ color: 'var(--ct-text-3)' }}>
                      <span style={{ color: 'var(--ct-text-2)' }}>{k}:</span> {String(v)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
