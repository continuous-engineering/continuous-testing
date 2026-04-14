'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

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

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-label" style={{ color: 'var(--ct-text-2)' }}>
        {label}
        {hint && <span className="ml-2 text-caption" style={{ color: 'var(--ct-text-3)' }}>{hint}</span>}
      </label>
      {children}
    </div>
  )
}

const inputCls = "text-body px-3 py-2 rounded-md border w-full"
const inputStyle = { background: 'var(--ct-surface-raised)', borderColor: 'var(--ct-border)', color: 'var(--ct-text-1)', outline: 'none' }

export default function ProjectSettingsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const router = useRouter()

  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [error,   setError]   = useState('')
  const [deleting, setDeleting] = useState(false)

  // form state
  const [name,              setName]             = useState('')
  const [description,       setDescription]      = useState('')
  const [owner,             setOwner]            = useState('')
  const [homepageUrl,       setHomepageUrl]      = useState('')
  const [labelsText,        setLabelsText]       = useState('')   // comma-separated
  const [reportText,        setReportText]       = useState('')   // comma-separated emails
  const [metaRows,          setMetaRows]         = useState<{ k: string; v: string }[]>([])

  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then(r => r.json())
      .then((d: { data: Project }) => {
        const p = d.data
        setProject(p)
        setName(p.name)
        setDescription(p.description ?? '')
        setOwner(p.owner ?? '')
        setHomepageUrl(p.homepage_url ?? '')
        setLabelsText((p.labels ?? []).join(', '))
        setReportText((p.report_recipients ?? []).join(', '))
        setMetaRows(Object.entries(p.metadata ?? {}).map(([k, v]) => ({ k, v: String(v) })))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [projectId])

  function addMetaRow() { setMetaRows(r => [...r, { k: '', v: '' }]) }
  function setMeta(i: number, field: 'k' | 'v', val: string) {
    setMetaRows(r => r.map((row, idx) => idx === i ? { ...row, [field]: val } : row))
  }
  function removeMeta(i: number) { setMetaRows(r => r.filter((_, idx) => idx !== i)) }

  async function save() {
    setSaving(true); setSaved(false); setError('')
    const labels            = labelsText.split(',').map(s => s.trim()).filter(Boolean)
    const report_recipients = reportText.split(',').map(s => s.trim()).filter(Boolean)
    const metadata          = Object.fromEntries(metaRows.filter(r => r.k).map(r => [r.k, r.v]))

    const res = await fetch(`/api/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim() || undefined,
        description: description || undefined,
        owner: owner || null,
        homepage_url: homepageUrl || null,
        labels,
        report_recipients,
        metadata,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const d = await res.json() as { error?: string }
      setError(d.error ?? 'Save failed'); return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function deleteProject() {
    if (!confirm(`Delete project "${project?.name}"? This will delete all pipelines, runs, secrets and environments. This cannot be undone.`)) return
    setDeleting(true)
    await fetch(`/api/projects/${projectId}`, { method: 'DELETE' })
    router.push('/projects')
  }

  if (loading) return <div className="p-6 text-body" style={{ color: 'var(--ct-text-2)' }}>Loading…</div>
  if (!project) return <div className="p-6 text-body" style={{ color: 'var(--ct-fail)' }}>Project not found.</div>

  return (
    <div className="p-6 flex flex-col gap-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button onClick={() => router.push(`/projects/${projectId}`)}
              className="text-caption" style={{ color: 'var(--ct-text-3)' }}>
              ← Pipelines
            </button>
          </div>
          <h1 className="text-title" style={{ color: 'var(--ct-text-1)' }}>Project settings</h1>
          <p className="text-caption mt-1 font-mono" style={{ color: 'var(--ct-text-3)' }}>
            {project.slug} · updated {new Date(project.updated_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* ── Identity ── */}
      <section className="flex flex-col gap-5">
        <h2 className="text-heading pb-1 border-b" style={{ color: 'var(--ct-text-1)', borderColor: 'var(--ct-border)' }}>
          Identity
        </h2>

        <Field label="Project name">
          <input value={name} onChange={e => setName(e.target.value)}
            className={inputCls} style={inputStyle} />
        </Field>

        <Field label="Description" hint="shown in reports and dashboards">
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            rows={4} placeholder="What does this project test? What system does it cover? Who is it for?"
            className="text-body px-3 py-2 rounded-md border resize-none w-full"
            style={inputStyle} />
        </Field>

        <Field label="Owner" hint="person or team responsible">
          <input value={owner} onChange={e => setOwner(e.target.value)}
            placeholder="e.g. Platform Team, shree@continuia.ai"
            className={inputCls} style={inputStyle} />
        </Field>

        <Field label="Homepage / base URL" hint="the system under test">
          <input value={homepageUrl} onChange={e => setHomepageUrl(e.target.value)}
            placeholder="https://api.example.com"
            className={inputCls} style={{ ...inputStyle, fontFamily: 'monospace' }} />
        </Field>
      </section>

      {/* ── Labels ── */}
      <section className="flex flex-col gap-5">
        <h2 className="text-heading pb-1 border-b" style={{ color: 'var(--ct-text-1)', borderColor: 'var(--ct-border)' }}>
          Labels
        </h2>
        <Field label="Labels" hint="comma-separated — e.g. production, mobile, critical, billing">
          <input value={labelsText} onChange={e => setLabelsText(e.target.value)}
            placeholder="production, checkout, payments"
            className={inputCls} style={inputStyle} />
          {labelsText && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {labelsText.split(',').map(s => s.trim()).filter(Boolean).map(label => (
                <span key={label} className="text-caption px-2 py-0.5 rounded-full border"
                  style={{ borderColor: 'var(--ct-accent-500)', color: 'var(--ct-accent-400)', background: 'rgba(16,185,129,0.08)' }}>
                  {label}
                </span>
              ))}
            </div>
          )}
        </Field>
      </section>

      {/* ── Reports ── */}
      <section className="flex flex-col gap-5">
        <h2 className="text-heading pb-1 border-b" style={{ color: 'var(--ct-text-1)', borderColor: 'var(--ct-border)' }}>
          Reporting
        </h2>
        <Field label="Report recipients" hint="comma-separated email addresses">
          <input value={reportText} onChange={e => setReportText(e.target.value)}
            placeholder="shree@continuia.ai, team@company.com"
            className={inputCls} style={inputStyle} />
          <p className="text-caption" style={{ color: 'var(--ct-text-3)' }}>
            These addresses receive test run summary reports and failure alerts for this project.
          </p>
        </Field>
      </section>

      {/* ── Custom metadata ── */}
      <section className="flex flex-col gap-5">
        <h2 className="text-heading pb-1 border-b" style={{ color: 'var(--ct-text-1)', borderColor: 'var(--ct-border)' }}>
          Custom metadata
        </h2>
        <p className="text-body" style={{ color: 'var(--ct-text-2)' }}>
          Attach any key-value data to this project — Jira board key, Slack channel, SLA tier, cost centre, etc.
          Appears in reports and is available via the API.
        </p>
        <div className="flex flex-col gap-2">
          {metaRows.map((row, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input value={row.k} onChange={e => setMeta(i, 'k', e.target.value)}
                placeholder="Key (e.g. jira_project, slack_channel)"
                className="text-body px-3 py-2 rounded-md border font-mono text-sm w-48 flex-shrink-0"
                style={inputStyle} />
              <input value={row.v} onChange={e => setMeta(i, 'v', e.target.value)}
                placeholder="Value"
                className="text-body px-3 py-2 rounded-md border flex-1"
                style={inputStyle} />
              <button onClick={() => removeMeta(i)}
                className="text-body w-7 h-7 flex-shrink-0 flex items-center justify-center rounded"
                style={{ color: 'var(--ct-text-3)' }}>×</button>
            </div>
          ))}
          <button onClick={addMetaRow}
            className="text-caption self-start"
            style={{ color: 'var(--ct-accent-400)' }}>
            + Add field
          </button>
        </div>
      </section>

      {/* ── Save ── */}
      <div className="flex items-center gap-3 pt-2">
        <button onClick={save} disabled={saving}
          className="text-body font-medium px-4 py-2 rounded-md disabled:opacity-50"
          style={{ background: 'var(--ct-accent-500)', color: '#fff' }}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        {saved  && <span className="text-body" style={{ color: 'var(--ct-pass)' }}>✓ Saved</span>}
        {error  && <span className="text-caption" style={{ color: 'var(--ct-fail)' }}>{error}</span>}
      </div>

      {/* ── Danger zone ── */}
      <section className="flex flex-col gap-3 rounded-md border p-4"
        style={{ borderColor: 'var(--ct-fail)', background: 'rgba(239,68,68,0.04)' }}>
        <h2 className="text-heading" style={{ color: 'var(--ct-fail)' }}>Danger zone</h2>
        <p className="text-body" style={{ color: 'var(--ct-text-2)' }}>
          Deleting this project permanently removes all its pipelines, steps, run history, secrets, environments, and API specs.
        </p>
        <button onClick={deleteProject} disabled={deleting}
          className="text-label px-3 py-2 rounded-md border self-start disabled:opacity-50"
          style={{ borderColor: 'var(--ct-fail)', color: 'var(--ct-fail)' }}>
          {deleting ? 'Deleting…' : 'Delete project'}
        </button>
      </section>
    </div>
  )
}
