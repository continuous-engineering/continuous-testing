'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'

type Runner = {
  id: string; name: string; scope: 'hosted' | 'self-hosted'
  status: 'idle' | 'busy' | 'offline'; tags: string[]; capabilities: string[]
  last_seen_at: string | null; created_at: string
}
type Queue = { pending?: number; running?: number; failed?: number }

const STATUS_DOT: Record<string, string> = {
  idle:    'bg-[var(--ct-pass)]',
  busy:    'bg-[var(--ct-running)] animate-pulse',
  offline: 'bg-[var(--ct-skipped)]',
}

const CAPABILITY_OPTIONS = ['api', 'ui', 'ai'] as const

function relativeTime(iso: string | null): string {
  if (!iso) return 'never'
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 10_000)  return 'just now'
  if (diff < 60_000)  return `${Math.round(diff / 1000)}s ago`
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`
  return `${Math.round(diff / 3_600_000)}h ago`
}

function isOnline(iso: string | null): boolean {
  if (!iso) return false
  return Date.now() - new Date(iso).getTime() < 90_000  // 90s = missed 3 heartbeats
}

export default function RunnersPage() {
  const [runners,     setRunners]     = useState<Runner[]>([])
  const [queue,       setQueue]       = useState<Queue>({})
  const [loading,     setLoading]     = useState(true)
  const [showRegister, setShowRegister] = useState(false)
  const [newToken,    setNewToken]    = useState<{ token: string; name: string } | null>(null)
  const [form, setForm] = useState({ name: '', tags: '', capabilities: ['api'] as string[] })
  const [now, setNow] = useState(Date.now())  // ticker for relative timestamps

  const load = useCallback(async () => {
    const res = await fetch('/api/runners/status').then(r => r.json()) as { data: { runners: Runner[]; queue: Queue } }
    setRunners(res.data?.runners ?? [])
    setQueue(res.data?.queue ?? {})
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
    // Auto-refresh every 10s while page is open
    const poll = setInterval(() => { void load() }, 10_000)
    const tick = setInterval(() => setNow(Date.now()), 5_000)  // refresh relative times
    return () => { clearInterval(poll); clearInterval(tick) }
  }, [load])

  function toggleCapability(cap: string) {
    setForm(f => ({
      ...f,
      capabilities: f.capabilities.includes(cap)
        ? f.capabilities.filter(c => c !== cap)
        : [...f.capabilities, cap],
    }))
  }

  async function register() {
    const res = await fetch('/api/runners', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        capabilities: form.capabilities,
      }),
    })
    const d = await res.json() as { data: Runner & { token: string } }
    setNewToken({ token: d.data.token, name: d.data.name })
    setShowRegister(false)
    setForm({ name: '', tags: '', capabilities: ['api'] })
    void load()
  }

  async function revoke(id: string, name: string) {
    if (!confirm(`Revoke runner "${name}"? It will stop receiving jobs immediately.`)) return
    await fetch(`/api/runners/${id}`, { method: 'DELETE' })
    void load()
  }

  const hosted    = runners.filter(r => r.scope === 'hosted')
  const selfHosted = runners.filter(r => r.scope === 'self-hosted')
  const onlineCount = runners.filter(r => isOnline(r.last_seen_at)).length
  const busyCount   = runners.filter(r => r.status === 'busy').length

  return (
    <div className="p-6 flex flex-col gap-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-title" style={{ color: 'var(--ct-text-1)' }}>Runners</h1>
          <p className="text-body mt-1" style={{ color: 'var(--ct-text-2)' }}>
            Hosted runners are managed by continuous.testing. Register your own for private networks.
          </p>
        </div>
        <button onClick={() => setShowRegister(!showRegister)}
          className="text-label px-3 py-1.5 rounded-md"
          style={{ background: 'var(--ct-accent-500)', color: '#fff' }}>
          + Register runner
        </button>
      </div>

      {/* Live status bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Online',    value: onlineCount,          color: onlineCount > 0 ? 'var(--ct-pass)' : 'var(--ct-fail)' },
          { label: 'Busy',      value: busyCount,             color: busyCount > 0 ? 'var(--ct-running)' : 'var(--ct-text-3)' },
          { label: 'Pending jobs', value: queue.pending ?? 0, color: (queue.pending ?? 0) > 0 ? 'var(--ct-flaky)' : 'var(--ct-text-3)' },
          { label: 'Failed jobs',  value: queue.failed ?? 0,  color: (queue.failed ?? 0) > 0 ? 'var(--ct-fail)' : 'var(--ct-text-3)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-md border p-3 flex flex-col gap-1"
            style={{ borderColor: 'var(--ct-border)', background: 'var(--ct-surface)' }}>
            <span className="text-caption" style={{ color: 'var(--ct-text-3)' }}>{label}</span>
            <span className="text-title font-semibold tabular-nums" style={{ color }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Register form */}
      {showRegister && (
        <div className="rounded-md border p-5 flex flex-col gap-4"
          style={{ borderColor: 'var(--ct-border)', background: 'var(--ct-surface)' }}>
          <h2 className="text-heading" style={{ color: 'var(--ct-text-1)' }}>Register self-hosted runner</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-label" style={{ color: 'var(--ct-text-2)' }}>Name</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="staging-runner-1"
                className="text-body px-3 py-2 rounded-md border"
                style={{ background: 'var(--ct-surface-raised)', borderColor: 'var(--ct-border)', color: 'var(--ct-text-1)' }} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-label" style={{ color: 'var(--ct-text-2)' }}>Tags (comma-separated)</label>
              <input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })}
                placeholder="self-hosted, internal, staging"
                className="text-body px-3 py-2 rounded-md border"
                style={{ background: 'var(--ct-surface-raised)', borderColor: 'var(--ct-border)', color: 'var(--ct-text-1)' }} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-label" style={{ color: 'var(--ct-text-2)' }}>Capabilities</label>
            <div className="flex gap-4">
              {CAPABILITY_OPTIONS.map(cap => (
                <label key={cap} className="flex items-center gap-1.5 cursor-pointer text-body" style={{ color: 'var(--ct-text-1)' }}>
                  <input type="checkbox" checked={form.capabilities.includes(cap)}
                    onChange={() => toggleCapability(cap)} />
                  {cap.toUpperCase()}
                </label>
              ))}
            </div>
          </div>
          <button onClick={register} disabled={!form.name || form.capabilities.length === 0}
            className="text-label px-3 py-2 rounded-md self-start disabled:opacity-50"
            style={{ background: 'var(--ct-accent-500)', color: '#fff' }}>
            Generate token
          </button>
        </div>
      )}

      {/* Token display */}
      {newToken && (
        <div className="rounded-md border p-4 flex flex-col gap-2"
          style={{ borderColor: 'var(--ct-flaky)', background: 'var(--ct-surface)' }}>
          <p className="text-label" style={{ color: 'var(--ct-flaky)' }}>
            Copy this token now — it will not be shown again.
          </p>
          <div className="flex gap-2 items-center">
            <code className="text-mono px-3 py-2 rounded block break-all flex-1 text-sm"
              style={{ background: 'var(--ct-surface-raised)', color: 'var(--ct-text-1)' }}>
              {newToken.token}
            </code>
            <button onClick={() => navigator.clipboard.writeText(newToken.token)}
              className="text-label px-3 py-2 rounded-md border flex-shrink-0"
              style={{ borderColor: 'var(--ct-border)', color: 'var(--ct-text-2)' }}>
              Copy
            </button>
          </div>
          <p className="text-caption" style={{ color: 'var(--ct-text-3)' }}>Docker command:</p>
          <div className="flex gap-2 items-start">
            <code className="text-mono px-3 py-2 rounded block break-all flex-1 text-xs"
              style={{ background: 'var(--ct-surface-raised)', color: 'var(--ct-text-1)' }}>
              {`docker run -e RUNNER_TOKEN=${newToken.token} -e CT_API_BASE=${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8080'} ct/runner:latest`}
            </code>
            <button onClick={() => navigator.clipboard.writeText(
              `docker run -e RUNNER_TOKEN=${newToken.token} -e CT_API_BASE=${window.location.origin} ct/runner:latest`
            )} className="text-label px-3 py-2 rounded-md border flex-shrink-0"
              style={{ borderColor: 'var(--ct-border)', color: 'var(--ct-text-2)' }}>
              Copy
            </button>
          </div>
          <button onClick={() => setNewToken(null)} className="text-caption underline self-start mt-1"
            style={{ color: 'var(--ct-text-3)' }}>Dismiss</button>
        </div>
      )}

      {/* Hosted runners */}
      {hosted.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-heading" style={{ color: 'var(--ct-text-1)' }}>
            Hosted runners <span className="text-caption ml-1" style={{ color: 'var(--ct-text-3)' }}>managed by continuous.testing</span>
          </h2>
          <div className="rounded-md border overflow-hidden" style={{ borderColor: 'var(--ct-border)' }}>
            {hosted.map((r, i) => (
              <RunnerRow key={r.id} runner={r} onRevoke={revoke}
                last={i === hosted.length - 1} />
            ))}
          </div>
        </section>
      )}

      {/* Self-hosted runners */}
      {selfHosted.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-heading" style={{ color: 'var(--ct-text-1)' }}>
            Self-hosted runners
          </h2>
          <div className="rounded-md border overflow-hidden" style={{ borderColor: 'var(--ct-border)' }}>
            {selfHosted.map((r, i) => (
              <RunnerRow key={r.id} runner={r} onRevoke={revoke}
                last={i === selfHosted.length - 1} />
            ))}
          </div>
        </section>
      )}

      {!loading && runners.length === 0 && (
        <p className="text-body" style={{ color: 'var(--ct-text-3)' }}>No runners registered.</p>
      )}
    </div>
  )
}

