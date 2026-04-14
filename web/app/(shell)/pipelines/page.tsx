'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DenseTable, type Column } from '@/components/data/DenseTable'

type Project  = { id: string; name: string; slug: string }
type Pipeline = { id: string; name: string; runs_on: string[]; step_count: number; project_id: string; project_name: string }

export default function PipelinesPage() {
  const router = useRouter()
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [loading,   setLoading]   = useState(true)
  const [creating,  setCreating]  = useState(false)

  async function load() {
    setLoading(true)
    try {
      const pr = await fetch('/api/projects').then(r => r.json()) as { data: Project[] }
      const projects = pr.data ?? []
      const all: Pipeline[] = []
      for (const proj of projects) {
        const pp = await fetch(`/api/projects/${proj.id}/pipelines`).then(r => r.json()) as { data: Pipeline[] }
        for (const p of pp.data ?? []) all.push({ ...p, project_id: proj.id, project_name: proj.name })
      }
      setPipelines(all)
    } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])

  async function createQuick() {
    setCreating(true)
    try {
      const pr = await fetch('/api/projects').then(r => r.json()) as { data: Project[] }
      let projectId = (pr.data ?? [])[0]?.id
      if (!projectId) {
        const np = await fetch('/api/projects', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'My Project', slug: 'my-project-' + Date.now() }),
        }).then(r => r.json()) as { data: Project }
        projectId = np.data.id
      }
      const pp = await fetch(`/api/projects/${projectId}/pipelines`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Pipeline', runs_on: ['hosted'] }),
      }).then(r => r.json()) as { data: { id: string } }
      router.push(`/projects/${projectId}/pipelines/${pp.data.id}`)
    } finally { setCreating(false) }
  }

  const cols: Column<Pipeline>[] = [
    {
      key: 'name', header: 'Pipeline', width: 'flex-1',
      render: p => (
        <div>
          <div style={{ fontWeight: 500, color: 'var(--ct-text-1)', fontSize: 14 }}>{p.name}</div>
          <div style={{ fontSize: 12, color: 'var(--ct-text-3)', marginTop: 1 }}>{p.project_name}</div>
        </div>
      ),
    },
    { key: 'steps',  header: 'Steps',  width: 'w-14', render: p => <span style={{ color: 'var(--ct-text-2)', fontSize: 14 }}>{(p as Record<string,unknown>).step_count as number ?? 0}</span> },
    { key: 'runner', header: 'Runner', width: 'w-28', render: p => <span style={{ color: 'var(--ct-text-3)', fontSize: 12 }}>{(p.runs_on ?? ['hosted']).join(', ')}</span> },
  ]

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--ct-text-1)', margin: 0 }}>Pipelines</h1>
        <button onClick={createQuick} disabled={creating} style={{
          padding: '8px 16px', borderRadius: 8, border: 'none',
          background: 'var(--ct-accent-500)', color: '#fff',
          fontSize: 14, fontWeight: 500, cursor: creating ? 'not-allowed' : 'pointer',
          opacity: creating ? 0.7 : 1,
        }}>
          {creating ? 'Creating…' : '+ New pipeline'}
        </button>
      </div>

      {pipelines.length === 0 && !loading ? (
        <div style={{ padding: '60px 0', textAlign: 'center' }}>
          <p style={{ color: 'var(--ct-text-2)', marginBottom: 8 }}>No pipelines yet.</p>
          <p style={{ color: 'var(--ct-text-3)', fontSize: 13 }}>
            Click "+ New pipeline" to create one, or use the API to import from OpenAPI spec.
          </p>
        </div>
      ) : (
        <div style={{ border: '1px solid var(--ct-border)', borderRadius: 8, overflow: 'hidden' }}>
          <DenseTable
            columns={cols} rows={pipelines} getKey={p => p.id}
            onRowClick={p => router.push(`/projects/${p.project_id}/pipelines/${p.id}`)}
            emptyMessage={loading ? 'Loading…' : 'No pipelines'}
          />
        </div>
      )}
    </div>
  )
}
