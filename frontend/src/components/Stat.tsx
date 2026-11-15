import type { LucideIcon } from 'lucide-react'

interface StatProps {
  label: string
  value: number | string
  accent?: boolean
  title?: string
  /** Optional glyph shown to the left of the value (e.g. a flame for streaks). */
  icon?: LucideIcon
  /** Optional quiet line under the value (e.g. "in a row"). */
  hint?: string
  /** Fill the trailing space with a thin progress bar (0–1). */
  progress?: number
}

/**
 * One figure in the day's summary row. Kept deliberately plain — a label, a
 * large number and an optional hint — so the row reads as a quiet scoreboard
 * rather than three competing cards. A hairline divider separates the cells on
 * wider screens; on phones they sit side by side with generous spacing.
 */
export function Stat({ label, value, accent, title, icon: Icon, hint, progress }: StatProps) {
  return (
    <div title={title} className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
      <p
        className={`mt-0.5 flex items-baseline gap-1.5 font-display text-2xl font-semibold tabular-nums sm:text-[1.75rem] ${
          accent ? 'text-peach-700 dark:text-peach-300' : 'text-ink'
        }`}
      >
        {Icon && <Icon className="h-4 w-4 shrink-0 translate-y-[-1px] text-muted" aria-hidden />}
        {value}
        {hint && <span className="text-xs font-normal text-muted">{hint}</span>}
      </p>
      {progress !== undefined && (
        <span
          className="mt-2 block h-1 w-full overflow-hidden rounded-full bg-mint-200/70 dark:bg-mint-900/60"
          aria-hidden
        >
          <span
            className="block h-full rounded-full bg-sage-500 transition-[width] duration-calm ease-calm"
            style={{ width: `${Math.min(100, Math.max(0, Math.round(progress * 100)))}%` }}
          />
        </span>
      )}
    </div>
  )
}
