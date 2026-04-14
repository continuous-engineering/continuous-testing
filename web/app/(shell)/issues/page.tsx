'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { DenseTable, type Column } from '@/components/data/DenseTable'
import { cn } from '@/lib/utils'
import { useProjectPicker } from '@/lib/hooks/useProjectPicker'

type IssueStatus = 'open' | 'acknowledged' | 'in_progress' | 'resolved'
type IssueSeverity = 'low' | 'medium' | 'high' | 'critical'

type Issue = {
  id: string
  title: string
  status: IssueStatus
  severity: IssueSeverity
  assignee: string | null
  first_seen_at: string
  last_seen_at: string
  external_refs: { adapter: string; external_id: string; url: string }[]
}

const STATUS_COLORS: Record<IssueStatus, string> = {
  open:        'var(--ct-fail)',
  acknowledged:'var(--ct-flaky)',
  in_progress: 'var(--ct-running)',
  resolved:    'var(--ct-pass)',
}

const SEV_COLORS: Record<IssueSeverity, string> = {
  critical: 'var(--ct-fail)',
  high:     '#f97316',
  medium:   'var(--ct-flaky)',
  low:      'var(--ct-text-3)',
}

const STATUS_OPTIONS: IssueStatus[] = ['open', 'acknowledged', 'in_progress', 'resolved']

export default function IssuesPage() {
  const { projectId, setProjectId, projects, loading: projectsLoading } = useProjectPicker()
  const [issues, setIssues] = useState<Issue[]>([])
  const [statusFilter, setStatusFilter] = useState<IssueStatus | ''>('')
  const [loading, setLoading] = useState(true)

  const load = () => {
    if (!projectId) { setLoading(false); return }
    setLoading(true)
    const q = statusFilter ? `?status=${statusFilter}` : ''
    fetch(`/api/projects/${projectId}/issues${q}`)
      .then((r) => r.json())
      .then((d) => { setIssues((d as { data: Issue[] }).data ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }
  useEffect(load, [projectId, statusFilter])

  async function updateStatus(id: string, status: IssueStatus) {
    await fetch(`/api/projects/${projectId}/issues/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    load()
  }

  const columns: Column<Issue>[] = [
    {
      key: 'severity', header: '', width: 'w-4',
      render: (i) => (
        <span title={i.severity} className="w-1.5 h-1.5 rounded-full block" style={{ background: SEV_COLORS[i.severity] }} />
      ),
    },
    {
      key: 'title', header: 'Issue', width: 'flex-1',
      render: (i) => (
        <div className="flex flex-col min-w-0">
          <span className="text-body truncate" style={{ color: 'var(--ct-text-1)' }}>{i.title}</span>
          {i.external_refs.length > 0 && (
            <div className="flex gap-2 mt-0.5">
              {i.external_refs.map((r) => (
                <a key={r.adapter} href={r.url} target="_blank" rel="noreferrer"
                  className="text-caption underline" style={{ color: 'var(--ct-text-3)' }}>
                  {r.adapter.toUpperCase()}-{r.external_id}
                </a>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'assignee', header: 'Assignee', width: 'w-28',
      render: (i) => (
        <span className="text-caption" style={{ color: 'var(--ct-text-3)' }}>
          {i.assignee ?? '—'}
        </span>
      ),
    },
    {
      key: 'status', header: 'Status', width: 'w-32',
      render: (i) => (
        <select
          value={i.status}
          onChange={(e) => updateStatus(i.id, e.target.value as IssueStatus)}
          onClick={(e) => e.stopPropagation()}
          className="text-label rounded px-1 py-0.5 border"
          style={{
            color: STATUS_COLORS[i.status],
            borderColor: 'var(--ct-border)',
            background: 'var(--ct-surface-raised)',
          }}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
      ),
    },
    {
      key: 'last_seen', header: 'Last seen', width: 'w-28',
      render: (i) => (
        <span className="text-caption" style={{ color: 'var(--ct-text-3)' }}>
          {new Date(i.last_seen_at).toLocaleDateString()}
        </span>
      ),
    },
  ]

  return (
    <div className="p-6 flex flex-col gap-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-title" style={{ color: 'var(--ct-text-1)' }}>Issues</h1>

        <div className="flex items-center gap-3">
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

          {/* Status filter */}
          <div className="flex gap-1.5">
            {(['', ...STATUS_OPTIONS] as const).map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={cn('text-label px-2.5 py-1 rounded-md border transition-colors')}
                style={{
                  borderColor: statusFilter === s ? 'var(--ct-accent-500)' : 'var(--ct-border)',
                  color: statusFilter === s ? 'var(--ct-accent-400)' : 'var(--ct-text-2)',
                  background: 'var(--ct-surface)',
                }}>
                {s || 'All'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!projectId && !projectsLoading && (
        <p className="text-body" style={{ color: 'var(--ct-text-3)' }}>
          No projects found. Create a project first.
        </p>
      )}

      {projectId && (
        <div className="rounded-md border overflow-hidden" style={{ borderColor: 'var(--ct-border)' }}>
          <DenseTable
            columns={columns}
            rows={issues}
            getKey={(i) => i.id}
            emptyMessage={loading ? 'Loading…' : statusFilter ? `No ${statusFilter} issues.` : 'No issues — all tests passing!'}
          />
        </div>
      )}
    </div>
  )
}
