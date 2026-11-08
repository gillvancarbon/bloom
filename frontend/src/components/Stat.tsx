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
}

export function Stat({ label, value, accent, title, icon: Icon, hint }: StatProps) {
  return (
    <div
      title={title}
      className="rounded-calm border border-line bg-raised px-1.5 py-3 text-center shadow-calm sm:px-4"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p
        className={`mt-1 flex items-center justify-center gap-1 font-display text-lg font-semibold sm:text-xl ${
          accent ? 'text-peach-700 dark:text-peach-300' : 'text-ink'
        }`}
      >
        {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden />}
        {value}
      </p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  )
}
