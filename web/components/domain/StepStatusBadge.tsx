import { cn } from '@/lib/utils'

export type StepStatus = 'passed' | 'failed' | 'flaky' | 'running' | 'skipped' | 'blocked' | 'pending'

const STATUS_MAP: Record<StepStatus, { label: string; dot: string; text: string }> = {
  passed:  { label: 'Passed',  dot: 'bg-[var(--ct-pass)]',                          text: 'text-emerald-400' },
  failed:  { label: 'Failed',  dot: 'bg-[var(--ct-fail)]',                          text: 'text-rose-400'    },
  flaky:   { label: 'Flaky',   dot: 'bg-[var(--ct-flaky)]',                         text: 'text-amber-400'   },
  running: { label: 'Running', dot: 'bg-[var(--ct-running)] animate-pulse',         text: 'text-sky-400'     },
  skipped: { label: 'Skipped', dot: 'bg-[var(--ct-skipped)]',                       text: 'text-slate-400'   },
  blocked: { label: 'Blocked', dot: 'bg-[var(--ct-blocked)]',                       text: 'text-purple-400'  },
  pending: { label: 'Pending', dot: 'bg-[var(--ct-border)]',                        text: 'text-[var(--ct-text-3)]' },
}

type Props = {
  status: StepStatus
  showLabel?: boolean
  className?: string
}

export function StepStatusBadge({ status, showLabel = true, className }: Props) {
  const { label, dot, text } = STATUS_MAP[status]
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', dot)} aria-hidden />
      {showLabel && (
        <span className={cn('text-label font-medium tabular-nums', text)}>{label}</span>
      )}
      <span className="sr-only">{label}</span>
    </span>
  )
}
