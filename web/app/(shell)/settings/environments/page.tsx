'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'

type Env = {
  id: string
  name: string
  is_default: boolean
  variables: Record<string, string>
  created_at: string
}

export default function EnvironmentsPage() {
  const projectId = ''  // TODO: from active project store
  const [envs, setEnvs] = useState<Env[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [editing, setEditing] = useState<Record<string, string>>({})
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)

  const load = () => {
    if (!projectId) return
    fetch(`/api/projects/${projectId}/environments`)
      .then((r) => r.json())
      .then((d) => setEnvs((d as { data: Env[] }).data ?? []))
  }
  useEffect(load, [projectId])

  const activeEnv = envs.find((e) => e.id === selected) ?? envs[0]

  useEffect(() => {
    if (activeEnv) setEditing({ ...activeEnv.variables })
  }, [activeEnv?.id])

  async function save() {
    if (!activeEnv) return
    setSaving(true)
    await fetch(`/api/projects/${projectId}/environments/${activeEnv.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variables: editing }),
    })
    setSaving(false)
    load()
  }

  async function create() {
    await fetch(`/api/projects/${projectId}/environments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, variables: {} }),
    })
    setNewName('')
    load()
  }

  return (
    <div className="p-6 flex flex-col gap-4 max-w-3xl">
      <h1 className="text-title" style={{ color: 'var(--ct-text-1)' }}>Environments</h1>

      {/* Env tabs */}
      <div className="flex gap-2">
        {envs.map((e) => (
          <button key={e.id} onClick={() => setSelected(e.id)}
            className="text-label px-3 py-1.5 rounded-md border transition-colors"
            style={{
              borderColor: selected === e.id || (!selected && e.is_default) ? 'var(--ct-accent-500)' : 'var(--ct-border)',
              color: selected === e.id || (!selected && e.is_default) ? 'var(--ct-accent-400)' : 'var(--ct-text-2)',
              background: 'var(--ct-surface)',
            }}>
            {e.name}{e.is_default ? ' (default)' : ''}
          </button>
        ))}
        <div className="flex gap-1 ml-2">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New environment"
            className="text-body px-2 py-1 rounded-md border w-36"
            style={{ background: 'var(--ct-surface-raised)', borderColor: 'var(--ct-border)', color: 'var(--ct-text-1)' }} />
          <button onClick={create} disabled={!newName} className="text-label px-2 py-1 rounded-md disabled:opacity-50"
            style={{ background: 'var(--ct-surface-overlay)', color: 'var(--ct-text-1)' }}>+</button>
        </div>
      </div>

      {/* Variable editor */}
      {activeEnv && (
        <div className="flex flex-col gap-2">
          {Object.entries(editing).map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <input value={k} readOnly className="text-mono px-3 py-2 rounded-md border w-40 flex-shrink-0"
                style={{ background: 'var(--ct-surface-raised)', borderColor: 'var(--ct-border)', color: 'var(--ct-text-2)' }} />
              <input value={v} onChange={(e) => setEditing({ ...editing, [k]: e.target.value })}
                className="text-mono px-3 py-2 rounded-md border flex-1"
                style={{ background: 'var(--ct-surface-raised)', borderColor: 'var(--ct-border)', color: 'var(--ct-text-1)' }} />
              <button onClick={() => { const n = { ...editing }; delete n[k]; setEditing(n) }}
                className="text-body w-8 flex-shrink-0" style={{ color: 'var(--ct-text-3)' }}>×</button>
            </div>
          ))}
          <button onClick={() => setEditing({ ...editing, '': '' })}
            className="text-label px-3 py-1.5 rounded-md border self-start"
            style={{ borderColor: 'var(--ct-border)', color: 'var(--ct-text-2)' }}>
            + Add variable
          </button>
          <button onClick={save} disabled={saving} className="text-label px-3 py-2 rounded-md self-start disabled:opacity-50 mt-2"
            style={{ background: 'var(--ct-accent-500)', color: '#fff' }}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      )}
    </div>
  )
}
