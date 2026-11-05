import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Portal } from './Portal'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { Habit, WeekStart } from '../types'
import {
  dayDescription,
  dayStatus,
  monthGrid,
  monthLabel,
  weekdayInitials,
  type DayStatus,
} from '../lib/calendar'
import { toISODate } from '../lib/streak'

interface CalendarViewProps {
  habits: Habit[]
  historyStart: string | null
  weekStart: WeekStart
  now: Date
  onClose: () => void
}

/* A short coloured bar under each day quietly shows how much was finished. */
const BAR_STYLE: Record<DayStatus, string> = {
  future: 'bg-transparent',
  none: 'bg-transparent',
  empty: 'bg-cal-empty',
  partial: 'bg-cal-partial',
  full: 'bg-cal-full',
}

/* The day number stays neutral so the dots are what catch the eye. */
const DAY_TEXT: Record<DayStatus, string> = {
  future: 'text-muted/40',
  none: 'text-muted',
  empty: 'text-ink',
  partial: 'text-ink',
  full: 'text-ink',
}

const LEGEND: { status: DayStatus; label: string }[] = [
  { status: 'full', label: 'All done' },
  { status: 'partial', label: 'Some done' },
  { status: 'empty', label: 'Nothing done' },
  { status: 'none', label: 'No data' },
]

/* Direction-aware month slide — the two months cross-slide at the same time. */
const monthVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir >= 0 ? 28 : -28 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir >= 0 ? -28 : 28 }),
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function CalendarView({ habits, historyStart, weekStart, now, onClose }: CalendarViewProps) {
  const today = toISODate(now)
  const [view, setView] = useState(() => startOfMonth(now))
  const [dir, setDir] = useState(0)

  const atCurrentMonth =
    view.getFullYear() === now.getFullYear() && view.getMonth() === now.getMonth()

  const cells = useMemo(
    () => monthGrid(view.getFullYear(), view.getMonth(), weekStart),
    [view, weekStart],
  )

  /* How many days this month were fully completed — a gentle pat on the back. */
  const fullDays = useMemo(
    () => cells.filter((c) => c && dayStatus(c.iso, habits, historyStart, today) === 'full').length,
    [cells, habits, historyStart, today],
  )

  function go(delta: number) {
    if (delta > 0 && atCurrentMonth) return
    setDir(delta)
    setView((v) => new Date(v.getFullYear(), v.getMonth() + delta, 1))
  }

  function goToday() {
    setDir(view < startOfMonth(now) ? 1 : -1)
    setView(startOfMonth(now))
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <Portal>
      <motion.div
        className="fixed inset-0 z-50 overflow-y-auto bg-page"
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      >
        <motion.section
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          className="safe-shell relative mx-auto flex min-h-full max-w-xl flex-col px-4 sm:px-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="calendar-title"
        >
          {/* Header */}
          <header className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h2
                id="calendar-title"
                className="font-display text-xl font-semibold tracking-tight text-ink sm:text-2xl"
              >
                Consistency
              </h2>
              <p className="mt-1 text-xs text-muted sm:text-sm">
                {fullDays > 0
                  ? `${fullDays} day${fullDays === 1 ? '' : 's'} fully done this month.`
                  : 'Each day fills in as you complete your habits.'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close calendar"
              title="Close calendar"
              className="silicone flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted
                         hover:text-sage-500 dark:hover:text-sage-300"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </header>

          {/* Month navigation */}
          <div className="mb-4 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous month"
              className="silicone flex h-9 w-9 items-center justify-center rounded-full text-muted
                         hover:text-sage-500 dark:hover:text-sage-300"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>

            <div className="flex flex-col items-center">
              <span className="font-display text-base font-semibold text-ink sm:text-lg">
                {monthLabel(view.getFullYear(), view.getMonth())}
              </span>
              {!atCurrentMonth && (
                <button
                  type="button"
                  onClick={goToday}
                  className="silicone-quiet mt-1 rounded-full px-2.5 py-0.5 text-xs font-medium text-sage-600
                             hover:text-sage-500 dark:text-sage-300 dark:hover:text-sage-200"
                >
                  Jump to today
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => go(1)}
              disabled={atCurrentMonth}
              aria-label="Next month"
              className="silicone flex h-9 w-9 items-center justify-center rounded-full text-muted
                         hover:text-sage-500 dark:hover:text-sage-300
                         disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          </div>

          {/* Weekday labels */}
          <div className="mb-1 grid grid-cols-7 gap-1 sm:gap-1.5">
            {weekdayInitials(weekStart).map((day, i) => (
              <div
                key={i}
                className="py-1 text-center text-[10px] font-medium uppercase tracking-wide text-muted sm:text-xs"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Month grid — both months share one grid area so the height never
              jumps, and they slide across at the same time for a smooth swap. */}
          <div className="grid overflow-hidden">
            <AnimatePresence custom={dir} initial={false}>
              <motion.div
                key={`${view.getFullYear()}-${view.getMonth()}`}
                custom={dir}
                variants={monthVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.26, ease: [0.4, 0, 0.2, 1] }}
                className="col-start-1 row-start-1 grid grid-cols-7 gap-1 sm:gap-1.5"
              >
                {cells.map((cell, i) => {
                  if (!cell) return <div key={`blank-${i}`} />
                  const status = dayStatus(cell.iso, habits, historyStart, today)
                  const isToday = cell.iso === today
                  const label = dayDescription(cell.iso, habits, historyStart, today)
                  return (
                    <div
                      key={cell.iso}
                      data-date={cell.iso}
                      role="img"
                      aria-label={label}
                      title={label}
                      className={`relative flex aspect-square flex-col items-center justify-center gap-1
                                rounded-calm-sm text-xs font-medium sm:text-sm
                                transition-colors duration-calm ease-calm
                                ${isToday ? '' : DAY_TEXT[status]}
                                ${
                                  !isToday && status !== 'future'
                                    ? 'hover:bg-mint-100 dark:hover:bg-mint-800/50'
                                    : ''
                                }`}
                    >
                      {isToday && (
                        /* Today's highlight sits slightly inside the cell (85%). */
                        <span
                          className="absolute inset-[7.5%] rounded-calm-sm bg-sage-100 ring-1 ring-sage-300 dark:bg-sage-900/50 dark:ring-sage-700"
                          aria-hidden
                        />
                      )}
                      <span
                        className={`relative leading-none ${
                          isToday ? 'font-semibold text-sage-700 dark:text-sage-100' : ''
                        }`}
                      >
                        {cell.day}
                      </span>
                      <span
                        className={`relative h-[3px] w-5 rounded-full transition-colors duration-calm ease-calm ${BAR_STYLE[status]}`}
                        aria-hidden
                      />
                    </div>
                  )
                })}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Legend */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-line pt-4">
            {LEGEND.map((item) => (
              <span
                key={item.status}
                className="inline-flex items-center gap-1.5 text-xs text-muted"
              >
                <span
                  className={`h-[3px] w-5 rounded-full ${BAR_STYLE[item.status]} ${
                    item.status === 'none' ? 'border border-line' : ''
                  }`}
                  aria-hidden
                />
                {item.label}
              </span>
            ))}
          </div>

          <p className="mt-4 pb-2 text-center text-xs text-muted">
            Tap a day’s colour to read its title. “No data” marks days before you started tracking.
          </p>
        </motion.section>
      </motion.div>
    </Portal>
  )
}
