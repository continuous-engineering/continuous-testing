'use client'
/**
 * PipelineRunDemo
 * Animated explainer: a 3-step pipeline runs, context flows between steps,
 * all 3 pass, run completes. Loops every 7s.
 */

import { useState, useEffect } from 'react'

const STEPS = [
  {
    type: 'api' as const,
    name: 'POST /api/auth/login',
    code: `{ email, password }`,
    output: '→ ctx.token',
    color: '#38bdf8',
    bg:    'rgba(14,165,233,0.08)',
    border:'rgba(14,165,233,0.22)',
    ms: 800,
  },
  {
    type: 'ui' as const,
    name: 'Browser: complete checkout',
    code: `navigate → fill → click`,
    output: '→ ctx.orderId',
    color: '#a78bfa',
    bg:    'rgba(139,92,246,0.08)',
    border:'rgba(139,92,246,0.22)',
    ms: 1400,
  },
  {
    type: 'ai' as const,
    name: 'Claude: verify confirmation',
    code: `score 0.91 ≥ 0.85`,
    output: '→ passed',
    color: '#34d399',
    bg:    'rgba(16,185,129,0.08)',
    border:'rgba(16,185,129,0.22)',
    ms: 2200,
  },
]

type Phase = 'idle' | 'running' | 'done'

export function PipelineRunDemo() {
  const [phase,   setPhase]   = useState<Phase>('idle')
  const [step,    setStep]    = useState(-1)
  const [elapsed, setElapsed] = useState(0)

  const run = () => {
    setPhase('running')
    setStep(-1)
    setElapsed(0)

    const start = Date.now()
    const ticker = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 100)), 100)

    STEPS.forEach((s, i) => {
      setTimeout(() => setStep(i), s.ms)
    })
    setTimeout(() => {
      setPhase('done')
      clearInterval(ticker)
      setTimeout(() => { setPhase('idle'); setStep(-1); setElapsed(0) }, 2800)
    }, 3600)

    return () => clearInterval(ticker)
  }

  useEffect(() => {
    const t = setTimeout(run, 800)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (phase === 'idle' && step === -1) {
      const t = setTimeout(run, 400)
      return () => clearTimeout(t)
    }
  }, [phase, step])

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-up)', borderRadius: 20, overflow: 'hidden', width: '100%', maxWidth: 460, userSelect: 'none' }}>
      {/* Title bar */}
      <div style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
        {['#ff5f57','#febc2e','#28c840'].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />)}
        <span style={{ marginLeft: 8, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-3)' }}>checkout-pipeline</span>
        {phase === 'running' && (
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', animation: 'pulse-glow 1s ease-in-out infinite' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#f59e0b' }}>running · {(elapsed / 10).toFixed(1)}s</span>
          </span>
        )}
        {phase === 'done' && (
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px rgba(16,185,129,0.6)' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#10b981' }}>passed · {(elapsed / 10).toFixed(1)}s</span>
          </span>
        )}
      </div>

      {/* Steps */}
      <div style={{ padding: '20px 20px' }}>
        {STEPS.map((s, i) => {
          const active  = i <= step
          const current = i === step && phase === 'running'
          return (
            <div key={s.name}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                borderRadius: 12,
                background: active ? s.bg : 'transparent',
                border: `1px solid ${active ? s.border : 'transparent'}`,
                opacity: active || phase === 'idle' ? 1 : 0.22,
                transition: 'all 0.5s cubic-bezier(0.4,0,0.2,1)',
              }}>
                {/* Type badge */}
                <span style={{
                  padding: '3px 9px', borderRadius: 6,
                  fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
                  letterSpacing: '0.07em', textTransform: 'uppercase',
                  background: `${s.color}1a`, color: s.color,
                  border: `1px solid ${s.color}33`, flexShrink: 0,
                }}>{s.type}</span>

                {/* Name + code */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3, fontFamily: 'var(--font-mono)' }}>{s.code}</div>
                </div>

                {/* Status */}
                {current && <div style={{ width: 16, height: 16, border: `2px solid ${s.color}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />}
                {active && !current && <span style={{ color: '#10b981', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>✓</span>}
              </div>

              {/* Connector + ctx label */}
              {i < STEPS.length - 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 0', gap: 2, opacity: active && i < step ? 1 : 0.2, transition: 'opacity 0.5s' }}>
                  <div style={{ width: 1, height: 10, background: 'var(--border-up)' }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: s.color, background: `${s.color}12`, padding: '1px 8px', borderRadius: 4, border: `1px solid ${s.color}25` }}>{s.output}</span>
                  <div style={{ width: 1, height: 10, background: 'var(--border-up)' }} />
                </div>
              )}
            </div>
          )
        })}

        {/* Run summary */}
        <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 10, background: phase === 'done' ? 'rgba(16,185,129,0.07)' : 'var(--surface-2)', border: `1px solid ${phase === 'done' ? 'rgba(16,185,129,0.28)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.5s' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: phase === 'done' ? '#10b981' : 'var(--text-3)' }}>
            {phase === 'done' ? '✓  3/3 steps passed' : phase === 'running' ? '◦  executing…' : '○  ready to run'}
          </span>
          {phase === 'done' && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>runner-2 · hosted</span>}
        </div>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
