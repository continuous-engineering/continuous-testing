'use client'
export const dynamic = 'force-dynamic'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useProjectPicker } from '@/lib/hooks/useProjectPicker'
import { load as loadYaml } from 'js-yaml'

type Endpoint = { path: string; method: string; summary: string; operationId?: string }
type ParsedSpec = { title: string; version: string; endpoints: Endpoint[]; raw: Record<string, unknown> }

const HTTP_METHODS = ['get','post','put','patch','delete','head','options']

function parseOpenApi(raw: Record<string, unknown>): ParsedSpec {
  const info = (raw.info ?? {}) as Record<string, string>
  const paths = (raw.paths ?? {}) as Record<string, Record<string, Record<string, unknown>>>
  const endpoints: Endpoint[] = []
  for (const [path, pathItem] of Object.entries(paths)) {
    for (const method of HTTP_METHODS) {
      const op = pathItem[method]
      if (op) {
        endpoints.push({
          path,
          method: method.toUpperCase(),
          summary: (op.summary as string) || (op.operationId as string) || `${method.toUpperCase()} ${path}`,
          operationId: op.operationId as string | undefined,
        })
      }
    }
  }
  return { title: info.title || 'API Spec', version: info.version || '1.0.0', endpoints, raw }
}

const METHOD_COLOR: Record<string, string> = {
  GET: 'var(--ct-pass)', POST: 'var(--ct-accent-500)', PUT: 'var(--ct-flaky)',
  PATCH: 'var(--ct-flaky)', DELETE: 'var(--ct-fail)', HEAD: 'var(--ct-text-3)', OPTIONS: 'var(--ct-text-3)',
}

