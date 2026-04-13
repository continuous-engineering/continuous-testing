import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Column<T> = {
  key: string
  header: string
  width?: string           // e.g. 'w-32', 'w-1/4', 'flex-1'
  align?: 'left' | 'right' | 'center'
  render: (row: T) => React.ReactNode
}

type Props<T> = {
  columns: Column<T>[]
  rows: T[]
  getKey: (row: T) => string
  onRowClick?: (row: T) => void
  emptyMessage?: string
  className?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DenseTable<T>({
  columns,
  rows,
  getKey,
  onRowClick,
  emptyMessage = 'No results',
  className,
}: Props<T>) {
  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      {/* Header */}
      <div
        className="flex items-center border-b sticky top-0 z-10"
        style={{
          height: 'var(--ct-row-h)',
          borderColor: 'var(--ct-border)',
          background: 'var(--ct-surface)',
        }}
      >
        {columns.map((col) => (
          <div
            key={col.key}
            className={cn(
              'text-label uppercase tracking-wide flex-shrink-0',
              col.width ?? 'flex-1',
              col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left',
            )}
            style={{ padding: '0 var(--ct-row-px)', color: 'var(--ct-text-3)' }}
          >
            {col.header}
          </div>
        ))}
      </div>

      {/* Rows */}
      {rows.length === 0 ? (
        <div
          className="flex items-center justify-center text-body"
          style={{ height: '80px', color: 'var(--ct-text-3)' }}
        >
          {emptyMessage}
        </div>
      ) : (
        rows.map((row) => (
          <div
            key={getKey(row)}
            className={cn(
              'ct-row',
              onRowClick && 'cursor-pointer',
            )}
            onClick={() => onRowClick?.(row)}
            role={onRowClick ? 'button' : undefined}
            tabIndex={onRowClick ? 0 : undefined}
            onKeyDown={onRowClick ? (e) => e.key === 'Enter' && onRowClick(row) : undefined}
          >
            {columns.map((col) => (
              <div
                key={col.key}
                className={cn(
                  'text-body flex-shrink-0 truncate',
                  col.width ?? 'flex-1',
                  col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : '',
                )}
                style={{ color: 'var(--ct-text-1)' }}
              >
                {col.render(row)}
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  )
}
