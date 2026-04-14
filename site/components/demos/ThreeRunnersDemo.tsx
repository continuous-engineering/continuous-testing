'use client'
/**
 * ThreeRunnersDemo
 * Shows 3 runner containers picking up 3 parallel jobs simultaneously,
 * executing independently, all completing. Highlights concurrent dispatch.
 */

import { useState, useEffect } from 'react'

const RUNNERS = [
  { id: 1, name: 'runner-1', scope: 'hosted', pipeline: 'API Health', color: '#38bdf8' },
  { id: 2, name: 'runner-2', scope: 'hosted', pipeline: 'Runner Protocol', color: '#a78bfa' },
  { id: 3, name: 'runner-3', scope: 'hosted', pipeline: 'Project CRUD + AI', color: '#34d399' },
]

type RunnerState = 'idle' | 'polling' | 'claimed' | 'running' | 'done'

export function ThreeRunnersDemo() {
  const [states, setStates]   = useState<RunnerState[]>(['idle','idle','idle'])
  const [queued,  setQueued]  = useState(0)
  const [timers,  setTimers]  = useState<string[]>(['','',''])

  const run = () => {
    setStates(['idle','idle','idle'])
    setQueued(0)
    setTimers(['','',''])

    // Queue 3 jobs
    setTimeout(() => setQueued(3), 400)

    // All 3 runners start polling simultaneously
    setTimeout(() => setStates(['polling','polling','polling']), 700)

    // Claim — staggered slightly for realism
    setTimeout(() => setStates(s => { const n=[...s]; n[0]='claimed'; return n }), 1100)
    setTimeout(() => setStates(s => { const n=[...s]; n[1]='claimed'; return n }), 1180)
    setTimeout(() => setStates(s => { const n=[...s]; n[2]='claimed'; return n }), 1260)

    // All start running
    setTimeout(() => setStates(['running','running','running']), 1700)

    // Complete at different times (realistic)
    const start = Date.now() + 1700
    const intervals = [0,1,2].map(i => setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 100)
      setTimers(t => { const n=[...t]; n[i] = (elapsed/10).toFixed(1)+'s'; return n })
    }, 100))

    setTimeout(() => { setStates(s => { const n=[...s]; n[0]='done'; return n }); setQueued(q => Math.max(0,q-1)); clearInterval(intervals[0]) }, 4200)
    setTimeout(() => { setStates(s => { const n=[...s]; n[1]='done'; return n }); setQueued(q => Math.max(0,q-1)); clearInterval(intervals[1]) }, 5100)
    setTimeout(() => { setStates(s => { const n=[...s]; n[2]='done'; return n }); setQueued(q => Math.max(0,q-1)); clearInterval(intervals[2]) }, 6000)

    // Reset after all done
    setTimeout(() => {
      intervals.forEach(clearInterval)
      setStates(['idle','idle','idle'])
      setQueued(0)
      setTimers(['','',''])
    }, 8500)
  }

  useEffect(() => { run() }, [])
  useEffect(() => {
    if (states.every(s => s === 'idle') && queued === 0) {
      const t = setTimeout(run, 800)
      return () => clearTimeout(t)
    }
  }, [states, queued])

  const stateLabel: Record<RunnerState, string> = {
    idle: 'idle', polling: 'polling…', claimed: 'claimed', running: 'executing', done: 'passed',
  }
  const stateColor: Record<RunnerState, string> = {
    idle: 'var(--text-3)', polling: '#f59e0b', claimed: '#f59e0b', running: '#0ea5e9', done: '#10b981',
  }
  const dotAnim: Record<RunnerState, string> = {
    idle: 'none', polling: 'pulse-glow 1s ease-in-out infinite', claimed: 'none', running: 'pulse-glow 1s ease-in-out infinite', done: 'none',
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-up)', borderRadius: 20, overflow: 'hidden', width: '100%', maxWidth: 460, userSelect: 'none' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
        {['#ff5f57','#febc2e','#28c840'].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />)}
        <span style={{ marginLeft: 8, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-3)' }}>ct-network · 3 runners</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: queued > 0 ? '#f59e0b' : 'var(--text-3)' }}>{queued} jobs queued</span>
        </div>
      </div>

      {/* Queue visualization */}
      <div style={{ padding: '16px 20px 0' }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {RUNNERS.map((r, i) => (
            <div key={r.id} style={{
              flex: 1, padding: '8px 0', borderRadius: 8, textAlign: 'center',
              background: queued > 0 && i < queued ? 'rgba(245,158,11,0.08)' : 'var(--bg)',
              border: `1px solid ${queued > 0 && i < queued ? 'rgba(245,158,11,0.3)' : 'var(--border)'}`,
              transition: 'all 0.4s',
              fontFamily: 'var(--font-mono)', fontSize: 11,
              color: queued > 0 && i < queued ? '#f59e0b' : 'var(--text-3)',
            }}>
              job-{i+1}
            </div>
          ))}
        </div>
      </div>

      {/* Runner cards */}
      <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {RUNNERS.map((runner, i) => {
          const state = states[i] ?? 'idle'
          const color = stateColor[state]
          return (
            <div key={runner.id} style={{
              padding: '14px 16px', borderRadius: 12,
              background: state === 'running' ? `${runner.color}08` : state === 'done' ? 'rgba(16,185,129,0.06)' : 'var(--bg)',
              border: `1px solid ${state === 'running' ? `${runner.color}25` : state === 'done' ? 'rgba(16,185,129,0.2)' : 'var(--border)'}`,
              transition: 'all 0.45s cubic-bezier(0.4,0,0.2,1)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Status dot */}
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0, animation: dotAnim[state], boxShadow: state === 'done' ? '0 0 6px rgba(16,185,129,0.6)' : 'none' }} />

                {/* Runner name */}
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--text-1)', flex: 1 }}>{runner.name}</span>

                {/* Scope badge */}
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 5, background: 'rgba(255,255,255,0.04)', color: 'var(--text-3)', border: '1px solid var(--border)', fontWeight: 500 }}>{runner.scope}</span>

                {/* State */}
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color, minWidth: 70, textAlign: 'right' }}>{stateLabel[state]}</span>
              </div>

              {/* Pipeline + timer */}
              {(state === 'claimed' || state === 'running' || state === 'done') && (
                <div style={{ marginTop: 8, paddingLeft: 17, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: runner.color, fontWeight: 500 }}>{runner.pipeline}</span>
                  {(state === 'running' || state === 'done') && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: state === 'done' ? '#10b981' : 'var(--text-3)' }}>
                      {state === 'done' ? '✓ ' : ''}{timers[i]}
                    </span>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {/* Summary */}
        <div style={{
          padding: '10px 14px', borderRadius: 10, marginTop: 4,
          background: states.every(s => s === 'done') ? 'rgba(16,185,129,0.07)' : 'var(--surface-2)',
          border: `1px solid ${states.every(s => s === 'done') ? 'rgba(16,185,129,0.25)' : 'var(--border)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          transition: 'all 0.5s',
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: states.every(s => s === 'done') ? '#10b981' : 'var(--text-3)' }}>
            {states.every(s => s === 'done') ? '✓  3 runs complete · parallel · no shared state' :
             states.some(s => s === 'running') ? '◦  3 runners executing concurrently…' :
             states.some(s => s === 'polling') ? '◦  dispatching to runners…' : '○  queue empty'}
          </span>
        </div>
      </div>
    </div>
  )
}
