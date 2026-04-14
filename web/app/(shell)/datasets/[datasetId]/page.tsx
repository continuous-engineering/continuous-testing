'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useProjectPicker } from '@/lib/hooks/useProjectPicker'

// ── Types ────────────────────────────────────────────────────────────────────

type ColType = 'text' | 'number' | 'boolean' | 'json'

type ColDef = {
  key:   string
  label: string
  type:  ColType
  width?: number   // px
}

type Schema = { columns: ColDef[] }

type Row = { id: string; row_index: number; data: Record<string, unknown> }

type Dataset = {
  id: string; name: string; description: string | null
  schema_json: Schema; row_count: number
  rows: Row[]
}

// ── Constants ────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<ColType, string> = {
  text: 'Text', number: 'Number', boolean: 'Boolean', json: 'JSON object',
}

const DEFAULT_COL_WIDTH = 160

// ── Cell editors ─────────────────────────────────────────────────────────────

function CellInput({ col, value, onChange, onJsonOpen }: {
  col: ColDef; value: unknown
  onChange: (v: unknown) => void
  onJsonOpen: () => void
}) {
  const s: React.CSSProperties = {
    width: '100%', height: '100%', padding: '0 8px', border: 'none', outline: 'none',
    background: 'transparent', color: 'var(--ct-text-1)', fontSize: 13, fontFamily: 'inherit',
  }

  if (col.type === 'boolean') {
    return (
      <input type="checkbox" checked={!!value}
        onChange={e => onChange(e.target.checked)}
        style={{ margin: 'auto', display: 'block' }} />
    )
  }

  if (col.type === 'json') {
    const preview = value == null ? '—'
      : typeof value === 'object' ? (Array.isArray(value) ? `[${(value as unknown[]).length}]` : `{${Object.keys(value as object).join(', ')}}`)
      : String(value)
    return (
      <button onClick={onJsonOpen}
        style={{ ...s, textAlign: 'left', cursor: 'pointer', color: 'var(--ct-accent-400)', textDecoration: 'underline' }}>
        {preview}
      </button>
    )
  }

  if (col.type === 'number') {
    return (
      <input type="number" value={value == null ? '' : String(value)}
        onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
        style={{ ...s, fontVariantNumeric: 'tabular-nums' }} />
    )
  }

  return (
    <input type="text" value={value == null ? '' : String(value)}
      onChange={e => onChange(e.target.value)}
      style={s} />
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function DatasetPage() {
  const { datasetId } = useParams<{ datasetId: string }>()
  const router  = useRouter()
  const { projectId } = useProjectPicker()

  const [dataset,  setDataset]  = useState<Dataset | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [dirty,    setDirty]    = useState<Record<string, Record<string, unknown>>>({}) // rowId → dirty data
  const [saving,   setSaving]   = useState<Record<string, boolean>>({})

  // Add column form
  const [showAddCol,  setShowAddCol]  = useState(false)
  const [newColLabel, setNewColLabel] = useState('')
  const [newColType,  setNewColType]  = useState<ColType>('text')

  // JSON side panel
  const [jsonPanel, setJsonPanel] = useState<{ rowId: string; colKey: string; value: string } | null>(null)
  const [jsonError, setJsonError] = useState('')

  // Rename / description
  const [editingMeta, setEditingMeta] = useState(false)
  const [metaName,    setMetaName]    = useState('')
  const [metaDesc,    setMetaDesc]    = useState('')

  const load = useCallback(async () => {
    if (!datasetId) return
    setLoading(true)
    const res = await fetch(`/api/projects/${projectId || '_'}/datasets/${datasetId}`)
    const d   = await res.json() as { data: Dataset }
    setDataset(d.data)
    setLoading(false)
  }, [datasetId, projectId])

  useEffect(() => { if (projectId) void load() }, [projectId, load])

  const schema: Schema = dataset?.schema_json ?? { columns: [] }
  const columns = schema.columns ?? []

  // ── Row operations ──────────────────────────────────────────────────────────

  function cellValue(row: Row, colKey: string): unknown {
    return dirty[row.id]?.[colKey] !== undefined
      ? dirty[row.id]?.[colKey]
      : row.data[colKey]
  }

  function setCell(rowId: string, colKey: string, value: unknown) {
    setDirty(d => ({ ...d, [rowId]: { ...(d[rowId] ?? {}), [colKey]: value } }))
  }

  async function saveRow(row: Row) {
    if (!dirty[row.id]) return
    setSaving(s => ({ ...s, [row.id]: true }))
    const merged = { ...row.data, ...dirty[row.id] }
    await fetch(`/api/projects/${projectId}/datasets/${datasetId}/rows/${row.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: merged }),
    })
    setSaving(s => ({ ...s, [row.id]: false }))
    setDirty(d => { const n = { ...d }; delete n[row.id]; return n })
    void load()
  }

  async function addRow() {
    const empty: Record<string, unknown> = {}
    for (const col of columns) empty[col.key] = col.type === 'boolean' ? false : col.type === 'number' ? null : col.type === 'json' ? {} : ''
    await fetch(`/api/projects/${projectId}/datasets/${datasetId}/rows`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: [empty] }),
    })
    void load()
  }

  async function deleteRow(rowId: string) {
    await fetch(`/api/projects/${projectId}/datasets/${datasetId}/rows/${rowId}`, { method: 'DELETE' })
    void load()
  }

  // ── Column operations ───────────────────────────────────────────────────────

  async function addColumn() {
    if (!newColLabel.trim()) return
    const key = newColLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
    if (columns.find(c => c.key === key)) { alert('Column key already exists'); return }
    const newCol: ColDef = { key, label: newColLabel.trim(), type: newColType, width: DEFAULT_COL_WIDTH }
    const newSchema: Schema = { columns: [...columns, newCol] }
    await fetch(`/api/projects/${projectId}/datasets/${datasetId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schema_json: newSchema }),
    })
    setNewColLabel(''); setShowAddCol(false)
    void load()
  }

  async function deleteColumn(key: string) {
    if (!confirm(`Delete column "${key}"? Data in this column will be lost from all rows.`)) return
    const newSchema: Schema = { columns: columns.filter(c => c.key !== key) }
    await fetch(`/api/projects/${projectId}/datasets/${datasetId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schema_json: newSchema }),
    })
    void load()
  }

  // ── JSON panel ──────────────────────────────────────────────────────────────

  function openJson(row: Row, col: ColDef) {
    const v = cellValue(row, col.key)
    setJsonPanel({ rowId: row.id, colKey: col.key, value: JSON.stringify(v ?? {}, null, 2) })
    setJsonError('')
  }

  function applyJson() {
    if (!jsonPanel) return
    try {
      const parsed = JSON.parse(jsonPanel.value)
      setCell(jsonPanel.rowId, jsonPanel.colKey, parsed)
      setJsonPanel(null)
    } catch { setJsonError('Invalid JSON') }
  }

  // ── Meta edit ───────────────────────────────────────────────────────────────

  async function saveMeta() {
    await fetch(`/api/projects/${projectId}/datasets/${datasetId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: metaName || undefined, description: metaDesc || undefined }),
    })
    setEditingMeta(false)
    void load()
  }

  async function deleteDataset() {
    if (!confirm(`Delete dataset "${dataset?.name}"? All rows will be permanently lost.`)) return
    await fetch(`/api/projects/${projectId}/datasets/${datasetId}`, { method: 'DELETE' })
    router.push('/datasets')
  }

  if (loading || !dataset) return <div className="p-6 text-body" style={{ color: 'var(--ct-text-2)' }}>Loading…</div>

  const rows = dataset.rows ?? []

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b flex-shrink-0"
        style={{ borderColor: 'var(--ct-border)', background: 'var(--ct-surface)' }}>
        <div className="flex flex-col gap-0.5">
          {editingMeta ? (
            <div className="flex items-center gap-2">
              <input value={metaName} onChange={e => setMetaName(e.target.value)}
                className="text-heading px-2 py-1 rounded border"
                style={{ background: 'var(--ct-surface-raised)', borderColor: 'var(--ct-border)', color: 'var(--ct-text-1)', outline: 'none' }} />
              <input value={metaDesc} onChange={e => setMetaDesc(e.target.value)}
                placeholder="Description"
                className="text-body px-2 py-1 rounded border w-64"
                style={{ background: 'var(--ct-surface-raised)', borderColor: 'var(--ct-border)', color: 'var(--ct-text-1)', outline: 'none' }} />
              <button onClick={saveMeta}
                className="text-label px-2 py-1 rounded"
                style={{ background: 'var(--ct-accent-500)', color: '#fff' }}>Save</button>
              <button onClick={() => setEditingMeta(false)}
                className="text-label px-2 py-1 rounded border"
                style={{ borderColor: 'var(--ct-border)', color: 'var(--ct-text-2)' }}>Cancel</button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-heading font-semibold" style={{ color: 'var(--ct-text-1)' }}>{dataset.name}</span>
              {dataset.description && (
                <span className="text-caption" style={{ color: 'var(--ct-text-3)' }}>{dataset.description}</span>
              )}
              <button onClick={() => { setMetaName(dataset.name); setMetaDesc(dataset.description ?? ''); setEditingMeta(true) }}
                className="text-caption px-1.5 py-0.5 rounded"
                style={{ color: 'var(--ct-text-3)', background: 'var(--ct-surface-overlay)' }}>
                ✎ Edit
              </button>
            </div>
          )}
          <span className="text-caption" style={{ color: 'var(--ct-text-3)' }}>
            {rows.length} row{rows.length !== 1 ? 's' : ''} · {columns.length} column{columns.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => router.push('/datasets')}
            className="text-caption" style={{ color: 'var(--ct-text-3)' }}>← Datasets</button>
          <button onClick={deleteDataset}
            className="text-caption px-2 py-1 rounded border"
            style={{ borderColor: 'var(--ct-fail)', color: 'var(--ct-fail)' }}>Delete</button>
        </div>
      </div>

      {/* Grid + JSON panel side by side */}
      <div className="flex flex-1 overflow-hidden">
        {/* Spreadsheet grid */}
        <div className="flex-1 overflow-auto">
          <table style={{ borderCollapse: 'collapse', minWidth: '100%', tableLayout: 'fixed' }}>
            {/* Column headers */}
            <thead>
              <tr style={{ background: 'var(--ct-surface)', borderBottom: '2px solid var(--ct-border)' }}>
                {/* Row number */}
                <th style={{ width: 40, minWidth: 40, padding: '6px 8px', textAlign: 'right',
                  color: 'var(--ct-text-3)', fontSize: 11, fontWeight: 400,
                  borderRight: '1px solid var(--ct-border)', position: 'sticky', left: 0,
                  background: 'var(--ct-surface)', zIndex: 1 }}>#</th>

                {columns.map((col) => (
                  <th key={col.key}
                    style={{ width: col.width ?? DEFAULT_COL_WIDTH, minWidth: 80, padding: '6px 8px',
                      textAlign: 'left', fontWeight: 600, fontSize: 12,
                      color: 'var(--ct-text-2)', borderRight: '1px solid var(--ct-border)',
                      userSelect: 'none', whiteSpace: 'nowrap' }}>
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate">{col.label}</span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span style={{ fontSize: 10, color: 'var(--ct-text-3)', fontWeight: 400 }}>
                          {col.type}
                        </span>
                        <button onClick={() => deleteColumn(col.key)}
                          style={{ color: 'var(--ct-text-3)', fontSize: 10, lineHeight: 1, cursor: 'pointer',
                            background: 'none', border: 'none', padding: '0 2px' }}
                          title="Delete column">✕</button>
                      </div>
                    </div>
                  </th>
                ))}

                {/* Add column */}
                <th style={{ width: 120, padding: '6px 8px' }}>
                  {showAddCol ? (
                    <div className="flex items-center gap-1">
                      <input autoFocus value={newColLabel}
                        onChange={e => setNewColLabel(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addColumn()}
                        placeholder="Name"
                        style={{ width: 80, fontSize: 12, padding: '2px 4px', border: '1px solid var(--ct-border)',
                          borderRadius: 4, background: 'var(--ct-surface-raised)', color: 'var(--ct-text-1)', outline: 'none' }} />
                      <select value={newColType} onChange={e => setNewColType(e.target.value as ColType)}
                        style={{ fontSize: 11, padding: '2px 2px', border: '1px solid var(--ct-border)',
                          borderRadius: 4, background: 'var(--ct-surface-raised)', color: 'var(--ct-text-1)' }}>
                        {(Object.keys(TYPE_LABELS) as ColType[]).map(t => (
                          <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                        ))}
                      </select>
                      <button onClick={addColumn}
                        style={{ fontSize: 11, padding: '2px 6px', background: 'var(--ct-accent-500)', color: '#fff',
                          border: 'none', borderRadius: 4, cursor: 'pointer' }}>✓</button>
                      <button onClick={() => setShowAddCol(false)}
                        style={{ fontSize: 11, padding: '2px 4px', color: 'var(--ct-text-3)',
                          background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                    </div>
                  ) : (
                    <button onClick={() => setShowAddCol(true)}
                      style={{ fontSize: 12, color: 'var(--ct-accent-400)', background: 'none',
                        border: '1px dashed var(--ct-border)', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}>
                      + Column
                    </button>
                  )}
                </th>
              </tr>
            </thead>

            {/* Rows */}
            <tbody>
              {rows.map((row) => {
                const isDirty = !!dirty[row.id] && Object.keys(dirty[row.id] ?? {}).length > 0
                return (
                  <tr key={row.id}
                    style={{ borderBottom: '1px solid var(--ct-border)',
                      background: isDirty ? 'rgba(16,185,129,0.04)' : 'var(--ct-bg)' }}>
                    {/* Row number + actions */}
                    <td style={{ width: 40, minWidth: 40, padding: '0 4px', textAlign: 'right', fontSize: 11,
                      color: 'var(--ct-text-3)', borderRight: '1px solid var(--ct-border)',
                      position: 'sticky', left: 0, background: isDirty ? 'rgba(16,185,129,0.04)' : 'var(--ct-surface)',
                      zIndex: 1, height: 36, verticalAlign: 'middle', userSelect: 'none' }}>
                      <div className="flex items-center justify-end gap-1">
                        {isDirty ? (
                          <button onClick={() => saveRow(row)}
                            disabled={saving[row.id]}
                            style={{ fontSize: 9, padding: '1px 4px', background: 'var(--ct-accent-500)',
                              color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer' }}>
                            {saving[row.id] ? '…' : '✓'}
                          </button>
                        ) : (
                          <span style={{ fontSize: 11 }}>{row.row_index + 1}</span>
                        )}
                        <button onClick={() => deleteRow(row.id)}
                          style={{ fontSize: 10, color: 'var(--ct-text-3)', background: 'none',
                            border: 'none', cursor: 'pointer', lineHeight: 1, opacity: 0.6 }}
                          title="Delete row">✕</button>
                      </div>
                    </td>

                    {/* Data cells */}
                    {columns.map((col) => (
                      <td key={col.key}
                        style={{ height: 36, padding: 0, borderRight: '1px solid var(--ct-border)',
                          verticalAlign: 'middle', maxWidth: col.width ?? DEFAULT_COL_WIDTH }}>
                        <CellInput
                          col={col}
                          value={cellValue(row, col.key)}
                          onChange={(v) => setCell(row.id, col.key, v)}
                          onJsonOpen={() => openJson(row, col)}
                        />
                      </td>
                    ))}
                    <td />
                  </tr>
                )
              })}

              {/* Add row */}
              <tr>
                <td colSpan={columns.length + 2} style={{ padding: '4px 8px' }}>
                  <button onClick={addRow}
                    style={{ fontSize: 12, color: 'var(--ct-accent-400)', background: 'none',
                      border: 'none', cursor: 'pointer', padding: '4px 0' }}>
                    + Add row
                  </button>
                </td>
              </tr>
            </tbody>
          </table>

          {columns.length === 0 && (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--ct-text-3)' }}>
              <p style={{ fontSize: 14, marginBottom: 8 }}>No columns yet.</p>
              <p style={{ fontSize: 12 }}>Click "+ Column" above to define your data structure.</p>
            </div>
          )}
        </div>

        {/* JSON side panel */}
        {jsonPanel && (
          <div className="flex flex-col border-l flex-shrink-0"
            style={{ width: 360, borderColor: 'var(--ct-border)', background: 'var(--ct-surface)' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b"
              style={{ borderColor: 'var(--ct-border)' }}>
              <span className="text-heading" style={{ color: 'var(--ct-text-1)' }}>
                JSON editor — <code style={{ fontSize: 12 }}>{jsonPanel.colKey}</code>
              </span>
              <button onClick={() => setJsonPanel(null)} style={{ color: 'var(--ct-text-3)' }}>✕</button>
            </div>
            <div className="flex-1 p-4 flex flex-col gap-3">
              <p className="text-caption" style={{ color: 'var(--ct-text-3)' }}>
                This column stores a JSON object. Nested structures, arrays, and mixed types are all valid.
              </p>
              <textarea
                value={jsonPanel.value}
                onChange={e => { setJsonPanel({ ...jsonPanel, value: e.target.value }); setJsonError('') }}
                rows={16}
                spellCheck={false}
                className="font-mono resize-none rounded-md border flex-1"
                style={{ fontSize: 12, padding: '8px 12px',
                  background: 'var(--ct-surface-raised)', borderColor: jsonError ? 'var(--ct-fail)' : 'var(--ct-border)',
                  color: 'var(--ct-text-1)', outline: 'none' }}
              />
              {jsonError && <p className="text-caption" style={{ color: 'var(--ct-fail)' }}>{jsonError}</p>}
              <div className="flex gap-2">
                <button onClick={applyJson}
                  className="text-label px-3 py-2 rounded-md"
                  style={{ background: 'var(--ct-accent-500)', color: '#fff' }}>
                  Apply
                </button>
                <button onClick={() => setJsonPanel(null)}
                  className="text-label px-3 py-2 rounded-md border"
                  style={{ borderColor: 'var(--ct-border)', color: 'var(--ct-text-2)' }}>
                  Cancel
                </button>
              </div>
              <p className="text-caption" style={{ color: 'var(--ct-text-3)' }}>
                Apply saves to the row buffer. Click ✓ on the row to persist to the database.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
