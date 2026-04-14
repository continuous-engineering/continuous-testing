'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useProjectPicker } from '@/lib/hooks/useProjectPicker'
import { bookmarkletSource } from '@/lib/bookmarklet'

type ActionType = 'navigate' | 'click' | 'fill' | 'select' | 'assert' | 'screenshot'

type RecordedAction = {
  type:      ActionType
  url?:      string
  selector?: string
  value?:    string
  intent?:   string
}

const ACTION_ICON: Record<ActionType, string> = {
  navigate:   '↗',
  click:      '◉',
  fill:       '✎',
  select:     '⊟',
  assert:     '✓',
  screenshot: '📷',
}

const ACTION_COLOR: Record<ActionType, string> = {
  navigate:   'var(--ct-accent-400)',
  click:      'var(--ct-text-2)',
  fill:       'var(--ct-flaky)',
  select:     'var(--ct-text-2)',
  assert:     'var(--ct-pass)',
  screenshot: 'var(--ct-text-3)',
}

export default function RecordPage() {
  const router = useRouter()
  const { projectId, setProjectId, projects, loading: projectsLoading } = useProjectPicker()

  const [targetUrl,    setTargetUrl]    = useState('https://')
  const [sessionId,    setSessionId]    = useState<string | null>(null)
  const [token,        setToken]        = useState('')
  const [actions,      setActions]      = useState<RecordedAction[]>([])
  const [status,       setStatus]       = useState<'idle' | 'opening' | 'recording' | 'saved'>('idle')
  const [recWindow,    setRecWindow]    = useState<Window | null>(null)
  const [importing,    setImporting]    = useState(false)
  const [pipelineName, setPipelineName] = useState('')

  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const stepsRef = useRef<RecordedAction[]>([])

  // Keep ref in sync for use in event listener
  stepsRef.current = actions

  // ── Create session ──────────────────────────────────────────────────
  async function startSession() {
    const res = await fetch('/api/record', { method: 'POST' })
    const d   = await res.json() as { data: { sessionId: string; token: string } }
    setSessionId(d.data.sessionId)
    setToken(d.data.token)
    return d.data
  }

  // ── Open target site ───────────────────────────────────────────────
  async function openSite() {
    setStatus('opening')
    const { sessionId: sid, token: tok } = await startSession()

    // Open the target site in a new window
    const win = window.open(targetUrl, 'ct_recorder', 'width=1280,height=800,menubar=yes,toolbar=yes')
    if (!win) {
      alert('Popup blocked. Please allow popups for this page.')
      setStatus('idle')
      return
    }
    setRecWindow(win)
    setStatus('recording')
    setPipelineName('Recording from ' + new URL(targetUrl).hostname)

    // Listen for postMessage from the bookmarklet
    function onMessage(e: MessageEvent) {
      // Only accept from our known base (for standalone mode this would be '*', but
      // window.open gives us the opener relationship — we accept any message with _ct flag)
      if (!e.data?._ct) return

      if (e.data.action) {
        // Individual action streamed in real-time
        setActions(prev => [...prev, e.data.action as RecordedAction])
      }

      if (e.data.done && e.data.steps) {
        // Final save from bookmarklet
        setActions(e.data.steps as RecordedAction[])
        setStatus('saved')
        cleanup()
      }
    }
    window.addEventListener('message', onMessage)

    // Also poll the server as a fallback (catches HTTP-mode saves)
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`/api/record/${sid}`)
        const d = await r.json() as { data?: { status: string; actions: RecordedAction[] } }
        if (d.data?.status === 'saved') {
          setActions(d.data.actions)
          setStatus('saved')
          cleanup()
        }
      } catch {}
    }, 3000)

    function cleanup() {
      window.removeEventListener('message', onMessage)
      if (pollRef.current) clearInterval(pollRef.current)
    }

    // Cleanup if window is closed manually
    const winCheckTimer = setInterval(() => {
      if (win.closed) {
        clearInterval(winCheckTimer)
        if (status === 'recording') setStatus('saved')
        cleanup()
      }
    }, 1000)
  }

  // ── Stop recording ─────────────────────────────────────────────────
  function stopRecording() {
    // Signal the bookmarklet to stop via postMessage
    try { recWindow?.postMessage({ _ct_cmd: 'stop' }, '*') }
    catch {}
    // If bookmarklet didn't respond in 1s, mark as saved anyway
    setTimeout(() => { if (status === 'recording') setStatus('saved') }, 800)
  }

  // ── Delete action ──────────────────────────────────────────────────
  function deleteAction(i: number) {
    setActions(a => a.filter((_, idx) => idx !== i))
  }

  // ── Convert to pipeline ────────────────────────────────────────────
  async function importAsPipeline() {
    if (!projectId || actions.length === 0) return
    setImporting(true)

    // Convert recorded actions → a single UI step
    const stepConfig = {
      browser: 'chromium',
      actions: actions.map(a => ({
        type:     a.type,
        url:      a.url,
        selector: a.selector,
        value:    a.value,
        intent:   a.intent,
      })),
      assertions: [],
    }

    // Create pipeline + step
    const pp = await fetch(`/api/projects/${projectId}/pipelines`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: pipelineName || 'Recorded flow', runs_on: ['hosted'] }),
    }).then(r => r.json()) as { data: { id: string } }

    await fetch(`/api/projects/${projectId}/pipelines/${pp.data.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ steps: [{
        name: 'Recorded UI flow', type: 'ui', position: 0,
        prerequisites: [], outputs: {},
        config: stepConfig, on_failure: 'stop', timeout_ms: 120_000,
      }]}),
    })

    router.push(`/projects/${projectId}/pipelines/${pp.data.id}`)
  }

  const bookmarkletUrl = sessionId && token
    ? 'javascript:' + encodeURIComponent(bookmarkletSource(sessionId, token, window.location.origin))
    : '#'

  return (
    <div className="p-6 flex flex-col gap-6 max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-title" style={{ color: 'var(--ct-text-1)' }}>Record</h1>
          <p className="text-body mt-1" style={{ color: 'var(--ct-text-2)' }}>
            Browse your app while we capture every action. Actions become UI test steps.
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

      {/* ── How it works ── */}
      {status === 'idle' && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { step: '1', title: 'Enter URL', desc: 'Type the page you want to test' },
            { step: '2', title: 'Browse normally', desc: 'We open it in a new window and record your clicks, fills, and navigation' },
            { step: '3', title: 'Import', desc: 'Review the captured steps, name the pipeline, save it' },
          ].map(({ step, title, desc }) => (
            <div key={step} className="rounded-md border p-4"
              style={{ borderColor: 'var(--ct-border)', background: 'var(--ct-surface)' }}>
              <div className="text-title font-bold mb-1" style={{ color: 'var(--ct-accent-400)' }}>{step}</div>
              <div className="text-body font-medium mb-0.5" style={{ color: 'var(--ct-text-1)' }}>{title}</div>
              <div className="text-caption" style={{ color: 'var(--ct-text-3)' }}>{desc}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── URL input + Start ── */}
      {status === 'idle' && (
        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            <input
              value={targetUrl}
              onChange={e => setTargetUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && openSite()}
              placeholder="https://your-app.com"
              className="text-body px-3 py-2 rounded-md border flex-1 font-mono"
              style={{ background: 'var(--ct-surface-raised)', borderColor: 'var(--ct-border)', color: 'var(--ct-text-1)', outline: 'none' }}
            />
            <button onClick={openSite} disabled={!targetUrl.startsWith('http')}
              className="text-label px-4 py-2 rounded-md font-medium disabled:opacity-50"
              style={{ background: 'var(--ct-accent-500)', color: '#fff' }}>
              Open & Record
            </button>
          </div>
          <p className="text-caption" style={{ color: 'var(--ct-text-3)' }}>
            A new browser window opens on that URL. Then click the bookmarklet to activate recording.
            Allow popups for this page if blocked.
          </p>
        </div>
      )}

      {/* ── Recording in progress ── */}
      {status === 'recording' && (
        <div className="rounded-md border p-5 flex flex-col gap-4"
          style={{ borderColor: 'var(--ct-accent-500)', background: 'rgba(16,185,129,0.05)' }}>
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--ct-fail)] animate-pulse flex-shrink-0" />
            <span className="text-heading font-semibold" style={{ color: 'var(--ct-text-1)' }}>Recording</span>
            <span className="text-caption" style={{ color: 'var(--ct-text-3)' }}>{actions.length} actions captured</span>
            <button onClick={stopRecording}
              className="text-label px-3 py-1 rounded-md border ml-auto"
              style={{ borderColor: 'var(--ct-border)', color: 'var(--ct-text-2)' }}>
              Stop
            </button>
          </div>

          {/* Bookmarklet install */}
          <div className="rounded-md border p-4 flex flex-col gap-2"
            style={{ borderColor: 'var(--ct-border)', background: 'var(--ct-surface)' }}>
            <p className="text-label" style={{ color: 'var(--ct-text-1)' }}>
              Step 2 — Activate the recorder in the opened window
            </p>
            <p className="text-caption" style={{ color: 'var(--ct-text-2)' }}>
              Drag this button to your browser&apos;s bookmarks bar, then click it in the window that just opened:
            </p>
            <div className="flex items-center gap-3">
              {/* Draggable bookmarklet anchor */}
              <a
                href={bookmarkletUrl}
                draggable
                onClick={e => e.preventDefault()}
                className="text-label px-4 py-2 rounded-md border text-center cursor-grab select-none"
                style={{ borderColor: 'var(--ct-accent-500)', color: 'var(--ct-accent-400)',
                  background: 'rgba(16,185,129,0.1)', textDecoration: 'none', whiteSpace: 'nowrap' }}
              >
                CT — Record
              </a>
              <p className="text-caption" style={{ color: 'var(--ct-text-3)' }}>
                ← drag this to your bookmarks bar, then click it in the recording window
              </p>
            </div>
            <div className="rounded-md p-3 flex items-center gap-2 mt-1"
              style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <span style={{ fontSize: 11, color: 'var(--ct-accent-400)' }}>↑ Real-time sync</span>
              <span className="text-caption" style={{ color: 'var(--ct-text-3)' }}>
                Actions stream live here via <code>window.opener.postMessage</code> — no HTTP round-trips, no CORS.
              </span>
            </div>
          </div>

          {/* Live action feed */}
          {actions.length > 0 && (
            <div className="rounded-md border overflow-hidden" style={{ borderColor: 'var(--ct-border)' }}>
              <div className="px-3 py-2 border-b text-label" style={{ borderColor: 'var(--ct-border)', color: 'var(--ct-text-2)', background: 'var(--ct-surface)' }}>
                Live actions
              </div>
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {actions.map((a, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 border-b"
                    style={{ height: 36, borderColor: 'var(--ct-border)', background: 'var(--ct-surface)' }}>
                    <span className="text-caption font-mono w-5 text-center flex-shrink-0"
                      style={{ color: ACTION_COLOR[a.type] }}>{ACTION_ICON[a.type]}</span>
                    <span className="text-body flex-1 truncate" style={{ color: 'var(--ct-text-1)' }}>
                      {a.intent || a.type}
                    </span>
                    {a.selector && (
                      <code className="text-caption flex-shrink-0 max-w-32 truncate"
                        style={{ color: 'var(--ct-text-3)', fontSize: 10 }}>
                        {a.selector}
                      </code>
                    )}
                    <button onClick={() => deleteAction(i)}
                      className="flex-shrink-0 text-body" style={{ color: 'var(--ct-text-3)' }}>×</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Review + Import ── */}
      {status === 'saved' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="text-heading font-semibold" style={{ color: 'var(--ct-pass)' }}>
              ✓ Recording complete
            </span>
            <span className="text-caption" style={{ color: 'var(--ct-text-3)' }}>
              {actions.length} actions captured
            </span>
          </div>

          {/* Pipeline name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-label" style={{ color: 'var(--ct-text-2)' }}>Pipeline name</label>
            <input value={pipelineName} onChange={e => setPipelineName(e.target.value)}
              placeholder="e.g. Checkout flow, Login, User onboarding"
              className="text-body px-3 py-2 rounded-md border"
              style={{ background: 'var(--ct-surface-raised)', borderColor: 'var(--ct-border)', color: 'var(--ct-text-1)', outline: 'none' }} />
          </div>

          {/* Actions review */}
          <div className="rounded-md border overflow-hidden" style={{ borderColor: 'var(--ct-border)' }}>
            <div className="px-3 py-2 border-b flex items-center justify-between"
              style={{ borderColor: 'var(--ct-border)', background: 'var(--ct-surface)' }}>
              <span className="text-label" style={{ color: 'var(--ct-text-2)' }}>
                Review steps ({actions.length})
              </span>
              <span className="text-caption" style={{ color: 'var(--ct-text-3)' }}>
                Delete any you don&apos;t want before importing
              </span>
            </div>
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {actions.map((a, i) => (
                <div key={i} className="flex items-center gap-3 px-3 border-b"
                  style={{ height: 40, borderColor: 'var(--ct-border)', background: i % 2 === 0 ? 'var(--ct-surface)' : 'var(--ct-surface-raised)' }}>
                  <span className="text-body w-4 text-center flex-shrink-0" style={{ color: ACTION_COLOR[a.type] }}>
                    {ACTION_ICON[a.type]}
                  </span>
                  <span className="text-caption w-16 flex-shrink-0" style={{ color: 'var(--ct-text-3)' }}>
                    {a.type}
                  </span>
                  <span className="text-body flex-1 truncate" style={{ color: 'var(--ct-text-1)' }}>
                    {a.intent || (a.url ?? a.selector ?? '')}
                  </span>
                  {a.selector && a.type !== 'navigate' && (
                    <code className="text-caption max-w-40 truncate flex-shrink-0"
                      style={{ color: 'var(--ct-text-3)', fontSize: 10 }}>
                      {a.selector}
                    </code>
                  )}
                  <button onClick={() => deleteAction(i)}
                    className="flex-shrink-0 text-body" style={{ color: 'var(--ct-text-3)' }}>×</button>
                </div>
              ))}
              {actions.length === 0 && (
                <div className="p-6 text-center text-body" style={{ color: 'var(--ct-text-3)' }}>
                  No actions recorded.
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={importAsPipeline}
              disabled={importing || actions.length === 0 || !projectId}
              className="text-label px-4 py-2 rounded-md disabled:opacity-50"
              style={{ background: 'var(--ct-accent-500)', color: '#fff' }}>
              {importing ? 'Creating pipeline…' : `Import as pipeline (${actions.length} steps)`}
            </button>
            <button onClick={() => { setStatus('idle'); setActions([]); setSessionId(null) }}
              className="text-label px-3 py-2 rounded-md border"
              style={{ borderColor: 'var(--ct-border)', color: 'var(--ct-text-2)' }}>
              Start over
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
