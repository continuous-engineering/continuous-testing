'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { StepCard, StepConnector } from '@/components/domain/StepCard'
import { StepStatusBadge, type StepStatus } from '@/components/domain/StepStatusBadge'
import { RunSummaryBar } from '@/components/domain/RunSummaryBar'
import { useUiStore } from '@/lib/store/ui'

// ── Types ─────────────────────────────────────────────────────────────────────

type StepType = 'api' | 'ui' | 'ai'

type StepDef = {
  id: string; name: string; type: StepType; position: number
  prerequisites: string[]; config: Record<string, unknown>
  on_failure: 'stop' | 'continue'; timeout_ms: number
  outputs: Record<string, string>
}

type Pipeline = {
  id: string; name: string; description?: string
  runs_on: string[]; steps: StepDef[]
}

type StepResult = {
  step_id: string; status: StepStatus; duration_ms: number
  assertions: { name: string; passed: boolean }[]
  error_message: string | null
  response_body: string | null
  response_meta: Record<string, unknown>
}

type RunState = {
  runId: string; status: 'pending' | 'running' | 'passed' | 'failed'
  stepResults: Record<string, StepResult>
  passed: number; failed: number; skipped: number; running: number
}

type SpecSummary = { id: string; name: string; version: string; endpoint_count: number }

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PipelinePage() {
  const { projectId, pipelineId } = useParams<{ projectId: string; pipelineId: string }>()
  const { editingStepId, openStepEditor, closeStepEditor } = useUiStore()

  const [pipeline, setPipeline] = useState<Pipeline | null>(null)
  const [run, setRun]           = useState<RunState | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [specs, setSpecs]       = useState<SpecSummary[]>([])
  const [zenMode, setZenMode]   = useState(false)
  const eventSourceRef          = useRef<EventSource | null>(null)

  const reload = useCallback(() =>
    fetch(`/api/projects/${projectId}/pipelines/${pipelineId}`)
      .then(r => r.json())
      .then((d: { data: Pipeline }) => setPipeline(d.data))
  , [projectId, pipelineId])

  useEffect(() => {
    setLoading(true)
    Promise.all([
      reload(),
      fetch(`/api/projects/${projectId}/specs`).then(r => r.json())
        .then((d: { data: SpecSummary[] }) => setSpecs(d.data ?? [])).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [projectId, pipelineId])

  function subscribeToRun(runId: string) {
    eventSourceRef.current?.close()
    const es = new EventSource(`/api/runs/${runId}/stream`)
    eventSourceRef.current = es
    es.onmessage = (e) => {
      const event = JSON.parse(e.data) as Record<string, unknown>
      if (event.type === 'step_result') {
        setRun(prev => {
          if (!prev) return prev
          const stepResults = { ...prev.stepResults, [event.stepId as string]: {
            step_id:       event.stepId as string,
            status:        event.status as StepStatus,
            duration_ms:   event.durationMs as number,
            assertions:    event.assertions as { name: string; passed: boolean }[],
            error_message: event.errorMessage as string | null ?? null,
            response_body: event.responseBody as string | null ?? null,
            response_meta: event.responseMeta as Record<string, unknown> ?? {},
          }}
          const vals = Object.values(stepResults)
          return { ...prev, stepResults,
            passed:  vals.filter(r => r.status === 'passed').length,
            failed:  vals.filter(r => r.status === 'failed').length,
            skipped: vals.filter(r => r.status === 'skipped').length,
            running: vals.filter(r => r.status === 'running').length,
          }
        })
      }
      if (event.type === 'run_complete') {
        setRun(prev => prev ? { ...prev, status: event.status as RunState['status'] } : prev)
        es.close()
      }
    }
  }

  async function triggerRun() {
    const res  = await fetch(`/api/projects/${projectId}/pipelines/${pipelineId}/runs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trigger: 'manual' }),
    })
    const data = await res.json() as { data: { runId: string } }
    setRun({ runId: data.data.runId, status: 'pending', stepResults: {}, passed: 0, failed: 0, skipped: 0, running: 0 })
    subscribeToRun(data.data.runId)
  }

  async function deleteStep(stepId: string) {
    if (!confirm('Remove this step?')) return
    await fetch(`/api/projects/${projectId}/pipelines/${pipelineId}/steps/${stepId}`, { method: 'DELETE' })
    if (editingStepId === stepId) closeStepEditor()
    reload()
  }

  async function moveStep(stepId: string, direction: 'up' | 'down') {
    if (!pipeline) return
    const steps = [...pipeline.steps].sort((a, b) => a.position - b.position)
    const idx = steps.findIndex(s => s.id === stepId)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    const a = steps[idx]; const b = steps[swapIdx]
    if (!a || !b) return
    await fetch(`/api/projects/${projectId}/pipelines/${pipelineId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ steps: [{ ...a, position: b.position }, { ...b, position: a.position }] }),
    })
    reload()
  }

  useEffect(() => () => eventSourceRef.current?.close(), [])

  if (loading) return <div className="p-6 text-body" style={{ color: 'var(--ct-text-2)' }}>Loading pipeline…</div>
  if (error)   return <div className="p-6 text-body" style={{ color: 'var(--ct-fail)' }}>Error: {error}</div>
  if (!pipeline) return null

  const steps     = [...pipeline.steps].sort((a, b) => a.position - b.position)
  const totalSteps = steps.length
  const editingStep = steps.find(s => s.id === editingStepId)

  return (
    <div className="flex h-full" style={{ background: 'var(--ct-bg)' }}>
      {/* ── Canvas (hides in zen mode) ── */}
      {(!zenMode || !editingStepId) && (
        <div className={editingStepId ? 'w-80 flex-shrink-0 flex flex-col min-w-0 overflow-hidden border-r' : 'flex-1 flex flex-col min-w-0 overflow-hidden'}
          style={{ borderColor: 'var(--ct-border)' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 border-b flex-shrink-0"
            style={{ height: 'var(--ct-row-h)', borderColor: 'var(--ct-border)', background: 'var(--ct-surface)' }}>
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-heading truncate" style={{ color: 'var(--ct-text-1)' }}>{pipeline.name}</span>
              <span className="text-caption px-2 py-0.5 rounded flex-shrink-0" style={{ background: 'var(--ct-surface-overlay)', color: 'var(--ct-text-3)' }}>
                {totalSteps} step{totalSteps !== 1 ? 's' : ''}
              </span>
            </div>
            <button onClick={triggerRun} disabled={run?.status === 'running'}
              className="text-label px-3 py-1 rounded font-medium disabled:opacity-50 flex-shrink-0"
              style={{ background: 'var(--ct-accent-500)', color: '#fff' }}>
              {run?.status === 'running' ? 'Running…' : '▶ Run'}
            </button>
          </div>

          {run && (
            <div className="px-4 py-2 border-b" style={{ borderColor: 'var(--ct-border)', background: 'var(--ct-surface)' }}>
              <RunSummaryBar passed={run.passed} failed={run.failed} skipped={run.skipped} running={run.running} total={totalSteps} />
            </div>
          )}

          {/* Steps */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex flex-col max-w-xl">
              {steps.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-body" style={{ color: 'var(--ct-text-2)' }}>No steps yet.</p>
                  <p className="text-caption mt-1" style={{ color: 'var(--ct-text-3)' }}>Add an API, UI, or AI step below.</p>
                </div>
              )}
              {steps.map((step, i) => {
                const stepResult = run?.stepResults[step.id]
                return (
                  <div key={step.id}>
                    <div className="flex items-center gap-1.5">
                      <div className="flex flex-col gap-0.5 flex-shrink-0">
                        <button onClick={() => moveStep(step.id, 'up')} disabled={i === 0}
                          className="text-caption w-5 h-4 flex items-center justify-center rounded disabled:opacity-20"
                          style={{ color: 'var(--ct-text-3)' }}>▲</button>
                        <button onClick={() => moveStep(step.id, 'down')} disabled={i === steps.length - 1}
                          className="text-caption w-5 h-4 flex items-center justify-center rounded disabled:opacity-20"
                          style={{ color: 'var(--ct-text-3)' }}>▼</button>
                      </div>
                      <div className="flex-1 min-w-0">
                        <StepCard id={step.id} name={step.name} type={step.type} position={step.position}
                          status={stepResult?.status ?? (run ? 'pending' : undefined)}
                          durationMs={stepResult?.duration_ms}
                          isEditing={editingStepId === step.id}
                          onClick={() => editingStepId === step.id ? closeStepEditor() : openStepEditor(step.id)} />
                        {stepResult && <StepOutput result={stepResult} />}
                      </div>
                      <button onClick={() => deleteStep(step.id)}
                        className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-body"
                        style={{ color: 'var(--ct-text-3)' }}>×</button>
                    </div>
                    {i < steps.length - 1 && <div className="ml-7"><StepConnector /></div>}
                  </div>
                )
              })}
              <div className="mt-3 ml-7">
                <AddStepMenu projectId={projectId} pipelineId={pipelineId} position={totalSteps} onAdded={reload} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Step editor (half-screen by default, zen = full screen overlay) ── */}
      {editingStepId && editingStep && (
        <StepEditorDrawer
          step={editingStep}
          projectId={projectId}
          pipelineId={pipelineId}
          specs={specs}
          zenMode={zenMode}
          onToggleZen={() => setZenMode(z => !z)}
          onClose={() => { closeStepEditor(); setZenMode(false) }}
          onSaved={reload}
        />
      )}
    </div>
  )
}

// ── Step Output Panel ─────────────────────────────────────────────────────────

function StepOutput({ result }: { result: StepResult }) {
  const [open, setOpen] = useState(false)
  const hasDetail = result.error_message || result.response_body || result.assertions.length > 0

  if (!hasDetail) return null

  const statusHue = result.status === 'passed' ? 'var(--ct-pass)'
    : result.status === 'failed' ? 'var(--ct-fail)'
    : 'var(--ct-text-3)'

  return (
    <div className="ml-0 mt-0.5 rounded-b-md border-x border-b overflow-hidden"
      style={{ borderColor: 'var(--ct-border)', background: 'var(--ct-surface-raised)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-left hover:bg-[var(--ct-surface-overlay)] transition-colors"
      >
        <div className="flex items-center gap-2">
          {result.error_message && (
            <span className="text-caption" style={{ color: 'var(--ct-fail)' }}>✕ {result.error_message.slice(0, 60)}{result.error_message.length > 60 ? '…' : ''}</span>
          )}
          {!result.error_message && result.assertions.length > 0 && (
            <span className="text-caption" style={{ color: statusHue }}>
              {result.assertions.filter(a => a.passed).length}/{result.assertions.length} assertions passed
            </span>
          )}
          {!result.error_message && result.assertions.length === 0 && result.response_body && (
            <span className="text-caption" style={{ color: 'var(--ct-text-3)' }}>Response received</span>
          )}
        </div>
        <span className="text-caption" style={{ color: 'var(--ct-text-3)' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="flex flex-col gap-3 px-3 pb-3">
          {/* Assertions */}
          {result.assertions.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-caption font-semibold" style={{ color: 'var(--ct-text-2)' }}>Assertions</p>
              {result.assertions.map((a, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span style={{ color: a.passed ? 'var(--ct-pass)' : 'var(--ct-fail)', fontSize: 11 }}>
                    {a.passed ? '✓' : '✕'}
                  </span>
                  <span className="text-caption" style={{ color: a.passed ? 'var(--ct-text-2)' : 'var(--ct-fail)' }}>
                    {a.name}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {result.error_message && (
            <div className="flex flex-col gap-1">
              <p className="text-caption font-semibold" style={{ color: 'var(--ct-fail)' }}>Error</p>
              <pre className="text-caption font-mono p-2 rounded overflow-x-auto whitespace-pre-wrap break-all"
                style={{ background: 'rgba(239,68,68,0.08)', color: 'var(--ct-fail)', maxHeight: 120 }}>
                {result.error_message}
              </pre>
            </div>
          )}

          {/* Response body */}
          {result.response_body && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <p className="text-caption font-semibold" style={{ color: 'var(--ct-text-2)' }}>
                  Response
                  {result.response_meta?.status != null && (
                    <span className="ml-2 font-mono" style={{ color: 'var(--ct-accent-400)' }}>
                      {String(result.response_meta.status)}
                    </span>
                  )}
                </p>
              </div>
              <pre className="text-caption font-mono p-2 rounded overflow-x-auto whitespace-pre-wrap break-all"
                style={{ background: 'var(--ct-surface-overlay)', color: 'var(--ct-text-1)', maxHeight: 200, fontSize: 11 }}>
                {(() => {
                  try { return JSON.stringify(JSON.parse(result.response_body!), null, 2) }
                  catch { return result.response_body }
                })()}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Add Step Menu ─────────────────────────────────────────────────────────────

function AddStepMenu({ projectId, pipelineId, position, onAdded }: {
  projectId: string; pipelineId: string; position: number; onAdded: () => void
}) {
  const [open, setOpen] = useState(false)

  async function addStep(type: StepType) {
    const defaultConfig = {
      api: { method: 'GET', url: '', headers: {}, assertions: [] },
      ui:  { browser: 'chromium', actions: [], assertions: [] },
      ai:  { prompt: '', expected_response: '', threshold: 0.8 },
    }
    await fetch(`/api/projects/${projectId}/pipelines/${pipelineId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ steps: [{ name: `New ${type.toUpperCase()} step`, type, position,
        prerequisites: [], outputs: {}, config: defaultConfig[type], on_failure: 'stop', timeout_ms: 30000 }] }),
    })
    setOpen(false); onAdded()
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="text-label px-3 py-1.5 rounded border border-dashed transition-colors w-full text-center"
        style={{ borderColor: 'var(--ct-border)', color: 'var(--ct-text-3)' }}>
        + Add step
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 z-10 rounded-md border overflow-hidden"
          style={{ background: 'var(--ct-surface)', borderColor: 'var(--ct-border)', minWidth: '200px' }}>
          {[
            { type: 'api' as const, icon: '⚡', label: 'API step', desc: 'HTTP request + assertions' },
            { type: 'ui'  as const, icon: '🖥', label: 'UI step',  desc: 'Browser actions + checks' },
            { type: 'ai'  as const, icon: '🤖', label: 'AI step',  desc: 'Claude semantic test' },
          ].map(({ type, icon, label, desc }) => (
            <button key={type} onClick={() => addStep(type)}
              className="w-full text-left px-3 py-2.5 hover:bg-[var(--ct-surface-raised)] transition-colors flex flex-col"
              style={{ color: 'var(--ct-text-1)' }}>
              <span className="text-body">{icon} {label}</span>
              <span className="text-caption" style={{ color: 'var(--ct-text-3)' }}>{desc}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Step Editor Drawer ────────────────────────────────────────────────────────

function StepEditorDrawer({ step, projectId, pipelineId, specs, zenMode, onToggleZen, onClose, onSaved }: {
  step: StepDef; projectId: string; pipelineId: string
  specs: SpecSummary[]; zenMode: boolean
  onToggleZen: () => void; onClose: () => void; onSaved: () => void
}) {
  const [name, setName]           = useState(step.name)
  const [onFailure, setOnFailure] = useState(step.on_failure)
  const [config, setConfig]       = useState<Record<string, unknown>>(step.config)
  const [saving, setSaving]       = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    setName(step.name); setOnFailure(step.on_failure)
    setConfig(step.config); setSaveError(null)
  }, [step.id])

  async function save() {
    setSaving(true); setSaveError(null)
    const res = await fetch(`/api/projects/${projectId}/pipelines/${pipelineId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ steps: [{ ...step, name, config, on_failure: onFailure }] }),
    })
    setSaving(false)
    if (!res.ok) {
      const d = await res.json() as { error?: string }
      setSaveError(d.error ?? 'Save failed'); return
    }
    onSaved()
  }

  const drawerStyle: React.CSSProperties = zenMode
    ? { position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column',
        background: 'var(--ct-bg)', borderLeft: 'none' }
    : { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        borderLeft: '1px solid var(--ct-border)', background: 'var(--ct-surface)' }

  return (
    <div style={drawerStyle}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 border-b flex-shrink-0"
        style={{ height: 'var(--ct-row-h)', borderColor: 'var(--ct-border)', background: 'var(--ct-surface)' }}>
        <div className="flex items-center gap-3">
          <StepStatusBadge status="pending" showLabel={false} />
          <span className="text-heading" style={{ color: 'var(--ct-text-1)' }}>
            {step.type.toUpperCase()} Step
          </span>
          <span className="text-caption px-2 py-0.5 rounded" style={{ background: 'var(--ct-surface-overlay)', color: 'var(--ct-text-3)' }}>
            {step.type === 'api' ? '⚡ API' : step.type === 'ui' ? '🖥 UI' : '🤖 AI'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onToggleZen}
            className="text-caption px-2 py-1 rounded border transition-colors"
            style={{ borderColor: 'var(--ct-border)', color: zenMode ? 'var(--ct-accent-400)' : 'var(--ct-text-3)' }}
            title={zenMode ? 'Exit zen mode' : 'Zen mode — full screen editor'}>
            {zenMode ? '⊠ Exit zen' : '⊡ Zen'}
          </button>
          <button onClick={onClose} className="text-body w-7 h-7 flex items-center justify-center rounded"
            style={{ color: 'var(--ct-text-3)' }}>✕</button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
        {/* Name */}
        <Field label="Step name">
          <input value={name} onChange={e => setName(e.target.value)}
            className="text-body px-3 py-2 rounded-md border w-full"
            style={{ background: 'var(--ct-surface-raised)', borderColor: 'var(--ct-border)', color: 'var(--ct-text-1)', outline: 'none' }} />
        </Field>

        {/* On failure */}
        <Field label="On failure">
          <select value={onFailure} onChange={e => setOnFailure(e.target.value as 'stop' | 'continue')}
            className="text-body px-3 py-2 rounded-md border"
            style={{ background: 'var(--ct-surface-raised)', borderColor: 'var(--ct-border)', color: 'var(--ct-text-1)' }}>
            <option value="stop">Stop pipeline — halt all remaining steps</option>
            <option value="continue">Continue — run remaining steps regardless</option>
          </select>
        </Field>

        <hr style={{ borderColor: 'var(--ct-border)' }} />

        {/* Type-specific config forms */}
        {step.type === 'api' && (
          <ApiConfigForm config={config} onChange={setConfig} specs={specs} projectId={projectId} />
        )}
        {step.type === 'ai' && (
          <AiConfigForm config={config} onChange={setConfig} />
        )}
        {step.type === 'ui' && (
          <UiConfigForm config={config} onChange={setConfig} />
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t flex-shrink-0 flex items-center gap-3" style={{ borderColor: 'var(--ct-border)', background: 'var(--ct-surface)' }}>
        <button onClick={save} disabled={saving}
          className="text-body font-medium px-4 py-2 rounded-md transition-colors disabled:opacity-50"
          style={{ background: 'var(--ct-accent-500)', color: '#fff' }}>
          {saving ? 'Saving…' : 'Save step'}
        </button>
        {saveError && <span className="text-caption" style={{ color: 'var(--ct-fail)' }}>{saveError}</span>}
      </div>
    </div>
  )
}

// ── Field wrapper ─────────────────────────────────────────────────────────────

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

// ── API config form ───────────────────────────────────────────────────────────

const HTTP_METHODS = ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS']
const METHOD_COLOR: Record<string, string> = {
  GET: 'var(--ct-pass)', POST: 'var(--ct-accent-500)', PUT: 'var(--ct-flaky)',
  PATCH: 'var(--ct-flaky)', DELETE: 'var(--ct-fail)',
}

type ApiConfig = { method: string; url: string; headers: Record<string,string>; body?: unknown; assertions: Assertion[] }
type Assertion = { type: string; target?: string; operator: string; expected: string | number | boolean }

function ApiConfigForm({ config, onChange, specs, projectId }: {
  config: Record<string, unknown>
  onChange: (c: Record<string, unknown>) => void
  specs: SpecSummary[]
  projectId: string
}) {
  const c      = config as Partial<ApiConfig>
  const method = (c.method ?? 'GET') as string
  const url    = (c.url ?? '') as string
  const headers = (c.headers ?? {}) as Record<string,string>
  const assertions = (c.assertions ?? []) as Assertion[]

  // Spec endpoint picker
  const [specEndpoints, setSpecEndpoints] = useState<{ method: string; path: string; summary: string }[]>([])
  const [loadingSpec, setLoadingSpec]     = useState(false)
  const [selectedSpec, setSelectedSpec]   = useState('')

  async function loadSpec(specId: string) {
    if (!specId) { setSpecEndpoints([]); return }
    setLoadingSpec(true)
    const res = await fetch(`/api/projects/${projectId}/specs/${specId}`)
    const d   = await res.json() as { data: { spec_json: Record<string,unknown> } }
    const paths = (d.data.spec_json.paths ?? {}) as Record<string, Record<string, Record<string,unknown>>>
    const eps: typeof specEndpoints = []
    for (const [path, item] of Object.entries(paths)) {
      for (const m of ['get','post','put','patch','delete','head','options']) {
        const op = item[m]; if (!op) continue
        eps.push({ method: m.toUpperCase(), path, summary: (op.summary as string) || `${m.toUpperCase()} ${path}` })
      }
    }
    setSpecEndpoints(eps); setLoadingSpec(false)
  }

  function applyEndpoint(ep: typeof specEndpoints[number]) {
    onChange({ ...config, method: ep.method, url: ep.path })
  }

  function update(partial: Partial<ApiConfig>) {
    onChange({ ...config, ...partial })
  }

  function addHeader() {
    update({ headers: { ...headers, '': '' } })
  }
  function setHeader(oldKey: string, newKey: string, value: string) {
    const next = Object.fromEntries(Object.entries(headers).map(([k, v]) => k === oldKey ? [newKey, value] : [k, v]))
    update({ headers: next })
  }
  function removeHeader(key: string) {
    const next = { ...headers }; delete next[key]; update({ headers: next })
  }
  function addAssertion() {
    update({ assertions: [...assertions, { type: 'status', operator: 'lt', expected: 400 }] })
  }
  function updateAssertion(i: number, partial: Partial<Assertion>) {
    update({ assertions: assertions.map((a, idx) => idx === i ? { ...a, ...partial } : a) })
  }
  function removeAssertion(i: number) {
    update({ assertions: assertions.filter((_, idx) => idx !== i) })
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--ct-surface-raised)', borderColor: 'var(--ct-border)',
    color: 'var(--ct-text-1)', outline: 'none',
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Spec endpoint picker */}
      {specs.length > 0 && (
        <div className="rounded-md border p-3 flex flex-col gap-2"
          style={{ borderColor: 'var(--ct-border)', background: 'rgba(16,185,129,0.04)' }}>
          <p className="text-label" style={{ color: 'var(--ct-accent-400)' }}>
            ✦ Pick from imported spec
          </p>
          <div className="flex gap-2">
            <select value={selectedSpec} onChange={e => { setSelectedSpec(e.target.value); loadSpec(e.target.value) }}
              className="text-body px-2 py-1.5 rounded-md border flex-1"
              style={{ ...inputStyle }}>
              <option value="">— choose a spec —</option>
              {specs.map(s => <option key={s.id} value={s.id}>{s.name} ({s.endpoint_count} endpoints)</option>)}
            </select>
          </div>
          {loadingSpec && <p className="text-caption" style={{ color: 'var(--ct-text-3)' }}>Loading endpoints…</p>}
          {specEndpoints.length > 0 && (
            <div className="max-h-36 overflow-y-auto rounded-md border" style={{ borderColor: 'var(--ct-border)' }}>
              {specEndpoints.map(ep => (
                <button key={`${ep.method}:${ep.path}`}
                  onClick={() => applyEndpoint(ep)}
                  className="w-full text-left flex items-center gap-2 px-2 py-1.5 hover:bg-[var(--ct-surface-raised)] transition-colors"
                  style={{ borderBottom: '1px solid var(--ct-border)' }}>
                  <span className="text-caption font-mono font-bold w-14 flex-shrink-0"
                    style={{ color: METHOD_COLOR[ep.method] ?? 'var(--ct-text-2)' }}>{ep.method}</span>
                  <span className="text-caption font-mono flex-shrink-0 w-44 truncate" style={{ color: 'var(--ct-text-2)' }}>{ep.path}</span>
                  <span className="text-caption truncate" style={{ color: 'var(--ct-text-3)' }}>{ep.summary}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Method + URL */}
      <Field label="Request">
        <div className="flex gap-2">
          <select value={method} onChange={e => update({ method: e.target.value })}
            className="text-body px-2 py-2 rounded-md border font-mono font-bold w-28 flex-shrink-0"
            style={{ ...inputStyle, color: METHOD_COLOR[method] ?? 'var(--ct-text-1)' }}>
            {HTTP_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <input value={url} onChange={e => update({ url: e.target.value })}
            placeholder="https://api.example.com/endpoint"
            className="text-body px-3 py-2 rounded-md border flex-1 font-mono text-sm"
            style={{ ...inputStyle }} />
        </div>
      </Field>

      {/* Headers */}
      <Field label="Headers" hint="(optional)">
        <div className="flex flex-col gap-1">
          {Object.entries(headers).map(([k, v]) => (
            <div key={k} className="flex gap-1.5 items-center">
              <input value={k} onChange={e => setHeader(k, e.target.value, v)}
                placeholder="Header-Name" className="text-body px-2 py-1.5 rounded-md border w-36 flex-shrink-0 font-mono text-sm"
                style={{ ...inputStyle }} />
              <input value={v} onChange={e => setHeader(k, k, e.target.value)}
                placeholder="value" className="text-body px-2 py-1.5 rounded-md border flex-1 font-mono text-sm"
                style={{ ...inputStyle }} />
              <button onClick={() => removeHeader(k)} className="text-body flex-shrink-0 w-6 text-center"
                style={{ color: 'var(--ct-text-3)' }}>×</button>
            </div>
          ))}
          <button onClick={addHeader} className="text-caption self-start mt-0.5"
            style={{ color: 'var(--ct-accent-400)' }}>+ Add header</button>
        </div>
      </Field>

      {/* Body */}
      {['POST','PUT','PATCH'].includes(method) && (
        <Field label="Request body" hint="JSON">
          <textarea
            value={typeof c.body === 'string' ? c.body : c.body ? JSON.stringify(c.body, null, 2) : ''}
            onChange={e => { try { update({ body: JSON.parse(e.target.value) }) } catch { update({ body: e.target.value }) } }}
            placeholder={'{\n  "key": "value"\n}'}
            rows={5}
            className="font-mono text-sm px-3 py-2 rounded-md border resize-none w-full"
            style={{ ...inputStyle }}
          />
        </Field>
      )}

      {/* Assertions */}
      <Field label="Assertions" hint="checks on the response">
        <div className="flex flex-col gap-2">
          {assertions.map((a, i) => (
            <div key={i} className="flex gap-1.5 items-center flex-wrap">
              <select value={a.type} onChange={e => updateAssertion(i, { type: e.target.value })}
                className="text-body px-2 py-1.5 rounded-md border flex-shrink-0"
                style={{ ...inputStyle, width: 100 }}>
                <option value="status">Status</option>
                <option value="header">Header</option>
                <option value="jsonpath">JSONPath</option>
                <option value="latency">Latency ms</option>
                <option value="regex">Regex</option>
              </select>
              {['header','jsonpath','regex'].includes(a.type) && (
                <input value={a.target ?? ''} onChange={e => updateAssertion(i, { target: e.target.value })}
                  placeholder={a.type === 'header' ? 'Content-Type' : a.type === 'jsonpath' ? '$.data.id' : 'pattern'}
                  className="text-body px-2 py-1.5 rounded-md border font-mono text-sm"
                  style={{ ...inputStyle, width: 120 }} />
              )}
              <select value={a.operator} onChange={e => updateAssertion(i, { operator: e.target.value })}
                className="text-body px-2 py-1.5 rounded-md border flex-shrink-0"
                style={{ ...inputStyle, width: 80 }}>
                <option value="eq">eq</option>
                <option value="ne">ne</option>
                <option value="lt">lt</option>
                <option value="gt">gt</option>
                <option value="lte">lte</option>
                <option value="gte">gte</option>
                <option value="contains">contains</option>
                <option value="matches">matches</option>
              </select>
              <input value={String(a.expected)} onChange={e => {
                const v = e.target.value; const n = Number(v)
                updateAssertion(i, { expected: !isNaN(n) && v !== '' ? n : v })
              }}
                placeholder="expected value" className="text-body px-2 py-1.5 rounded-md border flex-1 min-w-20"
                style={{ ...inputStyle }} />
              <button onClick={() => removeAssertion(i)} className="text-body w-6 text-center flex-shrink-0"
                style={{ color: 'var(--ct-text-3)' }}>×</button>
            </div>
          ))}
          <button onClick={addAssertion} className="text-caption self-start"
            style={{ color: 'var(--ct-accent-400)' }}>+ Add assertion</button>
        </div>
      </Field>
    </div>
  )
}

// ── AI config form ────────────────────────────────────────────────────────────

function AiConfigForm({ config, onChange }: { config: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  const prompt   = (config.prompt ?? '') as string
  const expected = (config.expected_response ?? '') as string
  const threshold = (config.threshold ?? 0.8) as number
  const agentUrl = (config.agent_url ?? '') as string

  const inputStyle: React.CSSProperties = {
    background: 'var(--ct-surface-raised)', borderColor: 'var(--ct-border)',
    color: 'var(--ct-text-1)', outline: 'none',
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-md border p-3" style={{ borderColor: 'var(--ct-border)', background: 'rgba(16,185,129,0.04)' }}>
        <p className="text-caption" style={{ color: 'var(--ct-text-3)' }}>
          🤖 An AI step sends a prompt to your agent/service and uses Claude to semantically score the response
          against what you expect. Threshold controls how closely the response must match.
        </p>
      </div>

      <Field label="Prompt" hint="sent to your AI agent">
        <textarea value={prompt} onChange={e => onChange({ ...config, prompt: e.target.value })}
          placeholder="Ask the support chatbot: 'What is your refund policy?' Expect a clear description of the 30-day return window."
          rows={4}
          className="text-body px-3 py-2 rounded-md border resize-none w-full"
          style={{ ...inputStyle }} />
      </Field>

      <Field label="Expected response" hint="what should the response contain?">
        <textarea value={expected} onChange={e => onChange({ ...config, expected_response: e.target.value })}
          placeholder="The response should mention 30 days, full refund, and how to initiate a return."
          rows={3}
          className="text-body px-3 py-2 rounded-md border resize-none w-full"
          style={{ ...inputStyle }} />
      </Field>

      <Field label={`Similarity threshold — ${Math.round(threshold * 100)}%`}
        hint={threshold >= 0.9 ? '(strict)' : threshold >= 0.7 ? '(balanced)' : '(lenient)'}>
        <div className="flex items-center gap-3">
          <input type="range" min={0} max={1} step={0.05} value={threshold}
            onChange={e => onChange({ ...config, threshold: parseFloat(e.target.value) })}
            className="flex-1" />
          <span className="text-body font-mono w-10 text-right" style={{ color: 'var(--ct-text-2)' }}>
            {Math.round(threshold * 100)}%
          </span>
        </div>
        <p className="text-caption" style={{ color: 'var(--ct-text-3)' }}>
          {threshold >= 0.9 ? 'Response must closely match the expected text.'
            : threshold >= 0.7 ? 'Response should mostly align with expected.'
            : 'Response needs to roughly match — good for creative content.'}
        </p>
      </Field>

      <Field label="Agent URL" hint="optional — overrides default agent endpoint">
        <input value={agentUrl} onChange={e => onChange({ ...config, agent_url: e.target.value || undefined })}
          placeholder="https://your-chatbot.example.com/api/chat"
          className="text-body px-3 py-2 rounded-md border w-full font-mono text-sm"
          style={{ ...inputStyle }} />
      </Field>
    </div>
  )
}

// ── UI config form ────────────────────────────────────────────────────────────

function UiConfigForm({ config, onChange }: { config: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  type Action = { type: string; selector?: string; value?: string; url?: string; intent?: string }
  const browser = (config.browser ?? 'chromium') as string
  const actions = (config.actions ?? []) as Action[]

  const inputStyle: React.CSSProperties = {
    background: 'var(--ct-surface-raised)', borderColor: 'var(--ct-border)',
    color: 'var(--ct-text-1)', outline: 'none',
  }

  function addAction() {
    onChange({ ...config, actions: [...actions, { type: 'navigate', url: '' }] })
  }
  function updateAction(i: number, partial: Partial<Action>) {
    onChange({ ...config, actions: actions.map((a, idx) => idx === i ? { ...a, ...partial } : a) })
  }
  function removeAction(i: number) {
    onChange({ ...config, actions: actions.filter((_, idx) => idx !== i) })
  }

  return (
    <div className="flex flex-col gap-5">
      <Field label="Browser">
        <select value={browser} onChange={e => onChange({ ...config, browser: e.target.value })}
          className="text-body px-3 py-2 rounded-md border"
          style={{ ...inputStyle, width: 160 }}>
          <option value="chromium">Chromium</option>
          <option value="firefox">Firefox</option>
          <option value="webkit">WebKit (Safari)</option>
        </select>
      </Field>

      <Field label="Actions">
        <div className="flex flex-col gap-2">
          {actions.map((a, i) => (
            <div key={i} className="rounded-md border p-3 flex flex-col gap-2" style={{ borderColor: 'var(--ct-border)' }}>
              <div className="flex items-center gap-2">
                <select value={a.type} onChange={e => updateAction(i, { type: e.target.value })}
                  className="text-body px-2 py-1.5 rounded-md border"
                  style={{ ...inputStyle, width: 110 }}>
                  <option value="navigate">Navigate</option>
                  <option value="click">Click</option>
                  <option value="fill">Fill</option>
                  <option value="select">Select</option>
                  <option value="wait">Wait</option>
                  <option value="assert">Assert</option>
                  <option value="screenshot">Screenshot</option>
                </select>
                <button onClick={() => removeAction(i)} className="ml-auto text-body"
                  style={{ color: 'var(--ct-text-3)' }}>×</button>
              </div>
              {a.type === 'navigate' && (
                <input value={a.url ?? ''} onChange={e => updateAction(i, { url: e.target.value })}
                  placeholder="https://example.com/page" className="text-body px-2 py-1.5 rounded-md border font-mono text-sm"
                  style={{ ...inputStyle }} />
              )}
              {['click','fill','select','assert'].includes(a.type) && (
                <input value={a.selector ?? ''} onChange={e => updateAction(i, { selector: e.target.value })}
                  placeholder='[data-testid="submit-btn"] or aria-label or text'
                  className="text-body px-2 py-1.5 rounded-md border font-mono text-sm"
                  style={{ ...inputStyle }} />
              )}
              {['fill','select'].includes(a.type) && (
                <input value={a.value ?? ''} onChange={e => updateAction(i, { value: e.target.value })}
                  placeholder="value to type / select"
                  className="text-body px-2 py-1.5 rounded-md border text-sm"
                  style={{ ...inputStyle }} />
              )}
              <input value={a.intent ?? ''} onChange={e => updateAction(i, { intent: e.target.value || undefined })}
                placeholder="Describe intent for self-healing (optional)"
                className="text-body px-2 py-1.5 rounded-md border text-sm"
                style={{ ...inputStyle }} />
            </div>
          ))}
          <button onClick={addAction} className="text-caption self-start"
            style={{ color: 'var(--ct-accent-400)' }}>+ Add action</button>
        </div>
      </Field>
    </div>
  )
}
