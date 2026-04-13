export const dynamic = 'force-dynamic'

import { SignIn } from '@clerk/nextjs'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--ct-bg)' }}>
      <div className="flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-2">
          <span className="text-title" style={{ color: 'var(--ct-accent-500)' }}>
            continuous.testing
          </span>
          <span className="text-body" style={{ color: 'var(--ct-text-2)' }}>
            API · UI · AI — unified test management
          </span>
        </div>
        <SignIn />
      </div>
    </div>
  )
}