function RunnerRow({ runner, onRevoke, last }: { runner: Runner; onRevoke: (id: string, name: string) => void; last: boolean }) {
  const online = isOnline(runner.last_seen_at)
  const statusColor = runner.status === 'idle' ? 'var(--ct-pass)'
    : runner.status === 'busy' ? 'var(--ct-running)'
    : 'var(--ct-text-3)'

  return (
    <div className="flex items-center gap-4 px-4"
      style={{
        height: 52, borderBottom: last ? 'none' : '1px solid var(--ct-border)',
        background: 'var(--ct-surface)',
      }}>
      {/* Online indicator */}
      <div className="flex flex-col items-center gap-0.5 flex-shrink-0 w-10">
        <span className={cn('w-2 h-2 rounded-full', online ? STATUS_DOT[runner.status] : 'bg-[var(--ct-skipped)]')} />
        <span className="text-caption" style={{ color: online ? statusColor : 'var(--ct-text-3)', fontSize: 10 }}>
          {online ? runner.status : 'offline'}
        </span>
      </div>

      {/* Name + scope */}
      <div className="flex flex-col flex-shrink-0 w-44">
        <span className="text-body font-medium truncate" style={{ color: 'var(--ct-text-1)' }}>{runner.name}</span>
        <span className="text-caption" style={{ color: 'var(--ct-text-3)' }}>{runner.scope}</span>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1 flex-1 min-w-0">
        {runner.tags.map(t => (
          <span key={t} className="text-caption px-1.5 py-0.5 rounded border"
            style={{ borderColor: 'var(--ct-border)', color: 'var(--ct-text-3)', fontSize: 11 }}>
            {t}
          </span>
        ))}
      </div>

      {/* Capabilities */}
      <div className="flex gap-1 flex-shrink-0">
        {(runner.capabilities ?? []).map(c => (
          <span key={c} className="text-caption px-1.5 py-0.5 rounded"
            style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--ct-accent-400)', fontSize: 11 }}>
            {c}
          </span>
        ))}
      </div>

      {/* Last seen */}
      <div className="text-caption w-20 text-right flex-shrink-0"
        style={{ color: online ? 'var(--ct-text-2)' : 'var(--ct-text-3)' }}>
        {relativeTime(runner.last_seen_at)}
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 w-16 text-right">
        {runner.scope === 'self-hosted' && (
          <button onClick={() => onRevoke(runner.id, runner.name)}
            className="text-caption" style={{ color: 'var(--ct-fail)' }}>
            Revoke
          </button>
        )}
      </div>
    </div>
  )
}
