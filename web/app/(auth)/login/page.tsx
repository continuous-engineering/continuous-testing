'use client'
export const dynamic = 'force-dynamic'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const inputStyle = {
  padding: '10px 14px', borderRadius: 8,
  border: '1px solid var(--ct-border)',
  background: 'rgba(255,255,255,0.04)',
  color: 'var(--ct-text-1)', fontSize: 14, outline: 'none',
  width: '100%', boxSizing: 'border-box' as const,
  transition: 'border-color 0.15s',
  fontFamily: 'var(--ct-font-sans)',
}

export default function LoginPage() {
  const router = useRouter()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const res  = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
      const data = await res.json() as { error?: string }
      if (!res.ok) { setError(data.error ?? 'Login failed'); return }
      router.push('/'); router.refresh()
    } catch { setError('Network error') } finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--ct-bg)', padding: 20 }}>
      <div style={{ position: 'fixed', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)', filter: 'blur(70px)', top: '30%', left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ width: '100%', maxWidth: 380, position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            <span style={{ color: 'var(--ct-accent-500)' }}>continuous</span>
            <span style={{ color: 'var(--ct-text-3)' }}>.</span>
            <span style={{ color: 'var(--ct-text-1)' }}>testing</span>
          </div>
          <p style={{ marginTop: 8, fontSize: 14, color: 'var(--ct-text-2)' }}>Sign in to your workspace</p>
        </div>

        <div style={{ background: 'var(--ct-surface)', border: '1px solid var(--ct-border)', borderRadius: 12, padding: '28px' }}>
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--ct-text-2)' }}>Email</label>
              <input type="email" required autoFocus value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" style={inputStyle}
                onFocus={e => (e.target.style.borderColor = 'var(--ct-accent-500)')}
                onBlur={e  => (e.target.style.borderColor = 'var(--ct-border)')} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--ct-text-2)' }}>Password</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={inputStyle}
                onFocus={e => (e.target.style.borderColor = 'var(--ct-accent-500)')}
                onBlur={e  => (e.target.style.borderColor = 'var(--ct-border)')} />
            </div>

            {error && (
              <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.25)', fontSize: 13, color: '#f87171' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{ padding: '11px', borderRadius: 8, border: 'none', background: 'var(--ct-accent-500)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, transition: 'opacity 0.2s', marginTop: 4, fontFamily: 'var(--ct-font-sans)', boxShadow: '0 0 24px rgba(16,185,129,0.2)' }}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--ct-text-3)' }}>
          No account?{' '}
          <Link href="/signup" style={{ color: 'var(--ct-accent-500)', textDecoration: 'none', fontWeight: 500 }}>Create workspace →</Link>
        </p>
      </div>
    </div>
  )
}
