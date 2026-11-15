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
import { AnimatePresence, motion, Reorder, useDragControls, useReducedMotion } from 'framer-motion'
import { Archive, CalendarClock, Check, Plus, Sparkles, X } from 'lucide-react'
import { AppHeader } from './AppHeader'
import { HabitCard } from './HabitCard'
import { HabitForm } from './HabitForm'
import { DeleteConfirm } from './DeleteConfirm'
import { CalendarView } from './CalendarView'
import { InsightsView } from './InsightsView'
import { TemplatePicker, toHabitInputs } from './TemplatePicker'
import { FreezeSheet } from './FreezeSheet'
import { FrozenFlame } from './FrozenFlame'
import { DaySummary } from './DaySummary'
import { Button } from './ui/Button'
import { Chip } from './ui/Chip'
import { Collapsible } from './ui/Collapsible'
import { EmptyState } from './ui/EmptyState'
import { ErrorState } from './ui/ErrorState'
import { SELECT_CHEVRON } from './ui/Field'
import { IconButton } from './ui/IconButton'
import { SectionHeading } from './ui/SectionHeading'
import { SkeletonList } from './ui/Skeleton'
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
import { celebrate, tap } from '../lib/feedback'
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

/** Streak lengths that earn a slightly stronger celebration. */
const MILESTONE_STREAKS = [7, 30, 100]

/** How long the "following the clock" notice stays before fading away. */
const CLOCK_NOTICE_MS = 6000

/**
 * A calm, human line about the day, shown beside the progress figure. It
 * never scolds: a missed deadline is framed as "still open", and an empty day
 * simply points at the next small step.
 */
