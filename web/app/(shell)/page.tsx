export const dynamic = 'force-dynamic'

export default function DashboardPage() {
  return (
    <div className="p-6">
      <h1 className="text-title" style={{ color: 'var(--ct-text-1)' }}>Dashboard</h1>
      <p className="text-body mt-1" style={{ color: 'var(--ct-text-2)' }}>
        Run health, flaky tests, and coverage — coming in B09.
      </p>
    </div>
  )
}
