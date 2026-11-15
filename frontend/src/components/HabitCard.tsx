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

/**
 * A habit's accent, derived from its stored colour index. Kept to three tones
 * that all sit inside the botanical palette, so a long list stays calm.
 * `ring` marks the completion control, `tint` the small period label.
 */
const ACCENTS = [
  {
    ring: 'border-sage-400 text-sage-600 dark:border-sage-500 dark:text-sage-300',
    tint: 'bg-sage-500/10 text-sage-700 dark:bg-sage-400/10 dark:text-sage-300',
  },
  {
    ring: 'border-peach-400 text-peach-600 dark:border-peach-500 dark:text-peach-300',
    tint: 'bg-peach-500/10 text-peach-700 dark:bg-peach-400/10 dark:text-peach-300',
  },
  {
    ring: 'border-mint-500 text-mint-700 dark:border-mint-500 dark:text-mint-200',
    tint: 'bg-mint-500/15 text-mint-700 dark:bg-mint-500/15 dark:text-mint-200',
  },
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
  const accent = ACCENTS[habit.colorIndex % ACCENTS.length]

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
  const overdue = !complete && dueToday && rawDeadline.level === 'overdue'
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

  const streakTone =
    streak.level === 'risk'
      ? 'text-peach-600 dark:text-peach-300'
      : streak.level === 'broken'
        ? 'text-muted'
        : 'text-peach-600 dark:text-peach-300'

  const streakLabel =
    streak.level === 'none'
      ? 'No streak yet'
      : streak.level === 'broken'
        ? 'Start again'
        : `${streak.count} day${streak.count === 1 ? '' : 's'}`

  const deadlineClass =
    deadline.level === 'near'
      ? 'text-peach-700 dark:text-peach-300'
      : deadline.level === 'overdue'
        ? 'font-semibold text-peach-700 dark:text-peach-300'
        : 'text-muted'

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
      initial={{ opacity: 0, y: 10 }}
      animate={
        pulsing
          ? { opacity: 1, y: 0, scale: pulse?.kind === 'milestone' ? [1, 1.035, 1] : [1, 1.018, 1] }
          : { opacity: 1, y: 0, scale: 1 }
      }
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.2 } }}
      transition={
        pulsing
          ? {
              duration: pulse?.kind === 'milestone' ? 0.9 : 0.6,
              ease: [0.4, 0, 0.2, 1],
              times: [0, 0.35, 1],
            }
          : { duration: 0.32, ease: [0.4, 0, 0.2, 1] }
      }
      className={`group relative flex items-center gap-3 border-b border-line/70 py-3.5
                 transition-colors duration-calm ease-calm first:border-t last:border-b-0
                 sm:gap-4 ${complete ? 'opacity-90' : ''} ${habit.archived ? 'opacity-60' : ''}`}
    >
      {reorderable && (
        <span
          className="flex shrink-0 items-center text-muted/40"
          title="Drag to reorder"
          aria-hidden
        >
          <GripVertical className="h-4 w-4" />
        </span>
      )}

      {/* Completion control — a ring that fills with sage and stamps a check. */}
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
        className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2
                    transition-all duration-calm ease-calm active:scale-90 sm:h-11 sm:w-11
                    ${busy ? 'opacity-60' : ''} ${
                      complete
                        ? 'border-sage-500 bg-sage-500 text-white shadow-calm'
                        : overdue
                          ? 'border-peach-400 text-peach-600 hover:bg-peach-500/5 dark:border-peach-500 dark:text-peach-300 dark:hover:bg-peach-400/5'
                          : `${accent.ring} bg-transparent hover:bg-sage-500/5 dark:hover:bg-sage-400/5`
                    }`}
      >
        <Check
          className={`h-[18px] w-[18px] transition-all duration-calm ease-calm ${
            complete ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
          }`}
          strokeWidth={2.6}
          aria-hidden
        />
      </button>

      {/* Name and supporting facts */}
      <div className="min-w-0 flex-1">
        <h3
          className={`min-w-0 break-words font-display text-[15px] font-semibold leading-snug transition-colors duration-calm ease-calm sm:text-base ${
            complete ? 'text-muted' : 'text-ink'
          }`}
        >
          {habit.name}
        </h3>

        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
          {streakDisplay === 'flame' && (
            <span
              className={`inline-flex items-center gap-1 font-medium tabular-nums ${streakTone}`}
            >
              <Flame className={`${flameSize} shrink-0`} aria-hidden />
              {streakLabel}
            </span>
          )}
          {streakDisplay === 'momentum' && momentumStats && (
            <span className="inline-flex items-center gap-1 text-muted tabular-nums">
              {momentumTierLabel}
              <span className="text-muted/50" aria-hidden>
                ·
              </span>
              {momentumStats.completed} of {momentumStats.of} days
            </span>
          )}
          {showScheduleChip && (
            <span className="inline-flex items-center gap-1 text-muted">
              <Repeat className="h-3 w-3 shrink-0" aria-hidden />
              {scheduleLabel(habit.schedule)}
            </span>
          )}
          {showProgress && (
            <span
              className={`inline-flex items-center gap-1 font-medium tabular-nums ${
                progress.complete ? 'text-sage-600 dark:text-sage-300' : 'text-muted'
              }`}
            >
              {progress.done}/{progress.target} {progress.label}
            </span>
          )}
          <span className={`inline-flex items-center gap-1 tabular-nums ${deadlineClass}`}>
            <Clock className="h-3 w-3 shrink-0" aria-hidden />
            {deadline.text}
          </span>
          {habit.category && (
            <span className={`${accent.tint} rounded-full px-2 py-0.5 font-medium`}>
              {habit.category}
            </span>
          )}
          {onChangePeriod && (
            <button
              type="button"
              onClick={openMenu}
              aria-haspopup="menu"
              aria-expanded={menuAnchor !== null}
              aria-label={`Change time of day for ${habit.name}`}
              title="Move to another time of day"
              className="-my-0.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-muted
                         transition-colors duration-calm ease-calm hover:bg-mint-100 hover:text-ink
                         dark:hover:bg-mint-900/40"
            >
              <PeriodIcon className="h-3 w-3 shrink-0" aria-hidden />
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
          {habit.archived && (
            <span className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted">
              Archived
            </span>
          )}
        </div>
      </div>

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
