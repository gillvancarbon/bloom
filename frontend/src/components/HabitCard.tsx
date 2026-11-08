import { useEffect, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { motion } from 'framer-motion'
import { Check, Clock, Flame, GripVertical, Moon, Repeat, Sun, Sunrise } from 'lucide-react'
import type { DayPeriod, Habit, WeekStart } from '../types'
import { deadlineState } from '../lib/streak'
import { isCompleteForPeriod, scheduleLabel, scheduleProgress, streakState } from '../lib/schedule'
import { momentum, momentumTier, type MomentumTier } from '../lib/momentum'
import { DAY_PERIODS, PERIOD_LABELS } from '../lib/dayPeriod'
import { formatTime } from '../lib/format'
import { useSettings } from '../context/SettingsContext'
import { Portal } from './Portal'
import { ReorderButtons } from './ReorderButtons'
import { RowActions } from './RowActions'

const MOMENTUM_TIERS: Record<MomentumTier, string> = {
  starting: 'Starting',
  building: 'Building',
  steady: 'Steady',
  strong: 'Strong',
}

interface HabitCardProps {
  habit: Habit
  now: Date
  weekStart: WeekStart
  busy?: boolean
  actionsOpen: boolean
  onToggleActions: () => void
  onEdit: (habit: Habit) => void
  onArchive: (habit: Habit) => void
  onDelete: (habit: Habit) => void
  onToggle: (habit: Habit) => void
  /** Omit to hide the quick "move to another time of day" control. */
  onChangePeriod?: (habit: Habit, period: DayPeriod) => void
  /**
   * Whether the habit is due today. Off-day habits (shown in "Not today")
   * pass false so their deadline reads as a calm time instead of a countdown
   * or an "Overdue" warning.
   */
  dueToday?: boolean
  /** Manual order: move this habit one slot up or down. */
  onMoveUp?: () => void
  onMoveDown?: () => void
  canMoveUp?: boolean
  canMoveDown?: boolean
  /** A one-shot, subtle pulse shown after an opted-in celebration. */
  pulse?: { kind: 'habit' | 'milestone'; seq: number } | null
}

const palette = [
  'bg-sage-100 text-sage-700 dark:bg-sage-900/50 dark:text-sage-200',
  'bg-peach-100 text-peach-700 dark:bg-peach-900/40 dark:text-peach-200',
  'bg-mint-200 text-mint-700 dark:bg-mint-800/60 dark:text-mint-100',
]

const PERIOD_ICONS = { morning: Sunrise, afternoon: Sun, evening: Moon, anytime: Clock }

/** A small popover for moving a habit to another part of the day. */
function PeriodMenu({
  habit,
  anchor,
  onSelect,
  onClose,
}: {
  habit: Habit
  anchor: { x: number; y: number }
  onSelect: (period: DayPeriod) => void
  onClose: () => void
}) {
  const left = Math.min(anchor.x, Math.max(8, window.innerWidth - 168))
  return (
    <Portal>
      <div className="fixed inset-0 z-[70]" onClick={onClose} aria-hidden />
      <div
        role="menu"
        aria-label="Move to another time of day"
        style={{ left, top: anchor.y }}
        className="fixed z-[71] w-40 overflow-hidden rounded-calm-sm border border-line bg-raised py-1 shadow-calm-lg"
      >
        {DAY_PERIODS.map((option) => {
          const Icon = PERIOD_ICONS[option]
          const active = option === habit.timeOfDay
          return (
            <button
              key={option}
              type="button"
              role="menuitemradio"
              aria-checked={active}
              onClick={() => onSelect(option)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors duration-calm ease-calm ${
                active
                  ? 'text-sage-600 dark:text-sage-300'
                  : 'text-ink hover:bg-mint-100 dark:hover:bg-mint-900/40'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0 text-muted" aria-hidden />
              <span className="flex-1">{PERIOD_LABELS[option]}</span>
              {active && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />}
            </button>
          )
        })}
      </div>
    </Portal>
  )
}

export function HabitCard({
  habit,
  now,
  weekStart,
  busy,
  actionsOpen,
  onToggleActions,
  onEdit,
  onArchive,
  onDelete,
  onToggle,
  onChangePeriod,
  dueToday = true,
  onMoveUp,
  onMoveDown,
  canMoveUp = true,
  canMoveDown = true,
  pulse,
}: HabitCardProps) {
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null)
  const { settings } = useSettings()

  // A one-shot, subtle pulse after an opted-in celebration. The parent only
  // sends a fresh `pulse` when celebrations are on and motion is allowed, so a
  // new `seq` is the signal to play it once.
  const [pulsing, setPulsing] = useState(false)
  useEffect(() => {
    if (!pulse) return
    setPulsing(true)
    const timer = setTimeout(() => setPulsing(false), pulse.kind === 'milestone' ? 900 : 600)
    return () => clearTimeout(timer)
  }, [pulse])

  const complete = isCompleteForPeriod(habit, now, weekStart)
  const tone = palette[habit.colorIndex % palette.length]

  const streak = streakState(habit, now, settings.weekStart)
  const streakDisplay = settings.streakDisplay
  const reorderable = Boolean(onMoveUp || onMoveDown)
  // A calm, forgiving view of the last month instead of a streak that resets.
  const momentumStats = streakDisplay === 'momentum' ? momentum(habit, now) : null
  const momentumTierLabel = momentumStats
    ? MOMENTUM_TIERS[momentumTier(momentumStats.completed, momentumStats.of)]
    : null
  // Keep the deadline calm: a plain time by default, a countdown only in the
  // last stretch before it, and a quiet "Past deadline" instead of a red alarm.
  // Off-day habits show their deadline as a plain time too.
  const rawDeadline = deadlineState(habit.deadline, now)
  const byTime = {
    level: 'calm' as const,
    text: `by ${formatTime(habit.deadline, settings.timeFormat)}`,
  }
  const deadline = complete
    ? { level: 'calm' as const, text: 'Done' }
    : !dueToday
      ? byTime
      : rawDeadline.level === 'overdue'
        ? { level: 'overdue' as const, text: 'Past deadline' }
        : rawDeadline.level === 'near'
          ? rawDeadline
          : byTime

  const flameSize =
    streak.level === 'risk' ? 'h-3 w-3' : streak.level === 'broken' ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5'

  const streakChip =
    streak.level === 'risk'
      ? 'bg-peach-100 text-peach-700 dark:bg-peach-900/50 dark:text-peach-200'
      : streak.level === 'broken'
        ? 'bg-mint-100 text-muted dark:bg-mint-900/60'
        : tone

  const streakLabel =
    streak.level === 'none'
      ? 'No streak yet'
      : streak.level === 'broken'
        ? 'Start again'
        : `${streak.count} day${streak.count === 1 ? '' : 's'} streak`

  const deadlineClass =
    deadline.level === 'near'
      ? 'text-peach-700 dark:text-peach-300'
      : deadline.level === 'overdue'
        ? 'font-medium text-amber-700 dark:text-amber-300'
        : 'text-muted dark:text-ink/80'

  const progress = scheduleProgress(habit, now, weekStart)
  const showProgress = habit.schedule.type === 'weekly'
  const showScheduleChip = habit.schedule.type !== 'daily'
  const PeriodIcon = PERIOD_ICONS[habit.timeOfDay]

  function openMenu(event: ReactMouseEvent<HTMLButtonElement>) {
    if (!onChangePeriod) return
    const rect = event.currentTarget.getBoundingClientRect()
    setMenuAnchor({ x: rect.left, y: rect.bottom + 4 })
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={
        pulsing
          ? {
              opacity: 1,
              y: 0,
              scale: pulse?.kind === 'milestone' ? [1, 1.04, 1] : [1, 1.02, 1],
            }
          : { opacity: 1, y: 0, scale: 1 }
      }
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.2 } }}
      transition={
        pulsing
          ? {
              duration: pulse?.kind === 'milestone' ? 0.9 : 0.6,
              ease: [0.4, 0, 0.2, 1],
              times: [0, 0.35, 1],
            }
          : { duration: 0.35, ease: [0.4, 0, 0.2, 1] }
      }
      className={`group relative overflow-hidden rounded-calm border border-line
                 bg-raised px-4 py-4 shadow-calm sm:px-5
                 transition-all duration-calm ease-calm
                 hover:border-sage-300 hover:shadow-calm-lg
                 dark:hover:border-sage-700 ${habit.archived ? 'opacity-70' : ''}`}
    >
      <div className="flex items-center gap-3 sm:gap-4">
        {reorderable && (
          <span
            className="flex shrink-0 items-center text-muted/60"
            title="Drag to reorder"
            aria-hidden
          >
            <GripVertical className="h-4 w-4" />
          </span>
        )}

        {/* Completion toggle */}
        <button
          type="button"
          onClick={() => onToggle(habit)}
          disabled={busy}
          aria-pressed={complete}
          aria-label={
            complete
              ? `Undo today's completion for ${habit.name}`
              : `Mark ${habit.name} complete today`
          }
          title={complete ? 'Undo today’s completion' : 'Mark complete today'}
          className={`${complete ? 'silicone-primary' : 'silicone'} flex h-12 w-12 shrink-0 items-center justify-center
                      rounded-full ${busy ? 'opacity-60' : ''}`}
        >
          <Check
            className={`h-5 w-5 transition-all duration-calm ease-calm ${
              complete
                ? 'scale-100 opacity-100'
                : 'scale-75 text-sage-500 opacity-50 dark:text-sage-300'
            }`}
            aria-hidden
          />
        </button>

        {/* Name + streak */}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="min-w-0 truncate font-display text-sm font-semibold text-ink sm:text-base">
              {habit.name}
            </h3>
            {habit.category && (
              <span className="shrink-0 rounded-md bg-mint-100 px-2 py-0.5 text-xs font-medium text-sage-700 dark:bg-mint-900/50 dark:text-mint-100">
                {habit.category}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            {streakDisplay === 'flame' && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${streakChip}`}
              >
                <Flame
                  className={`${flameSize} transition-all duration-calm ease-calm`}
                  aria-hidden
                />
                {streakLabel}
              </span>
            )}
            {streakDisplay === 'momentum' && momentumStats && (
              <span className="inline-flex items-center gap-1 rounded-full bg-mint-100 px-2 py-0.5 font-medium text-muted dark:bg-mint-900/50">
                {momentumTierLabel}
                <span className="text-muted/70" aria-hidden>
                  ·
                </span>
                <span className="tabular-nums">
                  {momentumStats.completed} of {momentumStats.of} days
                </span>
              </span>
            )}
            {showScheduleChip && (
              <span className="inline-flex items-center gap-1 rounded-full bg-mint-100 px-2 py-0.5 font-medium text-muted dark:bg-mint-900/50">
                <Repeat className="h-3 w-3" aria-hidden />
                {scheduleLabel(habit.schedule)}
              </span>
            )}
            {showProgress && (
              <span
                className={`inline-flex items-center gap-1 font-medium ${
                  progress.complete ? 'text-sage-600 dark:text-sage-300' : 'text-muted'
                }`}
              >
                {progress.done}/{progress.target} {progress.label}
              </span>
            )}
            <span className={`inline-flex items-center gap-1 ${deadlineClass}`}>
              <Clock className="h-3.5 w-3.5" aria-hidden />
              {deadline.text}
            </span>
            {onChangePeriod && (
              <button
                type="button"
                onClick={openMenu}
                aria-haspopup="menu"
                aria-expanded={menuAnchor !== null}
                aria-label={`Change time of day for ${habit.name}`}
                title="Move to another time of day"
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-line px-2 py-0.5
                           font-medium text-muted transition-colors duration-calm ease-calm
                           hover:border-sage-300 hover:text-ink"
              >
                <PeriodIcon className="h-3 w-3" aria-hidden />
                {PERIOD_LABELS[habit.timeOfDay]}
              </button>
            )}
            {(onMoveUp || onMoveDown) && (
              <ReorderButtons
                label={habit.name}
                onMoveUp={onMoveUp}
                onMoveDown={onMoveDown}
                canMoveUp={canMoveUp}
                canMoveDown={canMoveDown}
                className="inline-flex items-center gap-1"
              />
            )}
          </div>
          {habit.archived && (
            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted">Archived</p>
          )}
        </div>

        {/* Overflow menu → tap → spin → edit + archive + delete */}
        <RowActions
          id={habit.id}
          label={habit.name}
          archived={habit.archived}
          open={actionsOpen}
          onToggle={onToggleActions}
          onEdit={() => onEdit(habit)}
          onArchive={() => onArchive(habit)}
          onDelete={() => onDelete(habit)}
        />
      </div>

      {menuAnchor && onChangePeriod && (
        <PeriodMenu
          habit={habit}
          anchor={menuAnchor}
          onSelect={(period) => {
            setMenuAnchor(null)
            onChangePeriod(habit, period)
          }}
          onClose={() => setMenuAnchor(null)}
        />
      )}
    </motion.article>
  )
}
