import type { ReactNode } from 'react'
import { CalendarDays, Leaf, Settings as SettingsIcon, TrendingUp } from 'lucide-react'

interface AppHeaderProps {
  subtitle: string
  onOpenSettings: () => void
  /** Omit to hide the calendar shortcut (e.g. when it would be a no-op). */
  onOpenCalendar?: () => void
  /** Omit to hide the insights shortcut. */
  onOpenInsights?: () => void
  /** Extra controls shown before the standard action group. */
  children?: ReactNode
}

/** A 44px icon button, so every header action clears the touch-target minimum. */
const ACTION =
  'silicone flex h-11 w-11 items-center justify-center rounded-full text-muted hover:text-sage-500 dark:hover:text-sage-300'

/**
 * The shared top bar. The Bloom mark is a non-interactive brand accent; the
 * real navigation lives in the labelled action group on the right, so every
 * tab offers the same way into Calendar, Insights and Settings.
 */
export function AppHeader({
  subtitle,
  onOpenSettings,
  onOpenCalendar,
  onOpenInsights,
  children,
}: AppHeaderProps) {
  return (
    <header className="mb-6 flex items-center justify-between gap-3 sm:mb-8 sm:gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden
          className="silicone-primary flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full sm:h-[51px] sm:w-[51px]"
        >
          <Leaf className="h-[23px] w-[23px] sm:h-[25px] sm:w-[25px]" aria-hidden />
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-xl font-semibold tracking-tight text-ink sm:text-2xl">
            Bloom
          </h1>
          <p className="truncate text-xs text-muted sm:text-sm">{subtitle}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {children}
        {onOpenCalendar && (
          <button
            type="button"
            onClick={onOpenCalendar}
            aria-label="Open consistency calendar"
            title="Consistency calendar"
            className={ACTION}
          >
            <CalendarDays className="h-5 w-5" aria-hidden />
          </button>
        )}
        {onOpenInsights && (
          <button
            type="button"
            onClick={onOpenInsights}
            aria-label="Open insights"
            title="Insights"
            className={ACTION}
          >
            <TrendingUp className="h-5 w-5" aria-hidden />
          </button>
        )}
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Open settings"
          title="Settings"
          className={ACTION}
        >
          <SettingsIcon className="h-5 w-5" aria-hidden />
        </button>
      </div>
    </header>
  )
}
