'use client'
import { cn } from '@/lib/utils'
import { StepStatusBadge, type StepStatus } from './StepStatusBadge'

export type StepType = 'api' | 'ui' | 'ai'

const TYPE_ICONS: Record<StepType, string> = {
  api: '⚡',
  ui:  '🖥',
  ai:  '🤖',
}

const TYPE_LABELS: Record<StepType, string> = {
  api: 'API',
  ui:  'UI',
  ai:  'AI',
}

type Props = {
  id: string
  name: string
  type: StepType
  position: number
  status?: StepStatus
  durationMs?: number
  isEditing?: boolean
  onClick?: () => void
  onDelete?: () => void
}

export function StepCard({ id: _id, name, type, position, status, durationMs, isEditing, onClick, onDelete }: Props) {
  return (
    <div
      className={cn(
        'relative flex items-center gap-3 rounded-md border cursor-pointer transition-colors',
        'px-3 py-2 min-h-[52px]',
        isEditing
          ? 'border-[var(--ct-accent-500)] bg-[var(--ct-surface-raised)]'
          : 'border-[var(--ct-border)] bg-[var(--ct-surface)] hover:bg-[var(--ct-surface-raised)]',
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
    >
      {/* Position number */}
      <span className="text-caption w-5 text-right flex-shrink-0" style={{ color: 'var(--ct-text-3)' }}>
        {position + 1}
      </span>

      {/* Type badge */}
      <span
        className="text-caption font-medium px-1.5 py-0.5 rounded flex-shrink-0"
        style={{ background: 'var(--ct-surface-overlay)', color: 'var(--ct-text-2)' }}
      >
        {TYPE_ICONS[type]} {TYPE_LABELS[type]}
      </span>

      {/* Name */}
      <span className="text-body flex-1 truncate" style={{ color: 'var(--ct-text-1)' }}>
        {name}
      </span>

      {/* Status (shown during/after run) */}
      {status && status !== 'pending' && (
        <StepStatusBadge status={status} />
      )}

      {/* Duration */}
      {durationMs != null && (
        <span className="text-caption flex-shrink-0" style={{ color: 'var(--ct-text-3)' }}>
          {durationMs < 1000 ? `${durationMs}ms` : `${(durationMs / 1000).toFixed(1)}s`}
        </span>
      )}

      {/* Delete */}
      {onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--ct-fail)] hover:text-white transition-all text-caption"
          style={{ color: 'var(--ct-text-3)' }}
          aria-label="Delete step"
        >
          ×
        </button>
      )}
    </div>
  )
}

/** Connector arrow between steps in the pipeline */
export function StepConnector() {
  return (
    <div className="flex items-center justify-center h-5 text-caption" style={{ color: 'var(--ct-text-3)' }}>
      ↓
    </div>
  )
}