export default function ImportPage() {
  const router = useRouter()
  const { projectId, setProjectId, projects, loading: projectsLoading } = useProjectPicker()
  const fileRef    = useRef<HTMLInputElement>(null)
  const yamlRef    = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<'openapi' | 'pipeline'>('pipeline')

  // ── Pipeline YAML import state ──
  const [yamlText,    setYamlText]    = useState('')
  const [yamlError,   setYamlError]   = useState('')
  const [yamlSaving,  setYamlSaving]  = useState(false)

  async function importPipelineYaml() {
    if (!projectId || !yamlText.trim()) return
    setYamlSaving(true); setYamlError('')
    const res = await fetch(`/api/projects/${projectId}/pipelines/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ yaml: yamlText }),
    })
    const d = await res.json() as { data?: { pipelineId: string; stepCount: number }; error?: string }
    setYamlSaving(false)
    if (!res.ok) { setYamlError(d.error ?? 'Import failed'); return }
    router.push(`/projects/${projectId}/pipelines/${d.data!.pipelineId}`)
  }

  async function onYamlFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setYamlText(await file.text())
  }

  // ── OpenAPI import state ──
  const [tab, setTab]           = useState<'file' | 'url' | 'paste'>('file')
  const [text, setText]         = useState('')
  const [url, setUrl]           = useState('')
  const [fetching, setFetching] = useState(false)
  const [parsed, setParsed]     = useState<ParsedSpec | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError]       = useState('')
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)

  function parseText(raw: string) {
    setError('')
    try {
      let obj: Record<string, unknown>
      const trimmed = raw.trim()
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        obj = JSON.parse(trimmed)
      } else {
        obj = loadYaml(trimmed) as Record<string, unknown>
      }
      const result = parseOpenApi(obj)
      setParsed(result)
      setSelected(new Set(result.endpoints.map(e => `${e.method}:${e.path}`)))
    } catch (e) {
      setError('Could not parse spec — paste valid OpenAPI 3.x JSON or YAML.')
    }
  }

  async function fetchUrl() {
    if (!url.trim()) return
    setFetching(true); setError('')
    try {
      const res = await fetch(`/api/proxy-spec?url=${encodeURIComponent(url)}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const text = await res.text()
      parseText(text)
    } catch {
      setError('Could not fetch spec from that URL. Try pasting the contents instead.')
    } finally { setFetching(false) }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    parseText(text)
  }

  function toggleEndpoint(key: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  async function save() {
    if (!projectId || !parsed) return
    setSaving(true); setError('')
    try {
      // 1. Store the spec
      const specRes = await fetch(`/api/projects/${projectId}/specs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: parsed.title, version: parsed.version, spec_json: parsed.raw }),
      })
      if (!specRes.ok) throw new Error('Failed to save spec')

      // 2. Create a pipeline with API steps for selected endpoints
      const selectedEndpoints = parsed.endpoints.filter(e => selected.has(`${e.method}:${e.path}`))
      if (selectedEndpoints.length === 0) { setSaved(true); setSaving(false); return }

      const pipelineRes = await fetch(`/api/projects/${projectId}/pipelines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `${parsed.title} tests`, runs_on: ['hosted'] }),
      })
      const pipelineData = await pipelineRes.json() as { data: { id: string } }
      const pipelineId = pipelineData.data.id

      // 3. Create steps for each selected endpoint
      for (let i = 0; i < selectedEndpoints.length; i++) {
        const ep = selectedEndpoints[i]!
        await fetch(`/api/projects/${projectId}/pipelines/${pipelineId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            steps: [{
              name: ep.summary,
              type: 'api',
              position: i,
              prerequisites: [],
              outputs: {},
              config: { method: ep.method, url: ep.path, assertions: [{ type: 'status', operator: 'lt', expected: 400 }] },
              on_failure: 'continue',
              timeout_ms: 30000,
            }],
          }),
        })
      }

      router.push(`/projects/${projectId}/pipelines/${pipelineId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed')
      setSaving(false)
    }
  }

  const tabStyle = (t: typeof tab) => ({
    padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13,
    background: tab === t ? 'var(--ct-accent-500)' : 'transparent',
    color: tab === t ? '#fff' : 'var(--ct-text-2)',
    border: '1px solid ' + (tab === t ? 'var(--ct-accent-500)' : 'var(--ct-border)'),
  })

  const modeTabStyle = (m: typeof mode) => ({
    padding: '6px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500,
    background: mode === m ? 'var(--ct-accent-500)' : 'var(--ct-surface)',
    color: mode === m ? '#fff' : 'var(--ct-text-2)',
    border: '1px solid ' + (mode === m ? 'var(--ct-accent-500)' : 'var(--ct-border)'),
  })

  const inputStyle: React.CSSProperties = {
    background: 'var(--ct-surface-raised)', borderColor: 'var(--ct-border)', color: 'var(--ct-text-1)', outline: 'none',
  }

  return (
    <div className="p-6 flex flex-col gap-6 max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-title" style={{ color: 'var(--ct-text-1)' }}>Import</h1>
          <p className="text-body mt-1" style={{ color: 'var(--ct-text-2)' }}>
            Import a pipeline from YAML, or upload an OpenAPI spec to store against a project.
          </p>
        </div>
        {!projectsLoading && projects.length > 1 && (
          <select value={projectId} onChange={e => setProjectId(e.target.value)}
            className="text-body px-3 py-1.5 rounded-md border"
            style={{ background: 'var(--ct-surface-raised)', borderColor: 'var(--ct-border)', color: 'var(--ct-text-1)' }}>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>

      {/* Mode switcher */}
      <div className="flex gap-2">
        <button style={modeTabStyle('pipeline')} onClick={() => setMode('pipeline')}>
          Pipeline YAML
        </button>
        <button style={modeTabStyle('openapi')} onClick={() => setMode('openapi')}>
          OpenAPI Spec
        </button>
      </div>

      {/* ── Pipeline YAML import ── */}
      {mode === 'pipeline' && (
        <div className="flex flex-col gap-4">
          <div className="rounded-md border p-3 flex flex-col gap-1"
            style={{ borderColor: 'var(--ct-border)', background: 'rgba(16,185,129,0.04)' }}>
            <p className="text-label" style={{ color: 'var(--ct-accent-400)' }}>Pipeline YAML format</p>
            <p className="text-caption" style={{ color: 'var(--ct-text-3)' }}>
              Export any pipeline from the canvas using ↓ YAML, edit it, then import it here.
              Prerequisites are referenced by step name — portable across workspaces.
            </p>
          </div>

          {!projectId && !projectsLoading && (
            <p className="text-body" style={{ color: 'var(--ct-flaky)' }}>Select a project above first.</p>
          )}

          {projectId && (
            <>
              <div className="flex flex-col gap-2">
                <input ref={yamlRef} type="file" accept=".yaml,.yml" onChange={onYamlFile} className="hidden" />
                <div className="flex gap-2 mb-1">
                  <button onClick={() => yamlRef.current?.click()}
                    className="text-label px-3 py-1.5 rounded-md border"
                    style={{ borderColor: 'var(--ct-border)', color: 'var(--ct-text-2)' }}>
                    Upload .yaml
                  </button>
                  <span className="text-caption self-center" style={{ color: 'var(--ct-text-3)' }}>or paste below</span>
                </div>
                <textarea
                  value={yamlText}
                  onChange={e => setYamlText(e.target.value)}
                  rows={16}
                  placeholder={'version: "1"\nname: My Pipeline\nruns_on:\n  - hosted\nsteps:\n  - name: Check health\n    type: api\n    config:\n      method: GET\n      url: https://api.example.com/health\n      assertions:\n        - type: status\n          operator: lt\n          expected: 400'}
                  className="font-mono text-mono px-3 py-2 rounded-md border resize-none w-full"
                  style={{ ...inputStyle, fontSize: 12 }}
                />
              </div>

              {yamlError && <p className="text-caption" style={{ color: 'var(--ct-fail)' }}>{yamlError}</p>}

              <div className="flex gap-3 items-center">
                <button onClick={importPipelineYaml} disabled={yamlSaving || !yamlText.trim()}
                  className="text-label px-4 py-2 rounded-md disabled:opacity-50"
                  style={{ background: 'var(--ct-accent-500)', color: '#fff' }}>
                  {yamlSaving ? 'Importing…' : 'Import pipeline'}
                </button>
                <p className="text-caption" style={{ color: 'var(--ct-text-3)' }}>
                  Creates a new pipeline in the selected project. Existing pipelines are not affected.
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── OpenAPI spec import ── (existing content below, shown only in openapi mode) */}
      {mode === 'openapi' && <>

      {!projectId && !projectsLoading && (
        <div className="rounded-md border p-4" style={{ borderColor: 'var(--ct-flaky)', background: 'var(--ct-surface)' }}>
          <p className="text-body" style={{ color: 'var(--ct-flaky)' }}>Create a project first before importing a spec.</p>
        </div>
      )}

      {projectId && !parsed && (
        <div className="rounded-md border p-5 flex flex-col gap-4" style={{ borderColor: 'var(--ct-border)', background: 'var(--ct-surface)' }}>
          {/* Tab selector */}
          <div className="flex gap-2">
            {(['file','paste','url'] as const).map(t => (
              <button key={t} style={tabStyle(t)} onClick={() => setTab(t)}>
                {t === 'file' ? 'Upload file' : t === 'paste' ? 'Paste spec' : 'From URL'}
              </button>
            ))}
          </div>

          {tab === 'file' && (
            <div>
              <input ref={fileRef} type="file" accept=".json,.yaml,.yml" onChange={onFile} className="hidden" />
              <div
                onClick={() => fileRef.current?.click()}
                className="rounded-md border-2 border-dashed p-10 text-center cursor-pointer"
                style={{ borderColor: 'var(--ct-border)' }}
              >
                <p className="text-body" style={{ color: 'var(--ct-text-2)' }}>Click to upload OpenAPI spec</p>
                <p className="text-caption mt-1" style={{ color: 'var(--ct-text-3)' }}>.json · .yaml · .yml — OpenAPI 3.x</p>
              </div>
            </div>
          )}

          {tab === 'paste' && (
            <div className="flex flex-col gap-2">
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder={'openapi: 3.0.0\ninfo:\n  title: My API\n  version: 1.0.0\npaths:\n  /users:\n    get:\n      summary: List users'}
                rows={12}
                className="font-mono text-mono px-3 py-2 rounded-md border resize-none"
                style={{ background: 'var(--ct-surface-raised)', borderColor: 'var(--ct-border)', color: 'var(--ct-text-1)', fontSize: 12 }}
              />
              <button onClick={() => parseText(text)} disabled={!text.trim()}
                className="text-label px-3 py-2 rounded-md self-start disabled:opacity-50"
                style={{ background: 'var(--ct-accent-500)', color: '#fff' }}>
                Parse spec
              </button>
            </div>
          )}

          {tab === 'url' && (
            <div className="flex gap-2">
              <input value={url} onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchUrl()}
                placeholder="https://petstore3.swagger.io/api/v3/openapi.json"
                className="text-body px-3 py-2 rounded-md border flex-1"
                style={{ background: 'var(--ct-surface-raised)', borderColor: 'var(--ct-border)', color: 'var(--ct-text-1)' }} />
              <button onClick={fetchUrl} disabled={fetching || !url.trim()}
                className="text-label px-3 py-2 rounded-md disabled:opacity-50"
                style={{ background: 'var(--ct-accent-500)', color: '#fff' }}>
                {fetching ? 'Fetching…' : 'Fetch'}
              </button>
            </div>
          )}

          {error && <p className="text-caption" style={{ color: 'var(--ct-fail)' }}>{error}</p>}
        </div>
      )}

      {parsed && (
        <div className="flex flex-col gap-4">
          {/* Spec summary */}
          <div className="rounded-md border p-4 flex items-center justify-between" style={{ borderColor: 'var(--ct-border)', background: 'var(--ct-surface)' }}>
            <div>
              <p className="text-heading" style={{ color: 'var(--ct-text-1)' }}>{parsed.title}</p>
              <p className="text-caption mt-0.5" style={{ color: 'var(--ct-text-3)' }}>
                v{parsed.version} · {parsed.endpoints.length} endpoints
              </p>
            </div>
            <button onClick={() => { setParsed(null); setSelected(new Set()) }}
              className="text-caption" style={{ color: 'var(--ct-text-3)' }}>
              Change spec
            </button>
          </div>

          {/* Endpoint selector */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between mb-1">
              <p className="text-label" style={{ color: 'var(--ct-text-2)' }}>
                Select endpoints to scaffold as test steps ({selected.size} selected)
              </p>
              <div className="flex gap-2">
                <button onClick={() => setSelected(new Set(parsed.endpoints.map(e => `${e.method}:${e.path}`)))}
                  className="text-caption underline" style={{ color: 'var(--ct-accent-400)' }}>All</button>
                <button onClick={() => setSelected(new Set())}
                  className="text-caption underline" style={{ color: 'var(--ct-text-3)' }}>None</button>
              </div>
            </div>
            <div className="rounded-md border overflow-hidden" style={{ borderColor: 'var(--ct-border)' }}>
              {parsed.endpoints.map(ep => {
                const key = `${ep.method}:${ep.path}`
                const isSelected = selected.has(key)
                return (
                  <div key={key}
                    onClick={() => toggleEndpoint(key)}
                    className="flex items-center gap-3 px-3 cursor-pointer"
                    style={{
                      height: 36, borderBottom: '1px solid var(--ct-border)',
                      background: isSelected ? 'rgba(16,185,129,0.05)' : 'var(--ct-surface)',
                    }}
                  >
                    <input type="checkbox" checked={isSelected} readOnly className="flex-shrink-0" />
                    <span className="text-caption font-mono font-bold w-16 flex-shrink-0" style={{ color: METHOD_COLOR[ep.method] ?? 'var(--ct-text-2)' }}>
                      {ep.method}
                    </span>
                    <span className="text-caption font-mono flex-shrink-0 w-48 truncate" style={{ color: 'var(--ct-text-2)' }}>
                      {ep.path}
                    </span>
                    <span className="text-caption truncate" style={{ color: 'var(--ct-text-3)' }}>
                      {ep.summary}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {error && <p className="text-caption" style={{ color: 'var(--ct-fail)' }}>{error}</p>}

          <div className="flex gap-3">
            <button onClick={save} disabled={saving || !projectId}
              className="text-label px-4 py-2 rounded-md disabled:opacity-50"
              style={{ background: 'var(--ct-accent-500)', color: '#fff' }}>
              {saving ? 'Importing…' : `Import${selected.size > 0 ? ` & scaffold ${selected.size} steps` : ' spec only'}`}
            </button>
            <p className="text-caption self-center" style={{ color: 'var(--ct-text-3)' }}>
              Spec is stored against the project. API steps pre-fill method + URL from spec paths.
            </p>
          </div>
        </div>
      )}
      </> /* end openapi mode */}
    </div>
  )
}
