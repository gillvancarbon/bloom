interface SkeletonListProps {
  rows?: number
  /** Screen-reader label, e.g. "Loading habits". */
  label: string
}

/**
 * The loading placeholder shown while the first read is in flight. Shaped like
 * the rows it stands in for — an avatar-sized circle and two text lines — so
 * the transition to real content is quiet rather than a jump in layout.
 */
export function SkeletonList({ rows = 3, label }: SkeletonListProps) {
  return (
    <div role="status" aria-label={label} className="divide-y divide-line/70">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex animate-pulse items-center gap-3 py-3.5 sm:gap-4">
          <div className="h-10 w-10 shrink-0 rounded-full bg-mint-200/70 dark:bg-mint-900/50 sm:h-11 sm:w-11" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3.5 w-2/5 rounded-full bg-mint-200/70 dark:bg-mint-900/50" />
            <div className="h-3 w-3/5 rounded-full bg-mint-200/50 dark:bg-mint-900/40" />
          </div>
        </div>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  )
}
