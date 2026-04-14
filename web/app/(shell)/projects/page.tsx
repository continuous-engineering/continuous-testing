'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DenseTable, type Column } from '@/components/data/DenseTable'

type Project = {
  id: string
  name: string
  slug: string
  description: string | null
  created_at: string
}

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'project'
}

export default function ProjectsPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState({ name: '', description: '' })
  const [creating, setCreating] = useState(false)
  const [error, setError]       = useState('')

  const load = () => {
    fetch('/api/projects').then(r => r.json())
      .then((d: { data: Project[] }) => { setProjects(d.data ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }
  useEffect(load, [])

  async function create() {
    if (!form.name.trim()) return
    setCreating(true); setError('')
    const slug = slugify(form.name) + '-' + Math.random().toString(36).slice(2,6)
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name.trim(), slug, description: form.description || undefined }),
    })
    const d = await res.json() as { data: Project; error?: string }
    setCreating(false)
    if (!res.ok) { setError(d.error ?? 'Failed to create project'); return }
    setShowForm(false); setForm({ name: '', description: '' })
    load()
  }

  const cols: Column<Project>[] = [
    {
      key: 'name', header: 'Project', width: 'flex-1',
      render: p => (
        <div>
          <div className="text-body font-medium" style={{ color: 'var(--ct-text-1)' }}>{p.name}</div>
          {p.description && <div className="text-caption mt-0.5" style={{ color: 'var(--ct-text-3)' }}>{p.description}</div>}
        </div>
      ),
    },
    {
      key: 'slug', header: 'Slug', width: 'w-48',
      render: p => <code className="text-caption" style={{ color: 'var(--ct-text-3)' }}>{p.slug}</code>,
    },
    {
      key: 'created', header: 'Created', width: 'w-32',
      render: p => <span className="text-caption" style={{ color: 'var(--ct-text-3)' }}>{new Date(p.created_at).toLocaleDateString()}</span>,
    },
  ]

  return (
    <div className="p-6 flex flex-col gap-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-title" style={{ color: 'var(--ct-text-1)' }}>Projects</h1>
          <p className="text-body mt-1" style={{ color: 'var(--ct-text-2)' }}>
            Each project groups pipelines and holds its own API specs, secrets, and environments.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="text-label px-3 py-1.5 rounded-md"
          style={{ background: 'var(--ct-accent-500)', color: '#fff' }}
        >
          + New project
        </button>
      </div>

      {showForm && (
        <div className="rounded-md border p-4 flex flex-col gap-3" style={{ borderColor: 'var(--ct-border)', background: 'var(--ct-surface)' }}>
          <h2 className="text-heading" style={{ color: 'var(--ct-text-1)' }}>New project</h2>
          <div className="flex flex-col gap-1">
            <label className="text-label" style={{ color: 'var(--ct-text-2)' }}>Name</label>
            <input
              autoFocus
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && create()}
              placeholder="e.g. Checkout API, Mobile App, Internal Tools"
              className="text-body px-3 py-2 rounded-md border"
              style={{ background: 'var(--ct-surface-raised)', borderColor: 'var(--ct-border)', color: 'var(--ct-text-1)' }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-label" style={{ color: 'var(--ct-text-2)' }}>Description <span style={{ color: 'var(--ct-text-3)' }}>(optional)</span></label>
            <input
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="What does this project test?"
              className="text-body px-3 py-2 rounded-md border"
              style={{ background: 'var(--ct-surface-raised)', borderColor: 'var(--ct-border)', color: 'var(--ct-text-1)' }}
            />
          </div>
          {error && <p className="text-caption" style={{ color: 'var(--ct-fail)' }}>{error}</p>}
          <div className="flex gap-2">
            <button onClick={create} disabled={creating || !form.name.trim()}
              className="text-label px-3 py-2 rounded-md disabled:opacity-50"
              style={{ background: 'var(--ct-accent-500)', color: '#fff' }}>
              {creating ? 'Creating…' : 'Create project'}
            </button>
            <button onClick={() => { setShowForm(false); setForm({ name: '', description: '' }); setError('') }}
              className="text-label px-3 py-2 rounded-md border"
              style={{ borderColor: 'var(--ct-border)', color: 'var(--ct-text-2)' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {!loading && projects.length === 0 && !showForm ? (
        <div className="rounded-md border p-8 text-center flex flex-col gap-3" style={{ borderColor: 'var(--ct-border)', borderStyle: 'dashed' }}>
          <p className="text-body" style={{ color: 'var(--ct-text-2)' }}>No projects yet.</p>
          <p className="text-caption" style={{ color: 'var(--ct-text-3)' }}>
            Create a project to group your test pipelines, import API specs, and manage secrets.
          </p>
          <button onClick={() => setShowForm(true)}
            className="text-label px-4 py-2 rounded-md self-center"
            style={{ background: 'var(--ct-accent-500)', color: '#fff' }}>
            + Create your first project
          </button>
        </div>
      ) : (
        <div className="rounded-md border overflow-hidden" style={{ borderColor: 'var(--ct-border)' }}>
          <DenseTable
            columns={cols} rows={projects} getKey={p => p.id}
            onRowClick={p => router.push(`/projects/${p.id}`)}
            emptyMessage={loading ? 'Loading…' : 'No projects'}
          />
        </div>
      )}
    </div>
  )
}
