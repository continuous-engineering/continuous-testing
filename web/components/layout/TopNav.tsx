'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ThemeToggle } from './ThemeToggle'

type User = { name: string; email: string }
type Org  = { org_id: string; name: string; role: string }

export function TopNav() {
  const router  = useRouter()
  const menuRef = useRef<HTMLDivElement>(null)
  const [user,      setUser]      = useState<User | null>(null)
  const [orgs,      setOrgs]      = useState<Org[]>([])
  const [activeOrg, setActiveOrg] = useState('')
  const [open,      setOpen]      = useState(false)
  const [switching, setSwitching] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then((d: { data?: { user: User; orgs: Org[]; activeOrgId: string } }) => {
      if (d.data?.user) { setUser(d.data.user); setOrgs(d.data.orgs); setActiveOrg(d.data.activeOrgId) }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login'); router.refresh()
  }

  async function switchOrg(orgId: string) {
    if (orgId === activeOrg || switching) return
    setSwitching(true)
    setOpen(false)
    try {
      await fetch('/api/auth/switch-org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId }),
      })
      // Session cookie is now re-issued — hard reload to pick up new tenant context
      window.location.href = '/'
    } catch {
      setSwitching(false)
    }
  }

  const current = orgs.find(o => o.org_id === activeOrg)

  return (
    <header className="flex items-center justify-between px-4 border-b flex-shrink-0"
      style={{ height: 'var(--ct-row-h)', background: 'var(--ct-surface)', borderColor: 'var(--ct-border)' }}>
      {/* Org switcher */}
      <div ref={menuRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setOpen(!open)}
          disabled={switching}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px', borderRadius: 6, background: 'transparent', border: '1px solid var(--ct-border)', cursor: switching ? 'wait' : 'pointer', color: 'var(--ct-text-1)', fontSize: 13, fontWeight: 500, opacity: switching ? 0.6 : 1 }}>
          <span style={{ width: 20, height: 20, borderRadius: 4, background: 'var(--ct-accent-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
            {current?.name?.[0]?.toUpperCase() ?? 'W'}
          </span>
          <span>{switching ? 'Switching…' : (current?.name ?? 'Workspace')}</span>
          <span style={{ color: 'var(--ct-text-3)', fontSize: 9 }}>▾</span>
        </button>
        {open && (
          <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, background: 'var(--ct-surface)', border: '1px solid var(--ct-border)', borderRadius: 8, minWidth: 180, zIndex: 100, padding: 4, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
            {orgs.map(o => (
              <button key={o.org_id} onClick={() => switchOrg(o.org_id)}
                style={{ width: '100%', textAlign: 'left', padding: '7px 12px', background: o.org_id === activeOrg ? 'rgba(16,185,129,0.1)' : 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer', color: o.org_id === activeOrg ? 'var(--ct-accent-500)' : 'var(--ct-text-1)', fontSize: 13 }}>
                {o.name}
                {o.org_id === activeOrg && <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.6 }}>✓</span>}
              </button>
            ))}
            <div style={{ height: 1, background: 'var(--ct-border)', margin: '4px 0' }} />
            <button onClick={logout}
              style={{ width: '100%', textAlign: 'left', padding: '7px 12px', background: 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#f87171', fontSize: 13 }}>
              Sign out
            </button>
          </div>
        )}
      </div>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <ThemeToggle />
        {user && (
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: 'var(--ct-accent-500)' }}>
            {user.name?.[0]?.toUpperCase() ?? '?'}
          </div>
        )}
      </div>
    </header>
  )
}
