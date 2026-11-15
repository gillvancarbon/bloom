import type { ReactNode } from 'react'
import { CalendarDays, Leaf, Settings as SettingsIcon, TrendingUp } from 'lucide-react'
import { IconButton } from './ui/IconButton'

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

/**
 * The shared top bar. The Bloom mark is a small non-interactive sprig; the
 * navigation lives in the labelled action group on the right, so every tab
 * offers the same way into Calendar, Insights and Settings. The wordmark uses
 * the display face with a tight, calm setting to read as a brand, not a title.
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
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sage-500/10 text-sage-600
                     ring-1 ring-inset ring-sage-500/15 dark:bg-sage-400/10 dark:text-sage-300 dark:ring-sage-400/20"
        >
          <Leaf className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-xl font-semibold tracking-tight text-ink">Bloom</h1>
          <p className="truncate text-xs text-muted">{subtitle}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {children}
        {onOpenCalendar && (
          <IconButton
            icon={CalendarDays}
            label="Open consistency calendar"
            tone="quiet"
            onClick={onOpenCalendar}
          />
        )}
        {onOpenInsights && (
          <IconButton
            icon={TrendingUp}
            label="Open insights"
            tone="quiet"
            onClick={onOpenInsights}
          />
        )}
        <IconButton
          icon={SettingsIcon}
          label="Open settings"
          tone="quiet"
          onClick={onOpenSettings}
        />
      </div>
    </header>
  )
}
