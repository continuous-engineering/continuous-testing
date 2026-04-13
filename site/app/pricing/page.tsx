import Link from 'next/link'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.continuous.testing'

const PLANS = [
  {
    name: 'Starter',
    price: '$0',
    period: '/month',
    desc: 'For individual QA engineers and small teams.',
    features: [
      '500 hosted runner minutes/month',
      '3 projects',
      'Unlimited pipelines',
      'API + UI + AI steps',
      'GitHub Actions integration',
      'Community support',
    ],
    cta: 'Start free',
    ctaHref: `${APP_URL}/login`,
    highlight: false,
  },
  {
    name: 'Team',
    price: '$49',
    period: '/month',
    desc: 'For growing teams that need more scale and integrations.',
    features: [
      '5,000 hosted runner minutes/month',
      'Unlimited projects',
      'Self-hosted runners',
      'Jira · GitHub Issues · Linear sync',
      'Slack notifications',
      'Coverage tracking',
      'Priority support',
    ],
    cta: 'Start Team trial',
    ctaHref: `${APP_URL}/login?plan=team`,
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    desc: 'For organisations with compliance, SSO, and dedicated infrastructure needs.',
    features: [
      'Unlimited hosted runner minutes',
      'SAML SSO',
      'Audit log',
      'SLA guarantee',
      'Dedicated onboarding',
      'Custom integrations',
      'On-prem deployment option',
    ],
    cta: 'Contact us',
    ctaHref: 'mailto:hello@continuous.engineering',
    highlight: false,
  },
]

export default function PricingPage() {
  return (
    <div style={{ background: 'var(--ct-bg)', minHeight: '100vh' }}>
      <nav className="flex items-center justify-between px-8 py-4 border-b" style={{ borderColor: 'var(--ct-border)' }}>
        <Link href="/" className="font-semibold text-base" style={{ color: 'var(--ct-accent)' }}>continuous.testing</Link>
        <a href={`${APP_URL}/login`} className="text-sm font-medium px-4 py-2 rounded-md" style={{ background: 'var(--ct-accent)', color: '#fff' }}>
          Get started →
        </a>
      </nav>

      <section className="px-8 py-20 text-center">
        <h1 className="text-4xl font-bold mb-4" style={{ color: 'var(--ct-text-1)', letterSpacing: '-0.03em' }}>Simple pricing</h1>
        <p className="text-lg" style={{ color: 'var(--ct-text-2)' }}>Start free. Scale when you need to. No surprise bills.</p>
      </section>

      <section className="px-8 pb-20 max-w-5xl mx-auto">
        <div className="grid grid-cols-3 gap-6">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className="rounded-xl border p-6 flex flex-col"
              style={{
                borderColor: plan.highlight ? 'var(--ct-accent)' : 'var(--ct-border)',
                background: plan.highlight ? 'var(--ct-accent)11' : 'var(--ct-surface)',
              }}
            >
              {plan.highlight && (
                <span className="text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded self-start mb-3"
                  style={{ background: 'var(--ct-accent)22', color: 'var(--ct-accent)' }}>Most popular</span>
              )}
              <h2 className="text-xl font-semibold mb-1" style={{ color: 'var(--ct-text-1)' }}>{plan.name}</h2>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-3xl font-bold" style={{ color: 'var(--ct-text-1)' }}>{plan.price}</span>
                <span className="text-sm" style={{ color: 'var(--ct-text-3)' }}>{plan.period}</span>
              </div>
              <p className="text-sm mb-6" style={{ color: 'var(--ct-text-2)' }}>{plan.desc}</p>
              <ul className="flex flex-col gap-2 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm" style={{ color: 'var(--ct-text-2)' }}>
                    <span style={{ color: 'var(--ct-accent)', flexShrink: 0 }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href={plan.ctaHref}
                className="text-sm font-semibold px-4 py-2.5 rounded-lg text-center"
                style={{
                  background: plan.highlight ? 'var(--ct-accent)' : 'var(--ct-surface-raised, #1c1c26)',
                  color: plan.highlight ? '#fff' : 'var(--ct-text-1)',
                  border: plan.highlight ? 'none' : '1px solid var(--ct-border)',
                }}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>

        {/* Overage note */}
        <p className="text-sm text-center mt-8" style={{ color: 'var(--ct-text-3)' }}>
          Team plan overages billed at $0.01/hosted runner minute.
          Self-hosted runners are always free — use your own infrastructure.
        </p>
      </section>
    </div>
  )
}
