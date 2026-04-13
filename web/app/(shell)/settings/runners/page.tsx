'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { DenseTable, type Column } from '@/components/data/DenseTable'
import { cn } from '@/lib/utils'

type Runner = {
  id: string
  name: string
  scope: 'hosted' | 'self-hosted'
  status: 'idle' | 'busy' | 'offline'
  tags: string[]
  capabilities: string[]
  last_seen_at: string | null
  created_at: string
}

const STATUS_DOT: Record<string, string> = {
  idle:    'bg-[var(--ct-pass)]',
  busy:    'bg-[var(--ct-running)] animate-pulse',
  offline: 'bg-[var(--ct-skipped)]',
}

export default function RunnersPage() {
  const [runners, setRunners] = useState<Runner[]>([])
  const [loading, setLoading] = useState(true)
  const [showRegister, setShowRegister] = useState(false)
  const [newToken, setNewToken] = useState<{ token: string; name: string } | null>(null)
  const [form, setForm] = useState({ name: '', tags: '', capabilities: ['api'] as string[] })

  const load = () => {
    fetch('/api/runners').then((r) => r.json())
      .then((d) => { setRunners((d as { data: Runner[] }).data ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function register() {
    const res = await fetch('/api/runners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        capabilities: form.capabilities,
      }),
    })
    const d = await res.json() as { data: Runner & { token: string } }
    setNewToken({ token: d.data.token, name: d.data.name })
    setShowRegister(false)
    load()
  }

  async function revoke(id: string) {
    await fetch(`/api/runners/${id}`, { method: 'DELETE' })
    load()
  }

  const columns: Column<Runner>[] = [
    {
      key: 'status', header: '', width: 'w-6',
      render: (r) => <span className={cn('w-1.5 h-1.5 rounded-full', STATUS_DOT[r.status])} />,
    },
    {
      key: 'name', header: 'Name', width: 'flex-1',
      render: (r) => (
        <div className="flex flex-col">
          <span className="text-body" style={{ color: 'var(--ct-text-1)' }}>{r.name}</span>
          <span className="text-caption" style={{ color: 'var(--ct-text-3)' }}>{r.scope}</span>
        </div>
      ),
    },
    {
      key: 'tags', header: 'Tags', width: 'w-48',
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.tags.map((t) => (
            <span key={t} className="text-caption px-1.5 py-0.5 rounded border" style={{ borderColor: 'var(--ct-border)', color: 'var(--ct-text-3)' }}>{t}</span>
          ))}
        </div>
      ),
    },
    {
      key: 'last_seen', header: 'Last seen', width: 'w-32',
      render: (r) => (
        <span className="text-caption" style={{ color: 'var(--ct-text-3)' }}>
          {r.last_seen_at ? new Date(r.last_seen_at).toLocaleTimeString() : 'Never'}
        </span>
      ),
    },
    {
      key: 'actions', header: '', width: 'w-20',
      render: (r) => r.scope === 'self-hosted' ? (
        <button onClick={() => revoke(r.id)} className="text-caption" style={{ color: 'var(--ct-fail)' }}>Revoke</button>
      ) : null,
    },
  ]

  return (
    <div className="p-6 flex flex-col gap-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-title" style={{ color: 'var(--ct-text-1)' }}>Runners</h1>
          <p className="text-body mt-1" style={{ color: 'var(--ct-text-2)' }}>
            Hosted runners are managed by continuous.testing. Register your own for internal networks.
          </p>
        </div>
        <button
          onClick={() => setShowRegister(!showRegister)}
          className="text-label px-3 py-1.5 rounded-md"
          style={{ background: 'var(--ct-accent-500)', color: '#fff' }}
        >
          + Register runner
        </button>
      </div>

      {/* Register form */}
      {showRegister && (
        <div className="rounded-md border p-4 flex flex-col gap-3" style={{ borderColor: 'var(--ct-border)', background: 'var(--ct-surface)' }}>
          <h2 className="text-heading" style={{ color: 'var(--ct-text-1)' }}>Register self-hosted runner</h2>
          <div className="flex flex-col gap-1">
            <label className="text-label" style={{ color: 'var(--ct-text-2)' }}>Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="staging-runner-1"
              className="text-body px-3 py-2 rounded-md border"
              style={{ background: 'var(--ct-surface-raised)', borderColor: 'var(--ct-border)', color: 'var(--ct-text-1)' }} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-label" style={{ color: 'var(--ct-text-2)' }}>Tags (comma-separated)</label>
            <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="self-hosted, internal, staging"
              className="text-body px-3 py-2 rounded-md border"
              style={{ background: 'var(--ct-surface-raised)', borderColor: 'var(--ct-border)', color: 'var(--ct-text-1)' }} />
          </div>
          <button onClick={register} className="text-label px-3 py-2 rounded-md self-start"
            style={{ background: 'var(--ct-accent-500)', color: '#fff' }}>
            Generate token
          </button>
        </div>
      )}

      {/* Token display — shown once */}
      {newToken && (
        <div className="rounded-md border p-4" style={{ borderColor: 'var(--ct-flaky)', background: 'var(--ct-surface)' }}>
          <p className="text-label mb-2" style={{ color: 'var(--ct-flaky)' }}>
            Copy this token now — it will not be shown again.
          </p>
          <code className="text-mono px-3 py-2 rounded block break-all" style={{ background: 'var(--ct-surface-raised)', color: 'var(--ct-text-1)' }}>
            RUNNER_TOKEN={newToken.token}
          </code>
          <p className="text-caption mt-2" style={{ color: 'var(--ct-text-3)' }}>
            Run: <code className="text-mono">docker run -e RUNNER_TOKEN=... -e CT_API_BASE=https://app.continuous.testing ct/runner:latest</code>
          </p>
          <button onClick={() => setNewToken(null)} className="text-caption mt-2 underline" style={{ color: 'var(--ct-text-3)' }}>Dismiss</button>
        </div>
      )}

      <div className="rounded-md border overflow-hidden" style={{ borderColor: 'var(--ct-border)' }}>
        <DenseTable columns={columns} rows={runners} getKey={(r) => r.id}
          emptyMessage={loading ? 'Loading…' : 'No runners registered.'} />
      </div>
    </div>
  )
}
