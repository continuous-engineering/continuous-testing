'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DenseTable, type Column } from '@/components/data/DenseTable'
import { StepStatusBadge, type StepStatus } from '@/components/domain/StepStatusBadge'
import { RunSummaryBar } from '@/components/domain/RunSummaryBar'

type Run = { id:string; status:StepStatus; trigger:string; pipeline_name:string; project_name:string; pipeline_id:string; project_id:string; total_steps:number; passed_steps:number; failed_steps:number; skipped_steps:number; created_at:string }

export default function RunsPage() {
  const router = useRouter()
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard').then(r => r.json())
      .then((d: { data?: { recentRuns: Run[] } }) => { setRuns(d.data?.recentRuns ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const cols: Column<Run>[] = [
    { key:'s', header:'', width:'w-20', render:r => <StepStatusBadge status={r.status} /> },
    { key:'p', header:'Pipeline', width:'flex-1', render:r => <div><div style={{fontWeight:500,color:'var(--ct-text-1)',fontSize:14}}>{r.pipeline_name}</div><div style={{fontSize:12,color:'var(--ct-text-3)'}}>{r.project_name}</div></div> },
    { key:'r', header:'Result', width:'w-48', render:r => <RunSummaryBar passed={r.passed_steps} failed={r.failed_steps} skipped={r.skipped_steps} running={0} total={r.total_steps} /> },
    { key:'t', header:'Trigger', width:'w-20', render:r => <span style={{color:'var(--ct-text-3)',fontSize:12}}>{r.trigger}</span> },
  ]

  return (
    <div style={{ padding:24, maxWidth:960 }}>
      <h1 style={{ fontSize:20, fontWeight:600, color:'var(--ct-text-1)', marginBottom:24 }}>Recent Runs</h1>
      <div style={{ border:'1px solid var(--ct-border)', borderRadius:8, overflow:'hidden' }}>
        <DenseTable columns={cols} rows={runs} getKey={r=>r.id}
          onRowClick={r => router.push(`/projects/${r.project_id}/pipelines/${r.pipeline_id}`)}
          emptyMessage={loading ? 'Loading…' : 'No runs yet. Trigger a pipeline to start.'} />
      </div>
    </div>
  )
}
