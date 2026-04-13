'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { StepCard, StepConnector } from '@/components/domain/StepCard'
import { StepStatusBadge, type StepStatus } from '@/components/domain/StepStatusBadge'
import { RunSummaryBar } from '@/components/domain/RunSummaryBar'
import { useUiStore } from '@/lib/store/ui'
import { cn } from '@/lib/utils'

type StepDef = {
  id: string
  name: string
  type: 'api' | 'ui' | 'ai'
  position: number
  prerequisites: string[]
  config: Record<string, unknown>
  on_failure: 'stop' | 'continue'
  timeout_ms: number
  outputs: Record<string, string>
}

type Pipeline = {
  id: string
  name: string
  description?: string
  runs_on: string[]
  steps: StepDef[]
}

type StepResult = {
  step_id: string
  status: StepStatus
  duration_ms: number
  assertions: { name: string; passed: boolean }[]
  error_message: string | null
}

type RunState = {
  runId: string
  status: 'pending' | 'running' | 'passed' | 'failed'
  stepResults: Record<string, StepResult>
  passed: number
  failed: number
  skipped: number
  running: number
}

export default function PipelinePage() {
  const { projectId, pipelineId } = useParams<{ projectId: string; pipelineId: string }>()
  const { editingStepId, openStepEditor, closeStepEditor, dagViewEnabled, toggleDagView } = useUiStore()

  const [pipeline, setPipeline] = useState<Pipeline | null>(null)
  const [run, setRun] = useState<RunState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  // Load pipeline
  useEffect(() => {
    setLoading(true)
    fetch(`/api/projects/${projectId}/pipelines/${pipelineId}`)
      .then((r) => r.json())
      .then((d) => { setPipeline((d as { data: Pipeline }).data); setLoading(false) })
      .catch((e) => { setError(String(e)); setLoading(false) })
  }, [projectId, pipelineId])

  // SSE for live run updates
  function subscribeToRun(runId: string) {
    eventSourceRef.current?.close()
    const es = new EventSource(`/api/runs/${runId}/stream`)
    eventSourceRef.current = es

    es.onmessage = (e) => {
      const event = JSON.parse(e.data) as Record<string, unknown>

      if (event.type === 'step_result') {
        setRun((prev) => {
          if (!prev) return prev
          const stepResults = {
            ...prev.stepResults,
            [event.stepId as string]: {
              step_id: event.stepId as string,
              status: event.status as StepStatus,
              duration_ms: event.durationMs as number,
              assertions: event.assertions as { name: string; passed: boolean }[],
              error_message: null,
            },
          }
          const vals = Object.values(stepResults)
          return {
            ...prev,
            stepResults,
            passed:  vals.filter((r) => r.status === 'passed').length,
            failed:  vals.filter((r) => r.status === 'failed').length,
            skipped: vals.filter((r) => r.status === 'skipped').length,
            running: vals.filter((r) => r.status === 'running').length,
          }
        })
      }

      if (event.type === 'run_complete') {
        setRun((prev) => prev ? { ...prev, status: event.status as RunState['status'] } : prev)
        es.close()
      }
    }
  }

  async function triggerRun() {
    const res = await fetch(`/api/projects/${projectId}/pipelines/${pipelineId}/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trigger: 'manual' }),
    })
    const data = await res.json() as { data: { runId: string } }
    const { runId } = data.data
    setRun({ runId, status: 'pending', stepResults: {}, passed: 0, failed: 0, skipped: 0, running: 0 })
    subscribeToRun(runId)
  }

  useEffect(() => () => eventSourceRef.current?.close(), [])

  if (loading) return <div className="p-6 text-body" style={{ color: 'var(--ct-text-2)' }}>Loading pipeline…</div>
  if (error)   return <div className="p-6 text-body" style={{ color: 'var(--ct-fail)' }}>Error: {error}</div>
  if (!pipeline) return null

  const steps = [...pipeline.steps].sort((a, b) => a.position - b.position)
  const totalSteps = steps.length

  return (
    <div className="flex h-full" style={{ background: 'var(--ct-bg)' }}>
      {/* ── Pipeline canvas ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 border-b"
          style={{ height: 'var(--ct-row-h)', borderColor: 'var(--ct-border)', background: 'var(--ct-surface)' }}
        >
          <div className="flex items-center gap-3">
            <span className="text-heading" style={{ color: 'var(--ct-text-1)' }}>{pipeline.name}</span>
            <span className="text-caption px-2 py-0.5 rounded" style={{ background: 'var(--ct-surface-overlay)', color: 'var(--ct-text-3)' }}>
              {totalSteps} steps
            </span>
            {pipeline.runs_on.map((tag) => (
              <span key={tag} className="text-caption px-1.5 py-0.5 rounded border" style={{ borderColor: 'var(--ct-border)', color: 'var(--ct-text-3)' }}>
                {tag}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleDagView}
              className={cn(
                'text-label px-2 py-1 rounded border transition-colors',
                dagViewEnabled
                  ? 'border-[var(--ct-accent-500)] text-[var(--ct-accent-400)]'
                  : 'border-[var(--ct-border)] text-[var(--ct-text-2)]',
              )}
            >
              DAG
            </button>
            <button
              onClick={triggerRun}
              disabled={run?.status === 'running'}
              className="text-label px-3 py-1 rounded font-medium transition-colors disabled:opacity-50"
              style={{ background: 'var(--ct-accent-500)', color: '#fff' }}
            >
              {run?.status === 'running' ? 'Running…' : '▶ Run'}
            </button>
          </div>
        </div>

        {/* Run summary bar */}
        {run && (
          <div className="px-4 py-2 border-b" style={{ borderColor: 'var(--ct-border)', background: 'var(--ct-surface)' }}>
            <RunSummaryBar
              passed={run.passed} failed={run.failed}
              skipped={run.skipped} running={run.running}
              total={totalSteps}
            />
          </div>
        )}

        {/* Steps list — linear view (default) */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col max-w-xl">
            {steps.map((step, i) => {
              const stepResult = run?.stepResults[step.id]
              return (
                <div key={step.id}>
                  <StepCard
                    id={step.id}
                    name={step.name}
                    type={step.type}
                    position={step.position}
                    status={stepResult?.status ?? (run ? 'pending' : undefined)}
                    durationMs={stepResult?.duration_ms}
                    isEditing={editingStepId === step.id}
                    onClick={() => editingStepId === step.id ? closeStepEditor() : openStepEditor(step.id)}
                  />
                  {i < steps.length - 1 && <StepConnector />}
                </div>
              )
            })}

            {/* Add step button */}
            <div className="mt-3">
              <AddStepMenu projectId={projectId} pipelineId={pipelineId} position={totalSteps} onAdded={() => {
                // Reload pipeline
                fetch(`/api/projects/${projectId}/pipelines/${pipelineId}`)
                  .then((r) => r.json())
                  .then((d) => setPipeline((d as { data: Pipeline }).data))
              }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Step editor drawer ── */}
      {editingStepId && (
        <StepEditorDrawer
          step={steps.find((s) => s.id === editingStepId)!}
          projectId={projectId}
          pipelineId={pipelineId}
          onClose={closeStepEditor}
          onSaved={() => {
            fetch(`/api/projects/${projectId}/pipelines/${pipelineId}`)
              .then((r) => r.json())
              .then((d) => setPipeline((d as { data: Pipeline }).data))
          }}
        />
      )}
    </div>
  )
}

// ── Add Step Menu ─────────────────────────────────────────────────────────────

function AddStepMenu({ projectId, pipelineId, position, onAdded }: {
  projectId: string; pipelineId: string; position: number; onAdded: () => void
}) {
  const [open, setOpen] = useState(false)

  async function addStep(type: 'api' | 'ui' | 'ai') {
    const defaultConfig = {
      api: { method: 'GET', url: '', assertions: [] },
      ui:  { actions: [], assertions: [] },
      ai:  { prompt: '', expected_response: '', threshold: 0.8 },
    }
    await fetch(`/api/projects/${projectId}/pipelines/${pipelineId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ steps: [{ name: `New ${type.toUpperCase()} step`, type, position, prerequisites: [], outputs: {}, config: defaultConfig[type], on_failure: 'stop', timeout_ms: 30000 }] }),
    })
    setOpen(false)
    onAdded()
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="text-label px-3 py-1.5 rounded border border-dashed transition-colors w-full text-center"
        style={{ borderColor: 'var(--ct-border)', color: 'var(--ct-text-3)' }}
      >
        + Add step
      </button>
      {open && (
        <div
          className="absolute top-full mt-1 left-0 z-10 rounded-md border overflow-hidden"
          style={{ background: 'var(--ct-surface)', borderColor: 'var(--ct-border)', minWidth: '160px' }}
        >
          {(['api', 'ui', 'ai'] as const).map((type) => (
            <button
              key={type}
              onClick={() => addStep(type)}
              className="w-full text-left px-3 py-2 text-body hover:bg-[var(--ct-surface-raised)] transition-colors"
              style={{ color: 'var(--ct-text-1)' }}
            >
              {type === 'api' ? '⚡ API step' : type === 'ui' ? '🖥 UI step' : '🤖 AI step'}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Step Editor Drawer ────────────────────────────────────────────────────────

function StepEditorDrawer({ step, projectId, pipelineId, onClose, onSaved }: {
  step: StepDef
  projectId: string
  pipelineId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(step.name)
  const [config, setConfig] = useState(JSON.stringify(step.config, null, 2))
  const [onFailure, setOnFailure] = useState(step.on_failure)
  const [saving, setSaving] = useState(false)
  const [configError, setConfigError] = useState<string | null>(null)

  async function save() {
    let parsed: unknown
    try { parsed = JSON.parse(config) } catch { setConfigError('Invalid JSON'); return }
    setConfigError(null)
    setSaving(true)
    await fetch(`/api/projects/${projectId}/pipelines/${pipelineId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ steps: [{ ...step, name, config: parsed, on_failure: onFailure }] }),
    })
    setSaving(false)
    onSaved()
  }

  return (
    <div
      className="w-96 flex-shrink-0 border-l flex flex-col overflow-hidden"
      style={{ borderColor: 'var(--ct-border)', background: 'var(--ct-surface)' }}
    >
      {/* Drawer header */}
      <div
        className="flex items-center justify-between px-4 border-b flex-shrink-0"
        style={{ height: 'var(--ct-row-h)', borderColor: 'var(--ct-border)' }}
      >
        <div className="flex items-center gap-2">
          <StepStatusBadge status="pending" showLabel={false} />
          <span className="text-heading" style={{ color: 'var(--ct-text-1)' }}>
            {step.type.toUpperCase()} Step
          </span>
        </div>
        <button onClick={onClose} className="text-body" style={{ color: 'var(--ct-text-3)' }}>×</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {/* Name */}
        <div className="flex flex-col gap-1">
          <label className="text-label" style={{ color: 'var(--ct-text-2)' }}>Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="text-body px-3 py-2 rounded-md border"
            style={{ background: 'var(--ct-surface-raised)', borderColor: 'var(--ct-border)', color: 'var(--ct-text-1)', outline: 'none' }}
          />
        </div>

        {/* On failure */}
        <div className="flex flex-col gap-1">
          <label className="text-label" style={{ color: 'var(--ct-text-2)' }}>On failure</label>
          <select
            value={onFailure}
            onChange={(e) => setOnFailure(e.target.value as 'stop' | 'continue')}
            className="text-body px-3 py-2 rounded-md border"
            style={{ background: 'var(--ct-surface-raised)', borderColor: 'var(--ct-border)', color: 'var(--ct-text-1)' }}
          >
            <option value="stop">Stop — halt pipeline on failure</option>
            <option value="continue">Continue — run remaining steps</option>
          </select>
        </div>

        {/* Config JSON editor */}
        <div className="flex flex-col gap-1 flex-1">
          <label className="text-label" style={{ color: 'var(--ct-text-2)' }}>
            Config {step.type === 'api' ? '(method, url, headers, assertions)' : step.type === 'ui' ? '(actions, assertions)' : '(prompt, expected, threshold)'}
          </label>
          <textarea
            value={config}
            onChange={(e) => setConfig(e.target.value)}
            spellCheck={false}
            className="flex-1 min-h-[200px] font-mono text-mono px-3 py-2 rounded-md border resize-none"
            style={{
              background: 'var(--ct-surface-raised)', borderColor: configError ? 'var(--ct-fail)' : 'var(--ct-border)',
              color: 'var(--ct-text-1)', outline: 'none',
            }}
          />
          {configError && <span className="text-caption" style={{ color: 'var(--ct-fail)' }}>{configError}</span>}
        </div>
      </div>

      {/* Save */}
      <div className="p-4 border-t flex-shrink-0" style={{ borderColor: 'var(--ct-border)' }}>
        <button
          onClick={save}
          disabled={saving}
          className="w-full text-body font-medium py-2 rounded-md transition-colors disabled:opacity-50"
          style={{ background: 'var(--ct-accent-500)', color: '#fff' }}
        >
          {saving ? 'Saving…' : 'Save step'}
        </button>
      </div>
    </div>
  )
}
