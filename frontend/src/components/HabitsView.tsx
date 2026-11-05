import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
} from 'react'
import { AnimatePresence, motion, Reorder, useDragControls, useReducedMotion } from 'framer-motion'
import {
  Archive,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronDown,
  Flame,
  Plus,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'
import { BrandHeader } from './BrandHeader'
import { HabitCard } from './HabitCard'
import { HabitForm } from './HabitForm'
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
  groupByPeriod,
  periodFromTime,
  periodIndex,
  shiftPeriod,
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
  const now = useNow()
  const undo = useUndoQueue()
  const { commitNow } = undo
  const reduceMotion = useReducedMotion()
  // Chosen once on launch so the view never jumps while the app is open.
  const [period, setPeriod] = useState<DayPeriod>(() => periodFromTime(new Date()))
  const [slide, setSlide] = useState(1)
  const touchStart = useRef<{ x: number; y: number; at: number } | null>(null)
  const firstPeriodRender = useRef(true)

  // Commit any pending delete when leaving the screen, so a tab switch can't
  // resurrect an optimistically-hidden habit.
  useEffect(() => () => commitNow(), [commitNow])

  // The welcome tour can ask for the template picker as soon as Habits mounts.
  useEffect(() => {
    if (!autoOpenTemplates) return
    setTemplatesOpen(true)
    onTemplatesHandled?.()
  }, [autoOpenTemplates, onTemplatesHandled])

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

  const periodHabits = periodGroups[period]
  const ordered = useMemo(
    () => orderHabits(periodHabits, settings.habitSort, now, weekStart),
    [periodHabits, settings.habitSort, now, weekStart],
  )
  const visibleHabits = settings.hideCompleted
    ? ordered.filter((habit) => !isCompleteForPeriod(habit, now, weekStart))
    : ordered
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

  function selectPeriod(next: DayPeriod) {
    if (next === period) return
    setSlide(periodIndex(next) > periodIndex(period) ? 1 : -1)
    setPeriod(next)
  }

  function movePeriod(delta: number) {
    const next = shiftPeriod(period, delta)
    if (next === period) return
    setSlide(delta > 0 ? 1 : -1)
    setPeriod(next)
  }

  function handleTabsKeyDown(event: ReactKeyboardEvent) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const next = shiftPeriod(period, event.key === 'ArrowRight' ? 1 : -1)
    selectPeriod(next)
    requestAnimationFrame(() => document.getElementById(`period-tab-${next}`)?.focus())
  }

  function handleTouchStart(event: ReactTouchEvent) {
    if (event.touches.length !== 1) {
      touchStart.current = null
      return
    }
    const touch = event.touches[0]
    touchStart.current = { x: touch.clientX, y: touch.clientY, at: Date.now() }
  }

  function handleTouchEnd(event: ReactTouchEvent) {
    const start = touchStart.current
    touchStart.current = null
    if (!start) return
    // A long press is a reorder drag, not a swipe.
    if (Date.now() - start.at > 450) return
    const touch = event.changedTouches[0]
    if (!touch) return
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y
    if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.4) return
    // Buttons keep their own taps and gestures.
    if ((event.target as HTMLElement | null)?.closest('button, a, input, select, textarea')) return
    movePeriod(dx < 0 ? 1 : -1)
  }

  // When "follow the clock" is on, advance the visible period as the day moves.
  useEffect(() => {
    if (!settings.followClock) return
    const current = periodFromTime(now)
    if (current === period) return
    setSlide(periodIndex(current) > periodIndex(period) ? 1 : -1)
    setPeriod(current)
  }, [now, settings.followClock, period])

  // A swipe or tab change shouldn't leave the reader mid-scroll.
  useEffect(() => {
    if (firstPeriodRender.current) {
      firstPeriodRender.current = false
      return
    }
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' })
  }, [period, reduceMotion])

  const doneToday = todayHabits.filter((habit) => isCompleteForPeriod(habit, now, weekStart)).length
  const streak = dailyStreak(activeHabits, now, historyStart)
  const overdue = todayHabits.filter(
    (habit) =>
      !isCompleteForPeriod(habit, now, weekStart) &&
      deadlineState(habit.deadline, now).level === 'overdue',
  ).length

  const stats = periodStats[period]
  const liveMessage = `${PERIOD_LABELS[period]}: ${stats.total} habit${
    stats.total === 1 ? '' : 's'
  }${stats.total ? `, ${stats.done} done` : ''}`

  async function handleCreate(input: HabitInput) {
    await create(input)
  }

  async function handleUpdate(input: HabitInput) {
    if (dialog.type !== 'edit') return
    await update(dialog.habit.id, input)
  }

  async function handleToggle(habit: Habit) {
    const completing = !isCompleteForPeriod(habit, now, weekStart)
    await toggle(habit.id)
    // A satisfying ding only when marking done, never when un-checking.
    if (completing) void playCompletionSound(settings)
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

  function handleReorder(next: Habit[]) {
    if (!reorderable) return
    // Reorder only the visible period. The other periods keep their slots so
    // the stored order stays stable when the time of day changes.
    const moving = new Set(visibleHabits.map((h) => h.id))
    const queue = [...next]
    const merged = activeHabits.map((h) => (moving.has(h.id) ? (queue.shift() ?? h) : h))
    reorder(merged.map((h) => h.id)).catch(() => undefined)
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
    <div
      className="safe-shell relative z-10 mx-auto max-w-2xl px-4 sm:px-6"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <BrandHeader subtitle="Grow gently, one day at a time." onOpenSettings={onOpenSettings}>
        <button
          type="button"
          onClick={() => setCalendarOpen(true)}
          aria-label="Open consistency calendar"
          title="Consistency calendar"
          className="silicone flex h-10 w-10 items-center justify-center rounded-full text-muted
                     hover:text-sage-500 dark:hover:text-sage-300"
        >
          <CalendarDays className="h-5 w-5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => setInsightsOpen(true)}
          aria-label="Open insights"
          title="Insights"
          className="silicone flex h-10 w-10 items-center justify-center rounded-full text-muted
                     hover:text-sage-500 dark:hover:text-sage-300"
        >
          <TrendingUp className="h-5 w-5" aria-hidden />
        </button>
        <ThemeToggle />
      </BrandHeader>

      {/* Stats */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        className="mb-6 grid grid-cols-3 gap-2 sm:gap-3"
      >
        <Stat
          label="Done today"
          value={`${doneToday} | ${todayHabits.length}`}
          title="Habits completed today / habits scheduled today"
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
            onClick={() => openCreate(period)}
            className="silicone-primary inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add habit
          </button>
        </div>
      </div>

      {/* Period switcher — one period visible at a time */}
      {!loading && !error && activeHabits.length > 0 && hasToday && (
        <>
          <div
            role="tablist"
            aria-label="Time of day"
            onKeyDown={handleTabsKeyDown}
            className="mb-3 flex flex-wrap items-center gap-1.5"
          >
            {DAY_PERIODS.map((option) => {
              const selected = option === period
              const stat = periodStats[option]
              const allDone = stat.total > 0 && stat.done === stat.total
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
                  id={`period-tab-${option}`}
                  aria-selected={selected}
                  aria-controls={`period-panel-${option}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => selectPeriod(option)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium
                              transition-all duration-calm ease-calm ${stateClass}`}
                >
                  {PERIOD_LABELS[option]}
                  {stat.total > 0 && (
                    <span
                      className={`rounded-full px-1.5 text-[10px] font-semibold tabular-nums ${
                        selected ? 'bg-white/25' : 'bg-black/5 dark:bg-white/10'
                      }`}
                    >
                      {stat.done}/{stat.total}
                    </span>
                  )}
                  {stat.overdue > 0 && (
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        selected ? 'bg-white' : 'bg-peach-500 dark:bg-peach-300'
                      }`}
                      aria-hidden
                    />
                  )}
                </button>
              )
            })}
          </div>

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

          <div className="mb-3 flex justify-center gap-1.5" aria-hidden>
            {DAY_PERIODS.map((option) => (
              <span
                key={option}
                className={`h-1.5 rounded-full transition-all duration-calm ease-calm ${
                  option === period ? 'w-4 bg-sage-400' : 'w-1.5 bg-mint-300 dark:bg-mint-800'
                }`}
              />
            ))}
          </div>
        </>
      )}

      <p className="sr-only" role="status" aria-live="polite">
        {liveMessage}
      </p>

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
      ) : (
        <div aria-live="polite">
          <motion.div
            key={period}
            id={`period-panel-${period}`}
            role="tabpanel"
            aria-labelledby={`period-tab-${period}`}
            initial={{ opacity: 0, x: reduceMotion ? 0 : slide * 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          >
            {todayHabits.length === 0 ? (
              <div className="flex flex-col items-center rounded-calm border border-dashed border-line bg-raised/60 px-6 py-12 text-center">
                <h3 className="font-display text-base font-semibold text-ink">
                  Nothing scheduled today
                </h3>
                <p className="mt-1 max-w-xs text-sm text-muted">
                  Enjoy the space — your habits will appear here on the days they’re due.
                </p>
              </div>
            ) : periodHabits.length === 0 ? (
              <div className="flex flex-col items-center rounded-calm border border-dashed border-line bg-raised/60 px-6 py-12 text-center">
                <h3 className="font-display text-base font-semibold text-ink">
                  No {PERIOD_LABELS[period].toLowerCase()} habits today
                </h3>
                <p className="mt-1 max-w-xs text-sm text-muted">
                  Swipe or tap another part of the day to see what’s waiting.
                </p>
                <button
                  type="button"
                  onClick={() => openCreate(period)}
                  className="silicone mt-4 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  Add a {PERIOD_LABELS[period].toLowerCase()} habit
                </button>
              </div>
            ) : visibleHabits.length === 0 ? (
              <div className="flex flex-col items-center rounded-calm border border-dashed border-line bg-raised/60 px-6 py-12 text-center">
                <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-sage-100 text-sage-600 dark:bg-sage-900/50 dark:text-sage-300">
                  <Check className="h-6 w-6" aria-hidden />
                </span>
                <h3 className="font-display text-base font-semibold text-ink">All done for now</h3>
                <p className="mt-1 max-w-xs text-sm text-muted">
                  Nothing left in {PERIOD_LABELS[period].toLowerCase()}. Turn off “Hide done” to see
                  what you finished.
                </p>
              </div>
            ) : (
              <Reorder.Group
                as="ul"
                axis="y"
                values={visibleHabits}
                onReorder={handleReorder}
                className="space-y-3"
              >
                {visibleHabits.map((habit) => (
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
                    />
                  </HabitRow>
                ))}
              </Reorder.Group>
            )}
          </motion.div>
        </div>
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
        Tap the circle to complete · swipe left or right for another time of day · press and hold to
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
