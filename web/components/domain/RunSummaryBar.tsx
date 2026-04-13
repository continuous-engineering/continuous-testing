'use client'
import { cn } from '@/lib/utils'

type Props = {
  passed: number
  failed: number
  skipped: number
  running: number
  total: number
  className?: string
}

export function RunSummaryBar({ passed, failed, skipped, running, total, className }: Props) {
  const pct = (n: number) => total > 0 ? `${((n / total) * 100).toFixed(0)}%` : '0%'

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--ct-border)' }}>
        {passed  > 0 && <div style={{ width: pct(passed),  background: 'var(--ct-pass)' }} />}
        {failed  > 0 && <div style={{ width: pct(failed),  background: 'var(--ct-fail)' }} />}
        {skipped > 0 && <div style={{ width: pct(skipped), background: 'var(--ct-skipped)' }} />}
        {running > 0 && <div style={{ width: pct(running), background: 'var(--ct-running)' }} className="animate-pulse" />}
      </div>
      <div className="flex gap-3 text-caption" style={{ color: 'var(--ct-text-3)' }}>
        {passed  > 0 && <span style={{ color: 'var(--ct-pass)' }}>{passed} passed</span>}
        {failed  > 0 && <span style={{ color: 'var(--ct-fail)' }}>{failed} failed</span>}
        {skipped > 0 && <span>{skipped} skipped</span>}
        {running > 0 && <span style={{ color: 'var(--ct-running)' }}>{running} running</span>}
        <span>{total} total</span>
      </div>
    </div>
  )
}