function dayMessage({
  done,
  total,
  overdue,
  hasHabits,
}: {
  done: number
  total: number
  overdue: number
  hasHabits: boolean
}): string {
  if (!hasHabits) return 'Add a habit to begin your rhythm.'
  if (total === 0) return 'Nothing scheduled today — enjoy the space.'
  if (overdue > 0) {
    return overdue === 1
      ? 'One habit is past its deadline — still time to close the day well.'
      : `${overdue} habits are past their deadline — still time to close the day well.`
  }
  if (done === total) return 'Everything done. A good day, gently finished.'
  if (done === 0) return 'A fresh day. Begin with the smallest one.'
  return `${total - done} left to go. One at a time.`
}

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
    // Interactive controls keep their own gestures (taps, the overflow menu).
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
  /** One-shot card pulse per habit, keyed by id (opt-in celebrations only). */
  const [pulses, setPulses] = useState<
    Record<number, { kind: 'habit' | 'milestone'; seq: number }>
  >({})
  /** The view a follow-the-clock step moved away from, for a gentle Undo. */
  const [clockNotice, setClockNotice] = useState<{
    from: DayPeriod | 'all'
    to: DayPeriod
  } | null>(null)
  const now = useNow()
  const reducedMotion = useReducedMotion()
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

  /** Undo a follow-the-clock step: return to the view we were on. */
  function undoClockAdvance() {
    if (!clockNotice) return
    setFilter(clockNotice.from)
    setClockNotice(null)
  }

  // When "follow the clock" is on, step the filter as the day moves. Switching
  // it on adopts the current period even from the all-day list; after that the
  // all-day list and Anytime are left alone when the reader picks them.
  useEffect(() => {
    const current = periodFromTime(now)
    if (!settings.followClock) {
      wasFollowingClock.current = false
      lastClockPeriod.current = current
      return
    }

    const justEnabled = !wasFollowingClock.current
    wasFollowingClock.current = true
    const target = clockAdvance(filter, current, lastClockPeriod.current, justEnabled)
    lastClockPeriod.current = current
    if (!target) return
    // The view moved on its own, so offer a way back instead of changing it
    // silently. With the notice off, advance quietly.
    if (settings.followClockNotice) {
      setClockNotice({ from: filter, to: target })
    }
    setFilter(target)
  }, [now, settings.followClock, settings.followClockNotice, filter])

  // Auto-dismiss the follow-the-clock notice after a few calm seconds.
  useEffect(() => {
    if (!clockNotice) return
    const timer = setTimeout(() => setClockNotice(null), CLOCK_NOTICE_MS)
    return () => clearTimeout(timer)
  }, [clockNotice])

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
      // Quiet, opt-in feedback: a light tap and, when enabled, a soft
      // celebration with a one-shot card pulse. All of it no-ops unless the
      // user turned it on, and motion is respected.
      const feedback = { haptics: settings.haptics, celebrations: settings.celebrations }
      tap(feedback)
      if (settings.celebrations && !reducedMotion) {
        const kind = MILESTONE_STREAKS.includes(updated.streakCount) ? 'milestone' : 'habit'
        celebrate(feedback, kind)
        setPulses((prev) => ({
          ...prev,
          [habit.id]: { kind, seq: (prev[habit.id]?.seq ?? 0) + 1 },
        }))
      }
      // Keep the count out of the announcement when it isn't on screen.
      announce(
        settings.streakDisplay === 'flame'
          ? `${habit.name} done. ${updated.streakCount}-day streak.`
          : `${habit.name} done.`,
      )
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

      {/* Today at a glance — the day's progress leads the screen. Hidden for a
          user with no habits yet, where "0/0 · 0 days in a row" is only noise
          sitting above the empty state that already explains what to do. */}
      {!loading && !error && activeHabits.length > 0 && (
        <DaySummary
          done={doneToday}
          total={todayHabits.length}
          streak={streak}
          overdue={overdue}
          message={dayMessage({
            done: doneToday,
            total: todayHabits.length,
            overdue,
            hasHabits: activeHabits.length > 0,
          })}
        />
      )}

      {/* Add habit */}
      <SectionHeading
        action={
          <>
            {/* With no habits there is nothing to freeze, so the control (and
                its loud frost badge) stays out of the empty state. */}
            {canFreeze && activeHabits.length > 0 && (
              <IconButton
                icon={FrozenFlame}
                label={`Streak freezes: ${settings.freezeTokens} left`}
                tone="frost"
                size="sm"
                badge={settings.freezeTokens}
                onClick={() => setFreezeOpen(true)}
              />
            )}
            {activeHabits.length > 0 && (
              <Button
                icon={Sparkles}
                variant="secondary"
                size="sm"
                iconOnlyOnMobile
                onClick={() => setTemplatesOpen(true)}
              >
                Templates
              </Button>
            )}
            <Button
              icon={Plus}
              variant="primary"
              size="sm"
              onClick={() => openCreate(filter === 'all' ? periodFromTime(new Date()) : filter)}
            >
              Add habit
            </Button>
          </>
        }
      >
        Your habits
      </SectionHeading>

      {/* A view that advanced with the clock offers a calm way back. */}
      <AnimatePresence>
        {clockNotice && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            role="status"
            className="mb-4 flex items-center justify-between gap-3 border-l-2 border-sage-400 py-0.5 pl-3 text-xs text-muted"
          >
            <span className="min-w-0 flex-1">
              Following the clock. Showing {PERIOD_LABELS[clockNotice.to]}.
            </span>
            <span className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={undoClockAdvance}
                className="rounded-full px-2.5 py-1 text-xs font-semibold text-sage-600 transition-colors duration-calm ease-calm hover:bg-sage-500/10 dark:text-sage-300"
              >
                Undo
              </button>
              <button
                type="button"
                onClick={() => setClockNotice(null)}
                aria-label="Dismiss"
                title="Dismiss"
                className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition-colors duration-calm ease-calm hover:text-ink"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </span>
          </motion.div>
        )}
      </AnimatePresence>

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
                const stat = option === 'all' ? null : periodStats[option]
                return (
                  <Chip
                    key={option}
                    id={`period-filter-${option}`}
                    selected={option === filter}
                    ariaSelected={option === filter}
                    tabIndex={option === filter ? 0 : -1}
                    onClick={() => setFilter(option)}
                    count={
                      option !== 'all' && stat && stat.total > 0
                        ? `${stat.done}/${stat.total}`
                        : undefined
                    }
                  >
                    {option === 'all' ? 'All day' : PERIOD_LABELS[option]}
                  </Chip>
                )
              })}
            </div>
          )}

          <div className="mb-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => updateSettings({ hideCompleted: !settings.hideCompleted })}
              aria-pressed={settings.hideCompleted}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium
                          transition-colors duration-calm ease-calm ${
                            settings.hideCompleted
                              ? 'bg-sage-500/10 text-sage-700 dark:bg-sage-400/10 dark:text-sage-300'
                              : 'text-muted hover:text-ink'
                          }`}
            >
              <Check className="h-3.5 w-3.5" aria-hidden />
              Hide done
            </button>
            <label className="flex items-center gap-1.5 text-xs text-muted">
              <span className="sr-only sm:not-sr-only">Sort</span>
              <select
                aria-label="Sort habits"
                value={settings.habitSort}
                onChange={(e) => updateSettings({ habitSort: e.target.value as HabitSort })}
                className="cursor-pointer appearance-none rounded-full border border-line bg-transparent py-1.5 pl-3 pr-6
                           text-xs font-medium text-muted transition-colors duration-calm ease-calm
                           hover:border-sage-300 hover:text-ink focus:border-sage-400 focus:outline-none
                           focus:ring-2 focus:ring-sage-400/30"
                style={SELECT_CHEVRON}
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
          <p className="mb-4 border-l-2 border-sage-300 py-0.5 pl-3 text-xs leading-relaxed text-muted">
            Tap the circle when you’ve done it. Miss a day and a gentle grace keeps it going.
          </p>
        )}

      {/* Content */}
      {loading ? (
        <SkeletonList rows={3} label="Loading habits" />
      ) : error ? (
        <ErrorState
          title="We couldn’t load your habits."
          detail={error}
          onRetry={() => window.location.reload()}
        />
      ) : activeHabits.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="A fresh start"
          description="Add your first habit and begin building a gentle daily rhythm. One habit is enough to begin."
          actions={
            <>
              <Button
                icon={Plus}
                variant="primary"
                onClick={() => openCreate(periodFromTime(new Date()))}
              >
                Add your first habit
              </Button>
              <Button icon={Sparkles} variant="secondary" onClick={() => setTemplatesOpen(true)}>
                Browse templates
              </Button>
            </>
          }
        />
      ) : todayHabits.length === 0 ? (
        <EmptyState
          compact
          title="Nothing scheduled today"
          description="Enjoy the space — your habits will appear here on the days they’re due."
        />
      ) : sectionPeriods.length === 0 ? (
        <EmptyState
          compact
          title={`No ${PERIOD_LABELS[filter as DayPeriod].toLowerCase()} habits today`}
          description="Tap “All day” to see everything, or add a habit for this part of the day."
          actions={
            <Button icon={Plus} variant="secondary" onClick={() => openCreate(filter as DayPeriod)}>
              Add a {PERIOD_LABELS[filter as DayPeriod].toLowerCase()} habit
            </Button>
          }
        />
      ) : !anyVisible ? (
        <EmptyState
          icon={Check}
          compact
          title="All done for now"
          description={
            filter === 'all'
              ? 'Everything for today is finished. Turn off “Hide done” to see it.'
              : `Nothing left in ${PERIOD_LABELS[filter as DayPeriod].toLowerCase()}. Turn off “Hide done” to see what you finished.`
          }
        />
      ) : (
        sectionPeriods.map((period) => {
          const visible = visibleFor(period)
          if (visible.length === 0) return null
          return (
            <section key={period} className="mb-6 last:mb-0">
              {showChips && filter === 'all' && (
                <SectionHeading variant="label">{PERIOD_LABELS[period]}</SectionHeading>
              )}
              <Reorder.Group
                as="ul"
                axis="y"
                values={visible}
                onReorder={(next) => handleReorder(next, visible)}
                className=""
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
                      pulse={pulses[habit.id] ?? null}
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
          <Collapsible
            title="Not today"
            count={orderedNotToday.length}
            icon={CalendarClock}
            open={showNotToday}
            onToggle={() => setShowNotToday((v) => !v)}
            hint="Not on today’s schedule. Tap the menu to edit, or the circle to complete early."
          >
            <ul>
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
                    pulse={pulses[habit.id] ?? null}
                  />
                </li>
              ))}
            </ul>
          </Collapsible>
        </section>
      )}

      {/* Archived habits */}
      {!loading && archivedHabits.length > 0 && (
        <section className="mt-4">
          <Collapsible
            title="Archived"
            count={archivedHabits.length}
            icon={Archive}
            open={showArchived}
            onToggle={() => setShowArchived((v) => !v)}
          >
            <ul>
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
                    pulse={pulses[habit.id] ?? null}
                  />
                </li>
              ))}
            </ul>
          </Collapsible>
        </section>
      )}

      <footer className="mt-10 text-center text-xs leading-relaxed text-muted">
        Tap the circle to complete · press and hold to reorder.
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
