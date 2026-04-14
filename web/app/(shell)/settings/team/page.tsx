export const dynamic = 'force-dynamic'
export default function Page() {
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--ct-text-1)', marginBottom: 8 }}>
        Coming in next release
      </h1>
      <p style={{ fontSize: 14, color: 'var(--ct-text-2)', maxWidth: 500, lineHeight: 1.6 }}>
        Jira · GitHub Issues · Linear sync and team management are in the backlog (B10 issues hub adapters).
        In the meantime, use the API directly — see the docs.
      </p>
    </div>
  )
}
