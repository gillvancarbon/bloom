import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { AnimatePresence, motion, Reorder, useDragControls } from 'framer-motion'
import { Archive, CalendarClock, Check, ChevronDown, Flame, Plus, Sparkles } from 'lucide-react'
import { AppHeader } from './AppHeader'
import { HabitCard } from './HabitCard'
import { HabitForm } from './HabitForm'
import { HabitQuickAddBar } from './HabitQuickAddBar'
import { DeleteConfirm } from './DeleteConfirm'
import { CalendarView } from './CalendarView'
import { InsightsView } from './InsightsView'
import { TemplatePicker, toHabitInputs } from './TemplatePicker'
import { FreezeSheet } from './FreezeSheet'
import { FrozenFlame } from './FrozenFlame'
import { Stat } from './Stat'
import { UndoToast } from './UndoToast'
import { useHabits } from '../hooks/useHabits'
import { useNow } from '../hooks/useNow'
import { useUndoQueue } from '../hooks/useUndoQueue'
import { useSettings } from '../context/SettingsContext'
import { deadlineState } from '../lib/streak'
import { dailyStreak } from '../lib/insights'
import { isCompleteForPeriod, scheduledOrCompletedToday } from '../lib/schedule'
import {
  DAY_PERIODS,
  PERIOD_LABELS,
  clockAdvance,
  groupByPeriod,
  periodFromTime,
} from '../lib/dayPeriod'
import { orderHabits } from '../lib/orderHabits'
import { isAtRisk } from '../lib/freezes'
import { playCompletionSound } from '../lib/sound'
import { clearPendingDelete, schedulePendingDelete } from '../data/pendingDeletes'
import type { DayPeriod, Habit, HabitInput, HabitSort } from '../types'

type Dialog =
  | { type: 'none' }
  | { type: 'create' }
  | { type: 'edit'; habit: Habit }
  | { type: 'delete'; habit: Habit }

interface HabitsViewProps {
  onOpenSettings: () => void
  /** Set by the welcome tour to open the template picker once Habits is shown. */
  autoOpenTemplates?: boolean
  onTemplatesHandled?: () => void
  /** Set when Calendar/Insights are opened from another tab. */
  autoOpenOverlay?: 'calendar' | 'insights' | null
  onOverlayHandled?: () => void
}

const SORT_OPTIONS: Array<{ value: HabitSort; label: string }> = [
  { value: 'incomplete', label: 'To-do first' },
  { value: 'manual', label: 'My order' },
  { value: 'deadline', label: 'By deadline' },
  { value: 'name', label: 'A–Z' },
]

