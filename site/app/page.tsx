import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'continuous.testing — API · UI · AI test management',
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.continuous.testing'

// ── Data ──────────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: '⚡',
    title: 'API Testing',
    desc: 'Full HTTP client with assertion builder, JSONPath extraction, and environment-based variable substitution. Import from OpenAPI spec or HAR in seconds.',
  },
  {
    icon: '🖥',
    title: 'UI Testing',
    desc: 'Playwright Chromium — built in, no setup. Browser recorder captures intent, not DOM coordinates. Self-healing selectors try ARIA → testid → text → CSS.',
  },
  {
    icon: '🤖',
    title: 'AI Testing',
    desc: 'Semantic assertions powered by Claude. Test that your LLM responses are meaningfully correct — not just exact string matches. Threshold-based scoring.',
  },
  {
    icon: '🔗',
    title: 'Unified Pipeline',
    desc: 'API call → UI step → AI assertion in a single pipeline. Steps share context — extract a token in step 1, inject it into step 2 automatically.',
  },
  {
    icon: '🐳',
    title: 'Stateless Runners',
    desc: 'Docker containers poll for work. Deploy anywhere — your cloud, your network, on-prem. Tags route jobs to the right runner. One DAG, one runner, no shared state.',
  },
  {
    icon: '🧠',
    title: 'AI Test Generation',
    desc: 'Point at a git repo. Claude reads your routes, components, and schemas, identifies user journeys, and scaffolds a full test suite. From zero to coverage in minutes.',
  },
]

const DIFFERENTIATORS = [
  { label: 'Self-healing selectors', sub: 'ARIA-first, CSS last resort' },
  { label: 'No LLM testing tool does this', sub: 'Semantic assertions + threshold scoring' },
  { label: 'Git repo → test suite', sub: 'Claude analyzes your codebase' },
  { label: 'Postgres-native queue', sub: 'No Redis, no extra infra' },
  { label: 'Bidirectional issue sync', sub: 'Jira · GitHub · Linear' },
  { label: 'Coverage gap detection', sub: 'OpenAPI spec vs test suite' },
]

// ── Pipeline demo (static SVG) ────────────────────────────────────────────────

