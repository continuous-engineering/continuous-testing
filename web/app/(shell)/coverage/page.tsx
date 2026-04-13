'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'

type CoverageSpec = {
  spec_id: string
  spec_name: string
  project_id: string
  coverage_pct: string
  covered_count: number
  uncovered_count: number
  endpoint_details: { path: string; method: string; covered: boolean; step_ids: string[] }[]
  computed_at: string
}

export default function CoveragePage() {
  const [specs, setSpecs] = useState<CoverageSpec[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/coverage')
      .then((r) => r.json())
      .then((d) => { setSpecs((d as { data: CoverageSpec[] }).data ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const activeSpec = specs.find((s) => s.spec_id === selected) ?? specs[0]

  return (
    <div className="p-6 flex flex-col gap-4 max-w-5xl">
      <h1 className="text-title" style={{ color: 'var(--ct-text-1)' }}>API Coverage</h1>

      {loading && <p className="text-body" style={{ color: 'var(--ct-text-2)' }}>Loading…</p>}

      {!loading && specs.length === 0 && (
        <p className="text-body" style={{ color: 'var(--ct-text-2)' }}>
          No OpenAPI specs imported yet. Import a spec in project settings to see coverage.
        </p>
      )}

      {/* Spec selector */}
      {specs.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {specs.map((spec) => (
            <button
              key={spec.spec_id}
              onClick={() => setSelected(spec.spec_id)}
              className="text-label px-3 py-1.5 rounded-md border transition-colors"
              style={{
                borderColor: selected === spec.spec_id ? 'var(--ct-accent-500)' : 'var(--ct-border)',
                color: selected === spec.spec_id ? 'var(--ct-accent-400)' : 'var(--ct-text-2)',
                background: 'var(--ct-surface)',
              }}
            >
              {spec.spec_name}
            </button>
          ))}
        </div>
      )}

      {activeSpec && (
        <>
          {/* Coverage summary */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: 'var(--ct-border)' }}>
              <div
                style={{
                  width: `${activeSpec.coverage_pct}%`,
                  background: parseFloat(activeSpec.coverage_pct) >= 80
                    ? 'var(--ct-pass)'
                    : parseFloat(activeSpec.coverage_pct) >= 50
                    ? 'var(--ct-flaky)'
                    : 'var(--ct-fail)',
                  height: '100%',
                  transition: 'width 0.3s',
                }}
              />
            </div>
            <span className="text-title font-semibold" style={{ color: 'var(--ct-text-1)' }}>
              {activeSpec.coverage_pct}%
            </span>
            <span className="text-body" style={{ color: 'var(--ct-text-2)' }}>
              {activeSpec.covered_count} / {activeSpec.covered_count + activeSpec.uncovered_count} endpoints
            </span>
          </div>

          {/* Endpoint list */}
          <div className="rounded-md border overflow-hidden" style={{ borderColor: 'var(--ct-border)' }}>
            {/* Header */}
            <div
              className="flex items-center px-3 border-b"
              style={{ height: 'var(--ct-row-h)', borderColor: 'var(--ct-border)', background: 'var(--ct-surface)' }}
            >
              <span className="text-label uppercase tracking-wide w-20" style={{ color: 'var(--ct-text-3)' }}>Method</span>
              <span className="text-label uppercase tracking-wide flex-1" style={{ color: 'var(--ct-text-3)' }}>Path</span>
              <span className="text-label uppercase tracking-wide w-24 text-right" style={{ color: 'var(--ct-text-3)' }}>Coverage</span>
            </div>

            {activeSpec.endpoint_details?.map((ep) => (
              <div
                key={`${ep.method}-${ep.path}`}
                className="ct-row"
              >
                <span
                  className="text-label font-mono w-20 flex-shrink-0"
                  style={{ color: ep.covered ? 'var(--ct-text-2)' : 'var(--ct-text-3)' }}
                >
                  {ep.method}
                </span>
                <span
                  className="text-mono flex-1 truncate"
                  style={{ color: ep.covered ? 'var(--ct-text-1)' : 'var(--ct-text-3)' }}
                >
                  {ep.path}
                </span>
                <div className="w-24 flex justify-end">
                  {ep.covered ? (
                    <span className="text-label" style={{ color: 'var(--ct-pass)' }}>✓ Tested</span>
                  ) : (
                    <span className="text-label" style={{ color: 'var(--ct-fail)' }}>✗ Gap</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
