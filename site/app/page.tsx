'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

const APP_URL = 'https://app.continuous.testing'

// ── Nav ───────────────────────────────────────────────────────────────────────
function Nav() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <nav className={`site-nav ${scrolled ? 'scrolled' : ''}`}>
      <a href="/" style={{ textDecoration: 'none', fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }} className="brand-ct">
        <span className="ct-continuous">continuous</span>
        <span className="ct-dot">.</span>
        <span className="ct-testing">testing</span>
      </a>
      <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
        {(['Features', 'Pricing', 'Docs', 'Blog'] as const).map(label => (
          <Link key={label} href={`/${label.toLowerCase()}`}
            style={{ color: 'var(--text-2)', textDecoration: 'none', fontSize: 14, fontWeight: 500, transition: 'color var(--t)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-1)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-2)' }}>
            {label}
          </Link>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <a href={`${APP_URL}/login`} className="btn btn-ghost" style={{ padding: '8px 18px', fontSize: 14 }}>Sign in</a>
        <a href={`${APP_URL}/login`} className="btn btn-primary" style={{ padding: '8px 18px', fontSize: 14 }}>Start free</a>
      </div>
    </nav>
  )
}

// ── Animated pipeline ─────────────────────────────────────────────────────────
const STEPS = [
  { type: 'api', label: 'GET /api/auth/token',      meta: 'ctx.token extracted', delay: 0 },
  { type: 'ui',  label: 'Browser: complete checkout', meta: 'ctx.token → header',  delay: 900 },
  { type: 'ai',  label: 'Claude: verify confirmation', meta: 'score 0.91 ≥ 0.85',  delay: 2000 },
]

function PipelineDemo() {
  const [visible, setVisible] = useState(0)
  const [done, setDone] = useState(false)

  const run = () => {
    setVisible(0); setDone(false)
    STEPS.forEach((s, i) => setTimeout(() => {
      setVisible(i + 1)
      if (i === STEPS.length - 1) setTimeout(() => setDone(true), 400)
    }, s.delay + 200))
  }

  useEffect(() => { run() }, [])
  useEffect(() => { if (done) { const t = setTimeout(run, 3500); return () => clearTimeout(t) } }, [done])

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-up)', borderRadius: 'var(--radius-xl)', padding: '28px 28px', width: '100%', maxWidth: 460 }}>
      {/* Traffic lights */}
      <div style={{ display: 'flex', gap: 7, marginBottom: 22 }}>
        {['#ff5f57','#febc2e','#28c840'].map(c => <div key={c} style={{ width: 11, height: 11, borderRadius: '50%', background: c }} />)}
        <span style={{ marginLeft: 10, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>checkout-flow.ct</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {STEPS.map((step, i) => (
          <div key={step.label}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 10,
              opacity: i < visible ? 1 : 0.18,
              background: i < visible ? (step.type === 'api' ? 'rgba(14,165,233,0.06)' : step.type === 'ui' ? 'rgba(139,92,246,0.06)' : 'rgba(16,185,129,0.06)') : 'transparent',
              border: `1px solid ${i < visible ? (step.type === 'api' ? 'rgba(14,165,233,0.18)' : step.type === 'ui' ? 'rgba(139,92,246,0.18)' : 'rgba(16,185,129,0.18)') : 'transparent'}`,
              transition: 'all 0.45s var(--ease)',
            }}>
              <span className={`badge badge-${step.type}`}>{step.type.toUpperCase()}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{step.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>{step.meta}</div>
              </div>
              {i < visible && <span style={{ fontSize: 12, color: 'var(--pass)', fontWeight: 700 }}>✓</span>}
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3px 0', gap: 1 }}>
                <div style={{ width: 1, height: 10, background: 'var(--border-up)' }} />
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>ctx.token →</span>
                <div style={{ width: 1, height: 10, background: 'var(--border-up)' }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Result */}
      <div style={{ marginTop: 18, padding: '10px 14px', borderRadius: 10, background: done ? 'rgba(16,185,129,0.07)' : 'var(--surface-2)', border: `1px solid ${done ? 'rgba(16,185,129,0.25)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.4s var(--ease)' }}>
        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: done ? 'var(--pass)' : 'var(--text-3)' }}>
          {done ? '✓  3/3 passed · 1.3s' : '◦  running…'}
        </span>
        {done && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>runner-2 · hosted</span>}
      </div>
    </div>
  )
}

// ── Features ──────────────────────────────────────────────────────────────────
const FEATURES = [
  { icon: '⚡', title: 'API Testing', body: 'Full HTTP client. JSONPath assertions. OpenAPI import generates stubs + mock data. HAR capture from DevTools. Parameterized runs from CSV.', tag: null },
  { icon: '🖥', title: 'UI Testing', body: 'Playwright Chromium — built in, no setup. Browser recorder captures semantic intent. Self-healing: ARIA → testid → text → CSS.', tag: null },
  { icon: '🤖', title: 'AI / LLM Testing', body: 'Semantic assertions via Claude. Does your model actually respond correctly? Threshold scoring — not brittle string matching.', tag: 'Industry first' },
  { icon: '🔗', title: 'Unified Pipeline', body: 'API → UI → AI in a single DAG. Token extracted in step 1 flows to step 3. One runner. One context map. No shared state between runs.', tag: null },
  { icon: '🧠', title: 'Generate from Code', body: 'Git repo → Claude analyzes routes + components → journey map → runnable test suite. From zero to 80% coverage in minutes.', tag: 'Unique' },
  { icon: '📊', title: 'Coverage & Flaky Detection', body: 'OpenAPI spec vs test suite heatmap. Per-step 30-day sparklines. Statistical flaky detection (5–95% fail rate over ≥5 runs).', tag: null },
]

// ── Comparison ────────────────────────────────────────────────────────────────
const COMPARE = [
  { label: 'All 3 test types in one pipeline', us: true, tr: false, rig: false },
  { label: 'AI / LLM behavioral testing',       us: true, tr: false, rig: false },
  { label: 'Self-healing selectors',             us: true, tr: false, rig: true },
  { label: 'Generate tests from git repo',       us: true, tr: false, rig: false },
  { label: 'Self-hosted Docker runners',         us: true, tr: false, rig: false },
  { label: 'API testing built in',              us: true, tr: false, rig: false },
  { label: 'Flat pricing (not per-user)',        us: true, tr: false, rig: false },
  { label: 'Jira · GitHub · Linear sync',       us: true, tr: true,  rig: false },
]

// ── Pricing ───────────────────────────────────────────────────────────────────
const PLANS = [
  { name: 'Starter', price: '$0',   per: 'forever',       sub: '500 hosted runner min/mo · 3 projects · unlimited pipelines', cta: 'Start free',       hi: false },
  { name: 'Team',    price: '$79',  per: '/month flat',    sub: '5,000 min · Jira/GitHub/Slack · unlimited users',               cta: 'Start Team trial', hi: true  },
  { name: 'Scale',   price: '$199', per: '/month flat',    sub: '20k min · self-hosted runners · SSO',                          cta: 'Start Scale trial',hi: false },
]

// ── Page ──────────────────────────────────────────────────────────────────────
export default function HomePage() {
  return (
    <div style={{ background: 'var(--bg)' }}>
      <Nav />

      {/* HERO */}
      <section style={{ position: 'relative', overflow: 'hidden', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(100px,14vh,160px) clamp(20px,5vw,72px) clamp(64px,8vw,100px)' }}>
        <div className="bg-dots" style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
        <div className="glow-blob glow-blob-emerald" style={{ width: 800, height: 700, top: '-20%', left: '55%', transform: 'translateX(-50%)' }} />
        <div className="glow-blob glow-blob-violet"  style={{ width: 400, height: 400, bottom: '5%',  right: '3%' }} />
        <div className="glow-blob glow-blob-indigo"  style={{ width: 300, height: 300, bottom: '20%', left:  '2%' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 240, background: 'linear-gradient(to bottom, transparent, var(--bg))', zIndex: 1 }} />

        <div style={{ position: 'relative', zIndex: 2, maxWidth: 1100, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* Badge */}
          <div className="anim-fade-up" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 14px', borderRadius: 100, border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.07)', marginBottom: 32 }}>
            <span className="dot dot-pass" style={{ width: 6, height: 6, boxShadow: '0 0 6px var(--pass)' }} />
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent)' }}>continuous.engineering · 4th product</span>
          </div>

          {/* H1 */}
          <h1 className="t-display anim-fade-up anim-delay-1" style={{ textAlign: 'center', marginBottom: 24 }}>
            API · UI · AI testing
            <br />
            <span className="gradient-text">unified in one pipeline.</span>
          </h1>

          {/* Sub */}
          <p className="anim-fade-up anim-delay-2" style={{ maxWidth: 600, textAlign: 'center', fontSize: 18, lineHeight: 1.8, color: 'var(--text-2)', marginBottom: 40 }}>
            The first platform where a REST call, a Playwright browser flow, and a Claude semantic assertion
            run as one connected DAG — sharing context, one runner, one result.
          </p>

          {/* CTAs */}
          <div className="anim-fade-up anim-delay-3" style={{ display: 'flex', gap: 12, marginBottom: 72, flexWrap: 'wrap', justifyContent: 'center' }}>
            <a href={`${APP_URL}/login`} className="btn btn-primary btn-lg">Start free — no card needed</a>
            <Link href="/docs/getting-started" className="btn btn-ghost btn-lg">Read the docs →</Link>
          </div>

          {/* Pipeline demo */}
          <div className="anim-fade-up anim-delay-4" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <PipelineDemo />
            <span style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
              Live demo · 3 hosted runners · ct-network
            </span>
          </div>
        </div>
      </section>

      {/* LOGOS */}
      <section style={{ padding: '20px clamp(20px,5vw,72px)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', gap: 48, justifyContent: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-3)' }}>Trusted by</span>
          {['Continuia Health', 'QNTM Chain', 'continuous.engineering'].map(c => (
            <span key={c} style={{ fontSize: 14, color: 'var(--text-2)', fontWeight: 500 }}>{c}</span>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="section">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div className="t-eyebrow" style={{ marginBottom: 16 }}>What it does</div>
            <h2 className="t-title" style={{ marginBottom: 16 }}>Every test type. One platform.</h2>
            <p className="t-body" style={{ maxWidth: 540, margin: '0 auto' }}>
              Stop switching between Postman, Selenium, and your LLM eval scripts.
              Everything runs in a single pipeline with shared context.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px,1fr))', gap: 18 }}>
            {FEATURES.map(f => (
              <div key={f.title} className="card card-glow card-hover" style={{ padding: 28 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                  <span style={{ fontSize: 26 }}>{f.icon}</span>
                  {f.tag && <span className="badge badge-new">{f.tag}</span>}
                </div>
                <h3 className="t-heading" style={{ marginBottom: 10 }}>{f.title}</h3>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-2)', margin: 0 }}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* KILLER FEATURE — CODE GENERATION */}
      <section className="section" style={{ background: 'var(--bg-alt)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div className="container" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 72, alignItems: 'center' }}>
          {/* Terminal */}
          <div style={{ background: '#080810', border: '1px solid var(--border-up)', borderRadius: 'var(--radius-xl)', overflow: 'hidden', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
            <div style={{ background: 'var(--surface-2)', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 7, borderBottom: '1px solid var(--border)' }}>
              {['#ff5f57','#febc2e','#28c840'].map(c => <div key={c} style={{ width: 11, height: 11, borderRadius: '50%', background: c }} />)}
              <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-3)' }}>$ ct generate --repo https://github.com/acme/checkout-api</span>
            </div>
            <div style={{ padding: '22px 22px', lineHeight: 2 }}>
              {[
                ['dim', '→ Cloning repository...'],
                ['dim', '→ Analyzing 47 routes, 23 React components...'],
                ['dim', '→ Reading auth middleware, models, OpenAPI spec...'],
                ['pass','✓ 8 user journeys identified'],
                ['text', ''],
                ['text', '  1  User registration → email verification'],
                ['text', '  2  OAuth login → dashboard redirect'],
                ['text', '  3  Checkout flow with Stripe payment'],
                ['text', '  4  Admin: user management CRUD'],
                ['dim',  '  +4 more...'],
                ['text', ''],
                ['pass','✓ 31 test steps generated'],
                ['pass','✓ Mock server seeded from OpenAPI schema'],
                ['pass','✓ Written → checkout-pipeline.ct'],
                ['text', ''],
                ['accent','  Run `ct run checkout-pipeline --env staging`'],
              ].map(([type, line], i) => (
                <div key={i} style={{ color: type === 'accent' ? 'var(--accent)' : type === 'pass' ? 'var(--pass)' : type === 'dim' ? 'var(--text-3)' : 'var(--text-1)', lineHeight: 1.9 }}>
                  {line}
                </div>
              ))}
            </div>
          </div>

          {/* Copy */}
          <div>
            <div className="t-eyebrow" style={{ marginBottom: 18 }}>Nobody else does this</div>
            <h2 className="t-title" style={{ marginBottom: 20 }}>
              Git repo → full test suite.{' '}
              <span className="gradient-text">In minutes.</span>
            </h2>
            <p className="t-body" style={{ marginBottom: 20 }}>
              Every other test tool starts with a blank canvas. You write every test by hand.
            </p>
            <p className="t-body" style={{ marginBottom: 32 }}>
              We point Claude at your codebase. It reads your routes, components, auth flows, and API schemas —
              identifies the user journeys that matter — and scaffolds a runnable test suite.
              From zero to 80% coverage before you've written a single line.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 36 }}>
              {[
                'Works on any stack — Next.js, Rails, FastAPI, Go, anything',
                'API steps pre-filled with real endpoint shapes',
                'Mock server seeded from your actual schema',
                'Review the journey map before running',
              ].map(txt => (
                <div key={txt} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--accent)', marginTop: 2 }}>✦</span>
                  <span style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.6 }}>{txt}</span>
                </div>
              ))}
            </div>
            <a href={`${APP_URL}/login`} className="btn btn-primary">Try it on your codebase</a>
          </div>
        </div>
      </section>

      {/* COMPARISON */}
      <section className="section">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <div className="t-eyebrow" style={{ marginBottom: 16 }}>How we compare</div>
            <h2 className="t-title" style={{ marginBottom: 16 }}>Built for the AI era.<br />Not retrofitted.</h2>
            <p className="t-body" style={{ maxWidth: 500, margin: '0 auto' }}>
              TestRail was built for manual test management in 2010. TestRigor does AI UI testing but nothing else.
              We're the first platform designed around all three test types from the start.
            </p>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 580 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 12, color: 'var(--text-3)', fontWeight: 500 }}>Feature</th>
                  {[
                    { name: 'continuous.testing', color: 'var(--accent)', isBrand: true },
                    { name: 'TestRail', color: 'var(--text-3)', isBrand: false },
                    { name: 'TestRigor', color: 'var(--text-3)', isBrand: false },
                  ].map(col => (
                    <th key={col.name} style={{ padding: '12px 20px', textAlign: 'center', fontSize: 13, color: col.color, fontWeight: 600, minWidth: 130 }}>
                      {col.isBrand ? (
                        <span className="brand-ct">
                          <span className="ct-continuous">continuous</span><span className="ct-dot">.</span><span className="ct-testing">testing</span>
                        </span>
                      ) : col.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((row, i) => (
                  <tr key={row.label} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)', borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '13px 20px', fontSize: 14, color: 'var(--text-2)' }}>{row.label}</td>
                    {[row.us, row.tr, row.rig].map((v, j) => (
                      <td key={j} style={{ padding: '13px 20px', textAlign: 'center', fontSize: 16 }}>
                        {v ? <span style={{ color: 'var(--pass)', fontWeight: 600 }}>✓</span> : <span style={{ color: 'var(--text-3)' }}>—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-3)', marginTop: 22 }}>
            TestRail ≈ $36–95/user/mo · TestRigor ≈ $600–2,000+/mo · continuous.testing from $0
          </p>
        </div>
      </section>

      {/* PRICING */}
      <section className="section" style={{ background: 'var(--bg-alt)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div className="t-eyebrow" style={{ marginBottom: 16 }}>Pricing</div>
            <h2 className="t-title" style={{ marginBottom: 16 }}>Flat pricing. Not per user.</h2>
            <p className="t-body" style={{ maxWidth: 480, margin: '0 auto' }}>
              50-person team? Same price as 5-person team.
              We charge for compute — not headcount.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20, maxWidth: 860, margin: '0 auto' }}>
            {PLANS.map(p => (
              <div key={p.name} className="card" style={{ padding: '32px 26px', position: 'relative', border: p.hi ? '1px solid rgba(16,185,129,0.4)' : '1px solid var(--border)', background: p.hi ? 'rgba(16,185,129,0.04)' : 'var(--surface)', boxShadow: p.hi ? '0 0 60px rgba(16,185,129,0.06)' : 'none' }}>
                {p.hi && <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: 'var(--accent)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '4px 14px', borderRadius: 100, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Most popular</div>}
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)', marginBottom: 10 }}>{p.name}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
                  <span style={{ fontSize: 38, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.03em' }}>{p.price}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{p.per}</span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 26 }}>{p.sub}</p>
                <a href={`${APP_URL}/login`} className="btn" style={{ width: '100%', justifyContent: 'center', padding: '12px', background: p.hi ? 'var(--accent)' : 'transparent', color: p.hi ? '#fff' : 'var(--text-1)', border: p.hi ? 'none' : '1px solid var(--border-up)', boxShadow: p.hi ? '0 0 28px var(--accent-glow)' : 'none' }}>
                  {p.cta}
                </a>
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-3)', marginTop: 22 }}>
            Overage: $0.01/hosted runner min · Self-hosted runners always free · <Link href="/pricing" style={{ color: 'var(--text-2)', textDecoration: 'none' }}>Full pricing →</Link>
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="section" style={{ textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div className="glow-blob glow-blob-emerald" style={{ width: 700, height: 500, top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 className="t-display" style={{ marginBottom: 20, maxWidth: 680, margin: '0 auto 20px' }}>
            Replace $1,000/month<br /><span className="gradient-text">with $79/month.</span>
          </h2>
          <p className="t-body" style={{ maxWidth: 480, margin: '0 auto 40px' }}>
            Import your OpenAPI spec. Get a test suite in 30 seconds.
            Or point at your git repo and let Claude build it.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href={`${APP_URL}/login`} className="btn btn-primary btn-lg" style={{ fontSize: 17 }}>Start free</a>
            <a href="mailto:hello@continuous.engineering" className="btn btn-ghost btn-lg">Talk to us</a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '36px clamp(20px,5vw,72px)' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
          <span className="brand-ct" style={{ fontSize: 15, fontWeight: 700 }}>
            <span className="ct-continuous">continuous</span><span className="ct-dot">.</span><span className="ct-testing">testing</span>
          </span>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {([['Features','/features'],['Pricing','/pricing'],['Docs','/docs'],['vs TestRail','/vs/testrail'],['vs TestRigor','/vs/testrigour'],['Privacy','/legal/privacy'],['Terms','/legal/terms']] as [string,string][]).map(([l,h]) => (
              <Link key={h} href={h} style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>{l}</Link>
            ))}
          </div>
          <a href="https://continuous.engineering" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>
            continuous.engineering ↗
          </a>
        </div>
      </footer>
    </div>
  )
}