/** One reorderable habit row. Press and hold a card, then drag to reposition. */
function HabitRow({
  habit,
  reorderable,
  children,
}: {
  habit: Habit
  reorderable: boolean
  children: ReactNode
}) {
  const controls = useDragControls()
  const holdTimer = useRef<number | null>(null)
  const startPoint = useRef<{ x: number; y: number } | null>(null)
  const releaseScroll = useRef<(() => void) | null>(null)

  function clearHold() {
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
  }

  function unlockScroll() {
    releaseScroll.current?.()
    releaseScroll.current = null
  }

  function beginDrag(event: ReactPointerEvent) {
    // Framer drags with pointer events but won't stop the page panning on its
    // own, so while a drag is live we swallow touchmove to keep the list still.
    const prevent = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault()
    }
    window.addEventListener('touchmove', prevent, { passive: false })
    window.addEventListener('touchend', unlockScroll, { once: true })
    window.addEventListener('pointerup', unlockScroll, { once: true })
    window.addEventListener('pointercancel', unlockScroll, { once: true })
    releaseScroll.current = () => {
      window.removeEventListener('touchmove', prevent)
      window.removeEventListener('touchend', unlockScroll)
      window.removeEventListener('pointerup', unlockScroll)
      window.removeEventListener('pointercancel', unlockScroll)
    }
    controls.start(event)
  }

  function handlePointerDown(event: ReactPointerEvent) {
    if (!reorderable) return
    // Interactive controls keep their own gestures (taps, the leaf menu).
    if ((event.target as HTMLElement).closest('button, a, input, select, textarea')) return
    clearHold()
    startPoint.current = { x: event.clientX, y: event.clientY }
    const holdEvent = event
    holdTimer.current = window.setTimeout(() => {
      holdTimer.current = null
      beginDrag(holdEvent)
    }, 400)
  }

  function handlePointerMove(event: ReactPointerEvent) {
    // A real scroll (or a stray swipe) cancels the pending long-press.
    const start = startPoint.current
    if (!start || holdTimer.current === null) return
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) clearHold()
  }

  useEffect(
    () => () => {
      clearHold()
      unlockScroll()
    },
    [],
  )

  return (
    <Reorder.Item
      value={habit}
      dragListener={false}
      dragControls={controls}
      as="li"
      className="list-none"
      style={{ touchAction: 'pan-y' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={clearHold}
      onPointerCancel={clearHold}
      onPointerLeave={clearHold}
      onContextMenu={(event: ReactMouseEvent) => event.preventDefault()}
    >
      {children}
    </Reorder.Item>
  )
}

export function HabitsView({
  onOpenSettings,
  autoOpenTemplates,
  onTemplatesHandled,
  autoOpenOverlay,
  onOverlayHandled,
}: HabitsViewProps) {
  const {
    habits,
    historyStart,
    loading,
    error,
    busyId,
    create,
    update,
    remove,
    archive,
    reorder,
    toggle,
    freeze,
    canFreeze,
  } = useHabits()
  const { settings, update: updateSettings } = useSettings()
  const weekStart = settings.weekStart
  const [dialog, setDialog] = useState<Dialog>({ type: 'none' })
  const [createPeriod, setCreatePeriod] = useState<DayPeriod | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [insightsOpen, setInsightsOpen] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [showNotToday, setShowNotToday] = useState(false)
  const [freezeOpen, setFreezeOpen] = useState(false)
  const [hidden, setHidden] = useState<Set<number>>(new Set())
  const [liveMessage, setLiveMessage] = useState('')
  const now = useNow()
  const undo = useUndoQueue()
  const { commitNow } = undo
  // One list for the whole day, optionally filtered to a single part of it.
  // The default is "all", so the day is never hidden behind four screens.
  const [filter, setFilter] = useState<DayPeriod | 'all'>(() =>
    settings.followClock ? periodFromTime(new Date()) : 'all',
  )
  // "Follow the clock" should only step the view when the clock crosses into a
  // new period — never on a manual tap, or Anytime would be unreachable.
  const lastClockPeriod = useRef<DayPeriod>(periodFromTime(new Date()))
  const wasFollowingClock = useRef(settings.followClock)

  /** Announce a change to assistive tech, clearing first so repeats land. */
  function announce(message: string) {
    setLiveMessage('')
    requestAnimationFrame(() => setLiveMessage(message))
  }

  // Commit any pending delete when leaving the screen, so a tab switch can't
  // resurrect an optimistically-hidden habit.
  useEffect(() => () => commitNow(), [commitNow])

  // The welcome tour can ask for the template picker as soon as Habits mounts.
  useEffect(() => {
    if (!autoOpenTemplates) return
    setTemplatesOpen(true)
    onTemplatesHandled?.()
  }, [autoOpenTemplates, onTemplatesHandled])

  // Another tab can ask for the Calendar or Insights overlay.
  useEffect(() => {
    if (!autoOpenOverlay) return
    if (autoOpenOverlay === 'calendar') setCalendarOpen(true)
    if (autoOpenOverlay === 'insights') setInsightsOpen(true)
    onOverlayHandled?.()
  }, [autoOpenOverlay, onOverlayHandled])

  // Collapse the open card when tapping anywhere outside its action area.
  useEffect(() => {
    if (selectedId === null) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (!target?.closest(`[data-actions-for="${selectedId}"]`)) {
        setSelectedId(null)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [selectedId])

  const activeHabits = useMemo(
    () => habits.filter((h) => !h.archived && !hidden.has(h.id)),
    [habits, hidden],
  )
  const archivedHabits = useMemo(
    () => habits.filter((h) => h.archived && !hidden.has(h.id)),
    [habits, hidden],
  )

  // Only today's habits: scheduled for today, or already completed today so a
  // just-finished weekly habit stays visible long enough to be undone.
  const todayHabits = useMemo(
    () => activeHabits.filter((habit) => scheduledOrCompletedToday(habit, now, weekStart)),
    [activeHabits, now, weekStart],
  )
  const periodGroups = useMemo(() => groupByPeriod(todayHabits), [todayHabits])

  /** Per-period counts for the switcher: how much is here, done, and overdue. */
  const periodStats = useMemo(() => {
    const stats = {} as Record<DayPeriod, { total: number; done: number; overdue: number }>
    for (const option of DAY_PERIODS) {
      const list = periodGroups[option]
      const done = list.filter((h) => isCompleteForPeriod(h, now, weekStart)).length
      const overdue = list.filter(
        (h) =>
          !isCompleteForPeriod(h, now, weekStart) &&
          deadlineState(h.deadline, now).level === 'overdue',
      ).length
      stats[option] = { total: list.length, done, overdue }
    }
    return stats
  }, [periodGroups, now, weekStart])

  // Periods that actually hold a habit today — the chips and section headers
  // only appear when there is more than one, so a single-bucket day stays calm.
  const populatedPeriods = useMemo(
    () => DAY_PERIODS.filter((period) => periodGroups[period].length > 0),
    [periodGroups],
  )
  const chipOptions: Array<DayPeriod | 'all'> = ['all', ...populatedPeriods]
  const showChips = populatedPeriods.length >= 2

  const orderedFor = (period: DayPeriod) =>
    orderHabits(periodGroups[period], settings.habitSort, now, weekStart)
  const visibleFor = (period: DayPeriod) => {
    const ordered = orderedFor(period)
    return settings.hideCompleted
      ? ordered.filter((habit) => !isCompleteForPeriod(habit, now, weekStart))
      : ordered
  }

  // Sections to render: every populated period, or just the chosen one.
  const sectionPeriods =
    filter === 'all'
      ? populatedPeriods
      : populatedPeriods.includes(filter as DayPeriod)
        ? [filter as DayPeriod]
        : []

  const reorderable = settings.habitSort === 'manual'

  // Active habits off today's schedule — an off-day for a weekday habit, or a
  // weekly habit that has already met its target this week. They are still
  // fully editable from here.
  const notTodayHabits = useMemo(
    () => activeHabits.filter((habit) => !scheduledOrCompletedToday(habit, now, weekStart)),
    [activeHabits, now, weekStart],
  )
  const orderedNotToday = useMemo(
    () => orderHabits(notTodayHabits, settings.habitSort, now, weekStart),
    [notTodayHabits, settings.habitSort, now, weekStart],
  )

  // Habits with an unprotected missed day, shown in the freezes sheet.
  const atRiskHabits = useMemo(
    () => habits.filter((habit) => !habit.archived && isAtRisk(habit, now)),
    [habits, now],
  )

  /** Arrow keys rove across the period filter chips. */
  function handleFilterKeyDown(event: ReactKeyboardEvent) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const index = Math.max(0, chipOptions.indexOf(filter))
    const dir = event.key === 'ArrowRight' ? 1 : -1
    const next = chipOptions[(index + dir + chipOptions.length) % chipOptions.length]
    setFilter(next)
    requestAnimationFrame(() => document.getElementById(`period-filter-${next}`)?.focus())
  }

  // When "follow the clock" is on, step the filter as the day moves. Anytime is
  // left alone entirely, and the all-day view is never yanked away.
  useEffect(() => {
    const current = periodFromTime(now)
    if (!settings.followClock) {
      wasFollowingClock.current = false
      lastClockPeriod.current = current
      return
    }

    const justEnabled = !wasFollowingClock.current
    wasFollowingClock.current = true
    if (filter === 'all') {
      lastClockPeriod.current = current
      return
    }
    const target = clockAdvance(filter, current, lastClockPeriod.current, justEnabled)
    lastClockPeriod.current = current
    if (!target) return
    setFilter(target)
  }, [now, settings.followClock, filter])

  const doneToday = todayHabits.filter((habit) => isCompleteForPeriod(habit, now, weekStart)).length
  const streak = dailyStreak(activeHabits, now, historyStart)
  const overdue = todayHabits.filter(
    (habit) =>
      !isCompleteForPeriod(habit, now, weekStart) &&
      deadlineState(habit.deadline, now).level === 'overdue',
  ).length

  const anyVisible = sectionPeriods.some((period) => visibleFor(period).length > 0)

  async function handleCreate(input: HabitInput) {
    await create(input)
  }

  async function handleUpdate(input: HabitInput) {
    if (dialog.type !== 'edit') return
    await update(dialog.habit.id, input)
  }

  async function handleToggle(habit: Habit) {
    const completing = !isCompleteForPeriod(habit, now, weekStart)
    const updated = await toggle(habit.id)
    if (completing) {
      // A satisfying ding only when marking done, never when un-checking.
      void playCompletionSound(settings)
      announce(`${habit.name} done. ${updated.streakCount}-day streak.`)
      // Let the completion be taken back, exactly as the To-do list does.
      undo.push({
        message: `“${habit.name}” completed`,
        undoLabel: 'Undo',
        onUndo: () => toggle(habit.id).catch(() => undefined),
        onCommit: () => undefined,
      })
    } else {
      announce(`${habit.name} reopened.`)
    }
  }

  function requestDelete(habit: Habit) {
    setSelectedId(null)
    setDialog({ type: 'delete', habit })
  }

  function confirmDelete(habit: Habit) {
    setDialog({ type: 'none' })
    // Hide immediately, then actually delete when the undo window closes.
    setHidden((prev) => new Set(prev).add(habit.id))
    schedulePendingDelete('habit', habit.id)
    undo.push({
      message: `“${habit.name}” deleted`,
      onUndo: () => {
        clearPendingDelete('habit', habit.id)
        setHidden((prev) => {
          const next = new Set(prev)
          next.delete(habit.id)
          return next
        })
      },
      onCommit: () => {
        remove(habit.id)
          .catch(() => undefined)
          .finally(() => clearPendingDelete('habit', habit.id))
      },
    })
  }

  async function handleArchive(habit: Habit) {
    const next = !habit.archived
    setSelectedId(null)
    await archive(habit.id, next)
    undo.push({
      message: next ? `“${habit.name}” archived` : `“${habit.name}” restored`,
      undoLabel: 'Undo',
      onUndo: () => archive(habit.id, !next).catch(() => undefined),
      onCommit: () => undefined,
    })
  }

  function inputFrom(habit: Habit, patch: Partial<HabitInput> = {}): HabitInput {
    return {
      name: habit.name,
      colorIndex: habit.colorIndex,
      deadline: habit.deadline,
      schedule: habit.schedule,
      target: habit.target,
      category: habit.category,
      timeOfDay: habit.timeOfDay,
      reminderOffset: habit.reminderOffset,
      ...patch,
    }
  }

  /** Quick reclassify — move a habit to another period without opening the form. */
  async function handleMovePeriod(habit: Habit, next: DayPeriod) {
    if (habit.timeOfDay === next) return
    const previous = habit.timeOfDay
    setSelectedId(null)
    await update(habit.id, inputFrom(habit, { timeOfDay: next }))
    undo.push({
      message: `“${habit.name}” moved to ${PERIOD_LABELS[next]}`,
      undoLabel: 'Undo',
      onUndo: () =>
        update(habit.id, inputFrom(habit, { timeOfDay: previous })).catch(() => undefined),
      onCommit: () => undefined,
    })
  }

  function handleReorder(next: Habit[], sectionHabits: Habit[]) {
    if (!reorderable) return
    // Reorder only the section being dragged. The other periods keep their
    // slots so the stored order stays stable when the time of day changes.
    const moving = new Set(sectionHabits.map((h) => h.id))
    const queue = [...next]
    const merged = activeHabits.map((h) => (moving.has(h.id) ? (queue.shift() ?? h) : h))
    reorder(merged.map((h) => h.id)).catch(() => undefined)
  }

  /** Move one habit a slot up or down within its section (keyboard-friendly). */
  function moveInSection(sectionHabits: Habit[], id: number, delta: number) {
    if (!reorderable) return
    const ids = sectionHabits.map((h) => h.id)
    const from = ids.indexOf(id)
    const to = from + delta
    if (from < 0 || to < 0 || to >= ids.length) return
    const reordered = [...sectionHabits]
    ;[reordered[from], reordered[to]] = [reordered[to], reordered[from]]
    handleReorder(reordered, sectionHabits)
  }

  async function addTemplates(selected: HabitInput[]) {
    for (const input of selected) {
      await create(input)
    }
  }

  function openCreate(defaultPeriod: DayPeriod) {
    setCreatePeriod(defaultPeriod)
    setDialog({ type: 'create' })
  }

  const hasToday = todayHabits.length > 0

  return (
    <div className="safe-shell relative z-10 mx-auto max-w-2xl px-4 sm:px-6">
      <AppHeader
        subtitle="Grow gently, one day at a time."
        onOpenSettings={onOpenSettings}
        onOpenCalendar={() => setCalendarOpen(true)}
        onOpenInsights={() => setInsightsOpen(true)}
      />

      {/* Stats */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        className="mb-6 grid grid-cols-3 gap-2 sm:gap-3"
      >
        <Stat
          label="Done today"
          value={`${doneToday} / ${todayHabits.length}`}
          title="Habits completed today out of habits scheduled today"
        />
        <Stat
          label="Day streak"
          value={streak}
          accent={streak > 0}
          icon={Flame}
          title="Days in a row with at least one habit done"
        />
        <Stat
          label="Overdue"
          value={overdue}
          accent={overdue > 0}
          title="Habits past today's deadline and not done"
        />
      </motion.section>

      {/* Quick add — a sentence becomes a habit */}
      {!loading && !error && (
        <HabitQuickAddBar now={now} onCreate={handleCreate} guidance={settings.quickAddGuidance} />
      )}

      {/* Add habit */}
      <div className="mb-5 flex items-center justify-between gap-2">
        <h2 className="font-display text-base font-semibold text-ink sm:text-lg">Your habits</h2>
        <div className="flex items-center gap-2">
          {canFreeze && (
            <button
              type="button"
              onClick={() => setFreezeOpen(true)}
              aria-label={`Streak freezes: ${settings.freezeTokens} left`}
              title="Streak freezes"
              className="silicone-frost relative flex h-9 w-9 items-center justify-center rounded-full"
            >
              <FrozenFlame className="h-4 w-4" />
              <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full border border-white/70 bg-white px-1 text-[10px] font-bold text-sky-700 dark:border-sky-950 dark:bg-sky-900 dark:text-sky-100">
                {settings.freezeTokens}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setTemplatesOpen(true)}
            aria-label="Browse templates"
            title="Browse templates"
            className="silicone-quiet inline-flex h-9 w-9 items-center justify-center rounded-full
                       text-muted hover:text-ink sm:h-auto sm:w-auto sm:gap-1.5 sm:px-3 sm:py-2
                       sm:text-sm sm:font-medium"
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Templates</span>
          </button>
          <button
            type="button"
            onClick={() => openCreate(filter === 'all' ? periodFromTime(new Date()) : filter)}
            className="silicone-primary inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add habit
          </button>
        </div>
      </div>

      {/* Period filter — the whole day is shown by default; chips narrow it */}
      {!loading && !error && activeHabits.length > 0 && hasToday && (
        <>
          {showChips && (
            <div
              role="tablist"
              aria-label="Filter by time of day"
              onKeyDown={handleFilterKeyDown}
              className="mb-3 flex flex-wrap items-center gap-1.5"
            >
              {chipOptions.map((option) => {
                const selected = option === filter
                const stat = option === 'all' ? null : periodStats[option]
                const allDone = stat ? stat.total > 0 && stat.done === stat.total : false
                const stateClass = selected
                  ? 'bg-sage-500 text-white shadow-calm'
                  : allDone
                    ? 'bg-sage-100 text-sage-700 dark:bg-sage-900/50 dark:text-sage-200'
                    : 'bg-mint-100 text-sage-700 hover:bg-mint-200 dark:bg-mint-900/50 dark:text-mint-100 dark:hover:bg-mint-900/70'
                return (
                  <button
                    key={option}
                    type="button"
                    role="tab"
                    id={`period-filter-${option}`}
                    aria-selected={selected}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setFilter(option)}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium
                                transition-all duration-calm ease-calm ${stateClass}`}
                  >
                    {option === 'all' ? 'All day' : PERIOD_LABELS[option]}
                    {option !== 'all' && stat && stat.total > 0 && (
                      <span
                        className={`rounded-full px-1.5 text-xs font-semibold tabular-nums ${
                          selected ? 'bg-white/25' : 'bg-black/5 dark:bg-white/10'
                        }`}
                      >
                        {stat.done}/{stat.total}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          <div className="mb-4 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => updateSettings({ hideCompleted: !settings.hideCompleted })}
              aria-pressed={settings.hideCompleted}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium
                          transition-all duration-calm ease-calm ${
                            settings.hideCompleted
                              ? 'border-sage-400 bg-mint-100 text-sage-700 dark:bg-mint-900/40 dark:text-mint-100'
                              : 'border-line text-muted hover:text-ink'
                          }`}
            >
              <Check className="h-3.5 w-3.5" aria-hidden />
              Hide done
            </button>
            <label className="flex items-center gap-2 text-xs text-muted">
              <span className="sr-only sm:not-sr-only">Sort</span>
              <select
                aria-label="Sort habits"
                value={settings.habitSort}
                onChange={(e) => updateSettings({ habitSort: e.target.value as HabitSort })}
                className="rounded-calm-sm border border-line bg-surface py-1.5 pl-2 pr-1 text-xs text-ink
                           focus:border-sage-400 focus:outline-none focus:ring-2 focus:ring-sage-400/30"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </>
      )}

      <p className="sr-only" role="status" aria-live="polite">
        {liveMessage}
      </p>

      {/* Coach the very first completion, until anything has been ticked. */}
      {!loading &&
        !error &&
        todayHabits.length > 0 &&
        activeHabits.every((habit) => habit.history.length === 0) && (
          <p className="mb-3 rounded-calm-sm border border-dashed border-line bg-raised/60 px-3 py-2 text-xs text-muted">
            Tap the circle when you’ve done it. Miss a day and a gentle grace keeps your flame
            alive.
          </p>
        )}

      {/* Content */}
      {loading ? (
        <div className="space-y-3" aria-label="Loading habits">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-[76px] animate-pulse rounded-calm bg-mint-100 dark:bg-mint-900/40"
            />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-calm border border-peach-200 bg-peach-50 p-5 text-peach-700 dark:border-peach-900 dark:bg-peach-900/30 dark:text-peach-200">
          <p className="font-medium">We couldn’t load your habits.</p>
          <p className="mt-1 text-sm opacity-80">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="silicone mt-3 rounded-full px-4 py-2 text-sm font-semibold"
          >
            Try again
          </button>
        </div>
      ) : activeHabits.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center rounded-calm border border-dashed border-line bg-raised/60 px-6 py-14 text-center"
        >
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-mint-100 text-sage-500 dark:bg-mint-900/50 dark:text-sage-300">
            <Sparkles className="h-6 w-6" aria-hidden />
          </span>
          <h3 className="font-display text-lg font-semibold text-ink">A fresh start</h3>
          <p className="mt-1 max-w-xs text-sm text-muted">
            Add your first habit and begin building a gentle daily rhythm.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => openCreate(periodFromTime(new Date()))}
              className="silicone-primary inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Add your first habit
            </button>
            <button
              type="button"
              onClick={() => setTemplatesOpen(true)}
              className="silicone inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold"
            >
              <Sparkles className="h-4 w-4" aria-hidden />
              Browse templates
            </button>
          </div>
        </motion.div>
      ) : todayHabits.length === 0 ? (
        <div className="flex flex-col items-center rounded-calm border border-dashed border-line bg-raised/60 px-6 py-12 text-center">
          <h3 className="font-display text-base font-semibold text-ink">Nothing scheduled today</h3>
          <p className="mt-1 max-w-xs text-sm text-muted">
            Enjoy the space — your habits will appear here on the days they’re due.
          </p>
        </div>
      ) : sectionPeriods.length === 0 ? (
        <div className="flex flex-col items-center rounded-calm border border-dashed border-line bg-raised/60 px-6 py-12 text-center">
          <h3 className="font-display text-base font-semibold text-ink">
            No {PERIOD_LABELS[filter as DayPeriod].toLowerCase()} habits today
          </h3>
          <p className="mt-1 max-w-xs text-sm text-muted">
            Tap “All day” to see everything, or add a habit for this part of the day.
          </p>
          <button
            type="button"
            onClick={() => openCreate(filter as DayPeriod)}
            className="silicone mt-4 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add a {PERIOD_LABELS[filter as DayPeriod].toLowerCase()} habit
          </button>
        </div>
      ) : !anyVisible ? (
        <div className="flex flex-col items-center rounded-calm border border-dashed border-line bg-raised/60 px-6 py-12 text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-sage-100 text-sage-600 dark:bg-sage-900/50 dark:text-sage-300">
            <Check className="h-6 w-6" aria-hidden />
          </span>
          <h3 className="font-display text-base font-semibold text-ink">All done for now</h3>
          <p className="mt-1 max-w-xs text-sm text-muted">
            {filter === 'all'
              ? 'Everything for today is finished. Turn off “Hide done” to see it.'
              : `Nothing left in ${PERIOD_LABELS[filter as DayPeriod].toLowerCase()}. Turn off “Hide done” to see what you finished.`}
          </p>
        </div>
      ) : (
        sectionPeriods.map((period) => {
          const visible = visibleFor(period)
          if (visible.length === 0) return null
          return (
            <section key={period} className="mb-6 last:mb-0">
              {showChips && filter === 'all' && (
                <h3 className="mb-2 px-1 font-display text-sm font-semibold text-muted">
                  {PERIOD_LABELS[period]}
                </h3>
              )}
              <Reorder.Group
                as="ul"
                axis="y"
                values={visible}
                onReorder={(next) => handleReorder(next, visible)}
                className="space-y-3"
              >
                {visible.map((habit) => (
                  <HabitRow key={habit.id} habit={habit} reorderable={reorderable}>
                    <HabitCard
                      habit={habit}
                      now={now}
                      weekStart={weekStart}
                      busy={busyId === habit.id}
                      actionsOpen={selectedId === habit.id}
                      onToggleActions={() =>
                        setSelectedId((prev) => (prev === habit.id ? null : habit.id))
                      }
                      onToggle={handleToggle}
                      onEdit={(h) => {
                        setSelectedId(null)
                        setDialog({ type: 'edit', habit: h })
                      }}
                      onArchive={handleArchive}
                      onDelete={requestDelete}
                      onChangePeriod={handleMovePeriod}
                      onMoveUp={
                        reorderable ? () => moveInSection(visible, habit.id, -1) : undefined
                      }
                      onMoveDown={
                        reorderable ? () => moveInSection(visible, habit.id, 1) : undefined
                      }
                      canMoveUp={reorderable && visible[0]?.id !== habit.id}
                      canMoveDown={reorderable && visible[visible.length - 1]?.id !== habit.id}
                    />
                  </HabitRow>
                ))}
              </Reorder.Group>
            </section>
          )
        })
      )}

      {/* Habits that aren't on today's schedule */}
      {!loading && !error && orderedNotToday.length > 0 && (
        <section className="mt-6">
          <button
            type="button"
            onClick={() => setShowNotToday((v) => !v)}
            aria-expanded={showNotToday}
            className="silicone-quiet flex w-full items-center justify-between rounded-full px-4 py-2 text-sm font-medium text-muted hover:text-ink"
          >
            <span className="inline-flex items-center gap-2">
              <CalendarClock className="h-4 w-4" aria-hidden />
              Not today ({orderedNotToday.length})
            </span>
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-calm ease-calm ${
                showNotToday ? 'rotate-180' : ''
              }`}
              aria-hidden
            />
          </button>
          {showNotToday && (
            <>
              <p className="mt-3 text-xs text-muted">
                Not on today’s schedule. Tap the leaf to edit, or the circle to complete early.
              </p>
              <ul className="mt-3 space-y-3">
                {orderedNotToday.map((habit) => (
                  <li key={habit.id}>
                    <HabitCard
                      habit={habit}
                      now={now}
                      weekStart={weekStart}
                      dueToday={false}
                      busy={busyId === habit.id}
                      actionsOpen={selectedId === habit.id}
                      onToggleActions={() =>
                        setSelectedId((prev) => (prev === habit.id ? null : habit.id))
                      }
                      onToggle={handleToggle}
                      onEdit={(h) => {
                        setSelectedId(null)
                        setDialog({ type: 'edit', habit: h })
                      }}
                      onArchive={handleArchive}
                      onDelete={requestDelete}
                      onChangePeriod={handleMovePeriod}
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {/* Archived habits */}
      {!loading && archivedHabits.length > 0 && (
        <section className="mt-6">
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            aria-expanded={showArchived}
            className="silicone-quiet flex w-full items-center justify-between rounded-full px-4 py-2 text-sm font-medium text-muted hover:text-ink"
          >
            <span className="inline-flex items-center gap-2">
              <Archive className="h-4 w-4" aria-hidden />
              Archived ({archivedHabits.length})
            </span>
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-calm ease-calm ${
                showArchived ? 'rotate-180' : ''
              }`}
              aria-hidden
            />
          </button>
          {showArchived && (
            <ul className="mt-3 space-y-3">
              {archivedHabits.map((habit) => (
                <li key={habit.id}>
                  <HabitCard
                    habit={habit}
                    now={now}
                    weekStart={weekStart}
                    busy={busyId === habit.id}
                    actionsOpen={selectedId === habit.id}
                    onToggleActions={() =>
                      setSelectedId((prev) => (prev === habit.id ? null : habit.id))
                    }
                    onToggle={handleToggle}
                    onEdit={(h) => {
                      setSelectedId(null)
                      setDialog({ type: 'edit', habit: h })
                    }}
                    onArchive={handleArchive}
                    onDelete={requestDelete}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <footer className="mt-10 text-center text-xs text-muted">
        Tap the circle to complete · use the chips to filter by time of day · press and hold to
        reorder.
      </footer>

      <UndoToast item={undo.item} onUndo={undo.undo} onDismiss={undo.commitNow} />

      {/* Consistency calendar overlay */}
      <AnimatePresence>
        {calendarOpen && (
          <CalendarView
            habits={habits}
            historyStart={historyStart}
            weekStart={weekStart}
            now={now}
            onClose={() => setCalendarOpen(false)}
          />
        )}
        {insightsOpen && (
          <InsightsView
            habits={habits}
            historyStart={historyStart}
            weekStart={weekStart}
            now={now}
            onClose={() => setInsightsOpen(false)}
          />
        )}
        {templatesOpen && (
          <TemplatePicker
            onClose={() => setTemplatesOpen(false)}
            onCreate={(chosen) => addTemplates(toHabitInputs(chosen))}
          />
        )}
        {freezeOpen && (
          <FreezeSheet
            tokens={settings.freezeTokens}
            atRisk={atRiskHabits}
            now={now}
            onFreeze={(habit) => {
              freeze(habit.id).catch(() => undefined)
            }}
            onClose={() => setFreezeOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Dialogs */}
      <AnimatePresence>
        {(dialog.type === 'create' || dialog.type === 'edit') && (
          <HabitForm
            key={dialog.type === 'edit' ? `edit-${dialog.habit.id}` : 'create'}
            mode={dialog.type}
            habit={dialog.type === 'edit' ? dialog.habit : null}
            defaultPeriod={createPeriod ?? undefined}
            archived={dialog.type === 'edit' ? dialog.habit.archived : false}
            onArchive={
              dialog.type === 'edit'
                ? () => {
                    const habit = dialog.habit
                    setDialog({ type: 'none' })
                    void handleArchive(habit)
                  }
                : undefined
            }
            onClose={() => setDialog({ type: 'none' })}
            onSubmit={dialog.type === 'edit' ? handleUpdate : handleCreate}
          />
        )}
        {dialog.type === 'delete' && (
          <DeleteConfirm
            key={`delete-${dialog.habit.id}`}
            name={dialog.habit.name}
            title="Delete this habit?"
            description={
              <>
                and{' '}
                {dialog.habit.streakCount > 0
                  ? `its ${dialog.habit.streakCount}-day streak`
                  : 'its history'}{' '}
                will be removed. You can undo this for a few seconds.
              </>
            }
            onCancel={() => setDialog({ type: 'none' })}
            onConfirm={async () => confirmDelete(dialog.habit)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
