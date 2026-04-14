'use client'
/**
 * SelfHealingDemo
 * Shows a UI step's selector health: tries ARIA, testid, text, CSS in order.
 * CSS selector fails → warning shown. Loops.
 */

import { useState, useEffect } from 'react'

const SELECTORS = [
  { strategy: 'ARIA role', value: 'role=button, name="Complete order"', result: 'pass', color: '#10b981' },
  { strategy: 'data-testid', value: '[data-testid="checkout-submit"]', result: 'pass', color: '#10b981' },
  { strategy: 'Text match', value: 'text="Complete order"', result: 'pass', color: '#10b981' },
  { strategy: 'CSS selector', value: '.checkout-form .btn-primary:nth-child(2)', result: 'warn', color: '#f59e0b' },
]

const ELEMENT_LABELS = ['role', 'aria-label', 'data-testid', 'className']
const ELEMENT_VALUES = ['button', '"Complete order"', '"checkout-submit"', '"btn-primary checkout-cta"']

export function SelfHealingDemo() {
  const [activeIdx, setActiveIdx] = useState(-1)
  const [elementHighlight, setElementHighlight] = useState(false)

  const run = () => {
    setActiveIdx(-1)
    setElementHighlight(false)
    let delay = 400
    SELECTORS.forEach((_, i) => {
      setTimeout(() => setActiveIdx(i), delay)
      delay += 520
    })
    setTimeout(() => {
      setElementHighlight(true)
      setTimeout(() => { setActiveIdx(-1); setElementHighlight(false) }, 2200)
    }, delay)
  }

  useEffect(() => { run() }, [])
  useEffect(() => {
    if (activeIdx === -1 && !elementHighlight) {
      const t = setTimeout(run, 600)
      return () => clearTimeout(t)
    }
  }, [activeIdx, elementHighlight])

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-up)', borderRadius: 20, overflow: 'hidden', width: '100%', maxWidth: 460, userSelect: 'none' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
        {['#ff5f57','#febc2e','#28c840'].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />)}
        <span style={{ marginLeft: 8, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-3)' }}>step: click "Complete order"</span>
      </div>

      <div style={{ padding: '20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Fake browser element */}
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>DOM element</div>
          <div style={{
            background: elementHighlight ? 'rgba(16,185,129,0.12)' : 'var(--surface)',
            border: `2px solid ${elementHighlight ? 'rgba(16,185,129,0.5)' : 'var(--border)'}`,
            borderRadius: 8, padding: '10px 14px',
            transition: 'all 0.4s cubic-bezier(0.4,0,0.2,1)',
            position: 'relative',
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.9 }}>
              <span style={{ color: '#a78bfa' }}>&lt;button</span>
              {ELEMENT_LABELS.map((attr, i) => (
                <div key={attr} style={{ paddingLeft: 16 }}>
                  <span style={{ color: '#38bdf8' }}>{attr}</span>
                  <span style={{ color: 'var(--text-3)' }}>={'"'}</span>
                  <span style={{ color: '#34d399' }}>{ELEMENT_VALUES[i]}</span>
                  <span style={{ color: 'var(--text-3)'}}>{'"'}</span>
                </div>
              ))}
              <span style={{ color: '#a78bfa' }}>&gt;</span>
              <span style={{ color: 'var(--text-1)' }}>Complete order</span>
              <span style={{ color: '#a78bfa' }}>&lt;/button&gt;</span>
            </div>
            {elementHighlight && (
              <div style={{ position: 'absolute', top: 6, right: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#10b981', fontWeight: 700 }}>✓ located</span>
              </div>
            )}
          </div>
        </div>

        {/* Selector priority list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>selector chain (priority order)</div>
          {SELECTORS.map((s, i) => {
            const tested  = i <= activeIdx
            const current = i === activeIdx
            const isWarn  = s.result === 'warn'
            return (
              <div key={s.strategy} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8,
                background: current ? (isWarn ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)') : tested ? 'rgba(255,255,255,0.02)' : 'transparent',
                border: `1px solid ${current ? (isWarn ? 'rgba(245,158,11,0.25)' : 'rgba(16,185,129,0.25)') : 'transparent'}`,
                opacity: tested || activeIdx < 0 ? 1 : 0.3,
                transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)',
              }}>
                {/* Priority number */}
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', width: 16, flexShrink: 0, textAlign: 'right' }}>{i + 1}</span>

                {/* Strategy + value */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: current ? s.color : tested ? 'var(--text-2)' : 'var(--text-3)' }}>{s.strategy}</span>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.value}</div>
                </div>

                {/* Result */}
                {tested && (
                  <span style={{ fontSize: 13, color: s.color, fontWeight: 700, flexShrink: 0 }}>
                    {isWarn ? '⚠' : '✓'}
                  </span>
                )}
                {current && !tested && <div style={{ width: 12, height: 12, border: `2px solid ${s.color}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite', flexShrink: 0 }} />}
              </div>
            )
          })}
        </div>

        {/* Warning */}
        {activeIdx >= SELECTORS.length - 1 && (
          <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)', display: 'flex', gap: 10, alignItems: 'flex-start', transition: 'all 0.4s' }}>
            <span style={{ fontSize: 14, flexShrink: 0 }}>⚠</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#f59e0b', marginBottom: 2 }}>CSS selector used as fallback</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5 }}>This element lacks <code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: 4 }}>data-testid</code> — add it for a more resilient test.</div>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
