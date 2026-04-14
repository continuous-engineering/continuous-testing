'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { DenseTable, type Column } from '@/components/data/DenseTable'
import { useProjectPicker } from '@/lib/hooks/useProjectPicker'

type Secret = {
  id: string
  name: string
  key_version: number
  use_count: number
  last_used_at: string | null
  created_by: string
  created_at: string
}

export default function SecretsPage() {
  const { projectId, setProjectId, projects, loading: projectsLoading } = useProjectPicker()
  const [secrets, setSecrets] = useState<Secret[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', value: '' })
  const [saving, setSaving] = useState(false)

  const load = () => {
    if (!projectId) return
    setLoading(true)
    fetch(`/api/projects/${projectId}/secrets`)
      .then((r) => r.json())
      .then((d) => { setSecrets((d as { data: Secret[] }).data ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }
  useEffect(load, [projectId])

  async function create() {
    setSaving(true)
    await fetch(`/api/projects/${projectId}/secrets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setForm({ name: '', value: '' })
    setSaving(false)
    load()
  }

  const columns: Column<Secret>[] = [
    {
      key: 'name', header: 'Name', width: 'flex-1',
      render: (s) => <code className="text-mono" style={{ color: 'var(--ct-text-1)' }}>{s.name}</code>,
    },
    {
      key: 'uses', header: 'Uses', width: 'w-16',
      render: (s) => <span className="text-body tabular-nums" style={{ color: 'var(--ct-text-2)' }}>{s.use_count}</span>,
    },
    {
      key: 'last_used', header: 'Last used', width: 'w-32',
      render: (s) => <span className="text-caption" style={{ color: 'var(--ct-text-3)' }}>
        {s.last_used_at ? new Date(s.last_used_at).toLocaleDateString() : 'Never'}
      </span>,
    },
    {
      key: 'del', header: '', width: 'w-16',
      render: (s) => (
        <button
          onClick={() => {
            if (!confirm(`Delete secret "${s.name}"? This cannot be undone.`)) return
            fetch(`/api/projects/${projectId}/secrets/${s.id}`, { method: 'DELETE' }).then(load)
          }}
          className="text-caption" style={{ color: 'var(--ct-fail)' }}>
          Delete
        </button>
      ),
    },
  ]

  return (
    <div className="p-6 flex flex-col gap-4 max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-title" style={{ color: 'var(--ct-text-1)' }}>Secrets</h1>
          <p className="text-body mt-1" style={{ color: 'var(--ct-text-2)' }}>
            Encrypted at rest (AES-256-GCM). Values never returned after creation.
            Reference in steps as <code className="text-mono">{'{{secrets.NAME}}'}</code>.
          </p>
        </div>

        {/* Project picker */}
        {!projectsLoading && projects.length > 1 && (
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="text-body px-3 py-1.5 rounded-md border"
            style={{ background: 'var(--ct-surface-raised)', borderColor: 'var(--ct-border)', color: 'var(--ct-text-1)' }}
          >
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>

      {!projectId && !projectsLoading && (
        <p className="text-body" style={{ color: 'var(--ct-text-3)' }}>
          No projects found. Create a project first.
        </p>
      )}

      {projectId && (
        <>
          {/* Add secret */}
          <div className="rounded-md border p-4 flex gap-3" style={{ borderColor: 'var(--ct-border)', background: 'var(--ct-surface)' }}>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_') })}
              placeholder="API_KEY"
              className="text-mono px-3 py-2 rounded-md border flex-shrink-0 w-40"
              style={{ background: 'var(--ct-surface-raised)', borderColor: 'var(--ct-border)', color: 'var(--ct-text-1)' }} />
            <input value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })}
              placeholder="Secret value" type="password"
              className="text-body px-3 py-2 rounded-md border flex-1"
              style={{ background: 'var(--ct-surface-raised)', borderColor: 'var(--ct-border)', color: 'var(--ct-text-1)' }} />
            <button onClick={create} disabled={saving || !form.name || !form.value}
              className="text-label px-3 py-2 rounded-md disabled:opacity-50 flex-shrink-0"
              style={{ background: 'var(--ct-accent-500)', color: '#fff' }}>
              {saving ? 'Saving…' : 'Add'}
            </button>
          </div>

          <div className="rounded-md border overflow-hidden" style={{ borderColor: 'var(--ct-border)' }}>
            <DenseTable columns={columns} rows={secrets} getKey={(s) => s.id}
              emptyMessage={loading ? 'Loading…' : 'No secrets. Add your first secret above.'} />
          </div>
        </>
      )}
    </div>
  )
}