function PipelineDemo() {
  const steps = [
    { label: 'GET /api/auth', type: 'API', color: '#10b981' },
    { label: 'UI: login flow', type: 'UI',  color: '#0ea5e9' },
    { label: 'AI: verify copy', type: 'AI', color: '#8b5cf6' },
  ]

  return (
    <div className="flex flex-col items-center gap-0 w-full max-w-sm">
      {steps.map((step, i) => (
        <div key={step.label} className="flex flex-col items-center w-full">
          <div
            className="flex items-center gap-3 w-full px-4 py-3 rounded-lg border"
            style={{ borderColor: step.color + '44', background: step.color + '11' }}
          >
            <span
              className="text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0"
              style={{ background: step.color + '22', color: step.color }}
            >
              {step.type}
            </span>
            <span className="text-sm font-mono" style={{ color: '#f0f0f6' }}>{step.label}</span>
            <span className="ml-auto text-xs" style={{ color: step.color }}>✓ PASSED</span>
          </div>
          {i < steps.length - 1 && (
            <div className="flex flex-col items-center gap-0.5 py-1.5">
              <div className="w-px h-3" style={{ background: '#2a2a3a' }} />
              <span className="text-xs" style={{ color: '#52526a' }}>ctx.token →</span>
              <div className="w-px h-3" style={{ background: '#2a2a3a' }} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div style={{ background: 'var(--ct-bg)', minHeight: '100vh' }}>
      {/* Nav */}
      <nav
        className="flex items-center justify-between px-8 py-4 border-b sticky top-0 z-50"
        style={{ borderColor: 'var(--ct-border)', background: 'var(--ct-bg)', backdropFilter: 'blur(12px)' }}
      >
        <span className="font-semibold text-base" style={{ color: 'var(--ct-accent)' }}>
          continuous.testing
        </span>
        <div className="flex items-center gap-6">
          <Link href="/features" className="text-sm" style={{ color: 'var(--ct-text-2)' }}>Features</Link>
          <Link href="/pricing"  className="text-sm" style={{ color: 'var(--ct-text-2)' }}>Pricing</Link>
          <Link href="/docs"     className="text-sm" style={{ color: 'var(--ct-text-2)' }}>Docs</Link>
          <a
            href={`${APP_URL}/login`}
            className="text-sm font-medium px-4 py-2 rounded-md"
            style={{ background: 'var(--ct-accent)', color: '#fff' }}
          >
            Get started →
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center text-center px-6 pt-24 pb-20">
        <span
          className="text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full border mb-6"
          style={{ borderColor: 'var(--ct-accent)' + '44', color: 'var(--ct-accent)', background: 'var(--ct-accent)' + '11' }}
        >
          continuous.engineering · 4th product
        </span>

        <h1
          className="text-5xl font-bold mb-6 max-w-3xl leading-tight"
          style={{ color: 'var(--ct-text-1)', letterSpacing: '-0.03em' }}
        >
          API · UI · AI testing<br />
          <span style={{ color: 'var(--ct-accent)' }}>in a single pipeline.</span>
        </h1>

        <p className="text-xl max-w-2xl mb-10 leading-relaxed" style={{ color: 'var(--ct-text-2)' }}>
          The only test platform where a REST call, a browser interaction, and a semantic AI assertion
          run as one connected flow — sharing context, one runner, one result.
        </p>

        <div className="flex items-center gap-4 mb-16">
          <a
            href={`${APP_URL}/login`}
            className="text-base font-semibold px-6 py-3 rounded-lg"
            style={{ background: 'var(--ct-accent)', color: '#fff' }}
          >
            Start free →
          </a>
          <Link href="/docs/getting-started" className="text-base" style={{ color: 'var(--ct-text-2)' }}>
            Read the docs
          </Link>
        </div>

        {/* Live pipeline demo */}
        <div
          className="rounded-xl border p-8 w-full max-w-sm"
          style={{ borderColor: 'var(--ct-border)', background: 'var(--ct-surface)' }}
        >
          <p className="text-xs uppercase tracking-widest mb-4" style={{ color: 'var(--ct-text-3)' }}>
            Live pipeline run
          </p>
          <PipelineDemo />
          <p className="text-xs mt-4" style={{ color: 'var(--ct-text-3)' }}>
            ctx.token extracted in step 1 — injected into steps 2 and 3 automatically
          </p>
        </div>
      </section>

      {/* Features grid */}
      <section className="px-8 py-20 max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12" style={{ color: 'var(--ct-text-1)', letterSpacing: '-0.02em' }}>
          Everything a QA manager actually needs
        </h2>
        <div className="grid grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border p-6"
              style={{ borderColor: 'var(--ct-border)', background: 'var(--ct-surface)' }}
            >
              <div className="text-2xl mb-3">{f.icon}</div>
              <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--ct-text-1)' }}>{f.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--ct-text-2)' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Differentiators */}
      <section
        className="px-8 py-20 border-t border-b"
        style={{ borderColor: 'var(--ct-border)', background: 'var(--ct-surface)' }}
      >
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold mb-12 text-center" style={{ color: 'var(--ct-text-1)', letterSpacing: '-0.02em' }}>
            What nobody else does
          </h2>
          <div className="grid grid-cols-2 gap-6">
            {DIFFERENTIATORS.map((d) => (
              <div key={d.label} className="flex items-start gap-3">
                <span style={{ color: 'var(--ct-accent)', flexShrink: 0, marginTop: '2px' }}>✦</span>
                <div>
                  <p className="text-base font-medium" style={{ color: 'var(--ct-text-1)' }}>{d.label}</p>
                  <p className="text-sm" style={{ color: 'var(--ct-text-3)' }}>{d.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-8 py-24 text-center">
        <h2 className="text-3xl font-bold mb-4" style={{ color: 'var(--ct-text-1)', letterSpacing: '-0.02em' }}>
          Ready to replace TestRail?
        </h2>
        <p className="text-lg mb-10" style={{ color: 'var(--ct-text-2)' }}>
          Import your OpenAPI spec. Get a test suite in 30 seconds.
        </p>
        <a
          href={`${APP_URL}/login`}
          className="text-base font-semibold px-8 py-4 rounded-lg"
          style={{ background: 'var(--ct-accent)', color: '#fff' }}
        >
          Start free — no credit card
        </a>
      </section>

      {/* Footer */}
      <footer
        className="px-8 py-8 border-t flex items-center justify-between"
        style={{ borderColor: 'var(--ct-border)', color: 'var(--ct-text-3)' }}
      >
        <span className="text-sm" style={{ color: 'var(--ct-accent)' }}>continuous.testing</span>
        <div className="flex gap-6 text-sm">
          <Link href="/privacy" style={{ color: 'var(--ct-text-3)' }}>Privacy</Link>
          <Link href="/terms"   style={{ color: 'var(--ct-text-3)' }}>Terms</Link>
          <a href="https://continuous.engineering" style={{ color: 'var(--ct-text-3)' }}>continuous.engineering ↗</a>
        </div>
      </footer>
    </div>
  )
}
