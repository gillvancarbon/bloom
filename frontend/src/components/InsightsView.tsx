import { useState } from 'react'
import { motion } from 'framer-motion'
import { Portal } from './Portal'
import { Stat } from './Stat'
import { CalendarDays, ChevronDown, ChevronLeft, TrendingUp } from 'lucide-react'
import type { Habit, WeekStart } from '../types'
import {
  insightsSummary,
  insightHeadline,
  bestStreak,
  weeklyReview,
  milestones,
  habitCompletion,
} from '../lib/insights'
import { scheduleLabel } from '../lib/schedule'

interface InsightsViewProps {
  habits: Habit[]
  historyStart: string | null
  weekStart: WeekStart
  now: Date
  onClose: () => void
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`
}

export function InsightsView({ habits, historyStart, weekStart, now, onClose }: InsightsViewProps) {
  const summary = insightsSummary(habits, now, historyStart, weekStart)
  const live = habits.filter((h) => !h.archived)
  const review = weeklyReview(habits, now, historyStart, weekStart)
  const [openId, setOpenId] = useState<number | null>(null)

  // A plain-language equivalent of the bar chart, for screen readers.
  const monthCounts = summary.points.reduce(
    (acc, point) => {
      if (point.total === 0) acc.none += 1
      else if (point.done >= point.total) acc.full += 1
      else if (point.done > 0) acc.partial += 1
      else acc.quiet += 1
      return acc
    },
    { full: 0, partial: 0, quiet: 0, none: 0 },
  )

  // When nothing has been logged recently, lead with calm copy instead of a
  // wall of 0% values. Lifetime totals stay below in the per-habit list.
  const hasRecentActivity = summary.points.some((point) => point.done > 0)

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
          aria-labelledby="insights-title"
        >
          <header className="mb-5 flex items-start gap-3">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close insights"
              className="silicone mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted
                         hover:text-sage-500 dark:hover:text-sage-300"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <div>
              <h1
                id="insights-title"
                className="font-display text-xl font-semibold tracking-tight text-ink sm:text-2xl"
              >
                Insights
              </h1>
              <p className="mt-1 text-xs text-muted sm:text-sm">{insightHeadline(summary)}</p>
            </div>
          </header>

          {hasRecentActivity ? (
            <>
              {/* Consistency — rates, framed as a rhythm rather than a grade */}
              <section className="mb-3" aria-labelledby="insights-consistency">
                <h2
                  id="insights-consistency"
                  className="mb-2 font-display text-sm font-semibold text-ink"
                >
                  Consistency
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  <Stat
                    label="This week"
                    value={summary.weekRate > 0 ? pct(summary.weekRate) : '—'}
                    hint={summary.weekRate > 0 ? 'of habits done' : 'nothing logged yet'}
                  />
                  <Stat
                    label="This month"
                    value={summary.monthRate > 0 ? pct(summary.monthRate) : '—'}
                    hint={summary.monthRate > 0 ? 'of habits done' : 'nothing logged yet'}
                  />
                </div>
              </section>

              {/* Momentum — gentle streaks, no perfect/failed framing */}
              <section className="mb-5" aria-labelledby="insights-momentum">
                <h2
                  id="insights-momentum"
                  className="mb-2 font-display text-sm font-semibold text-ink"
                >
                  Momentum
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  <Stat label="Full days" value={summary.currentPerfectStreak} hint="in a row" />
                  <Stat label="Best streak" value={summary.bestStreak} hint="days" />
                </div>
              </section>

              {/* Weekly review */}
              <section className="mb-5 rounded-calm border border-line bg-raised p-4 shadow-calm sm:p-5">
                <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold text-ink">
                  <CalendarDays className="h-4 w-4 text-sage-500 dark:text-sage-300" aria-hidden />
                  This week
                </h2>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="font-display text-lg font-semibold text-ink">
                      {review.activeDays}/{review.days}
                    </p>
                    <p className="text-xs text-muted">active days</p>
                  </div>
                  <div>
                    <p className="font-display text-lg font-semibold text-ink">
                      {review.completions}
                    </p>
                    <p className="text-xs text-muted">completions</p>
                  </div>
                  <div>
                    <p className="font-display text-lg font-semibold text-ink">
                      {review.bestDay?.done ?? 0}
                    </p>
                    <p className="text-xs text-muted">best day</p>
                  </div>
                </div>
              </section>
            </>
          ) : (
            <section className="mb-5 rounded-calm border border-line bg-raised p-5 text-center shadow-calm">
              <p className="font-display text-sm font-semibold text-ink">
                Your trends will appear here
              </p>
              <p className="mt-1 text-xs text-muted">
                {live.length > 0
                  ? 'Nothing logged in the last 30 days. Consistency and momentum build one small step at a time.'
                  : 'Add a habit to start seeing your consistency and momentum.'}
              </p>
            </section>
          )}

          {/* 30-day trend */}
          <section className="rounded-calm border border-line bg-raised p-4 shadow-calm sm:p-5">
            <h2 className="mb-1 flex items-center gap-2 font-display text-sm font-semibold text-ink">
              <TrendingUp className="h-4 w-4 text-sage-500 dark:text-sage-300" aria-hidden />
              Last 30 days
            </h2>
            <p className="mb-3 text-xs text-muted">
              Each bar shows how much of that day was logged.
            </p>
            <p className="sr-only">
              Last 30 days: {monthCounts.full} day{monthCounts.full === 1 ? '' : 's'} with
              everything done, {monthCounts.partial} with some done, {monthCounts.quiet} with
              nothing logged
              {monthCounts.none > 0 ? `, ${monthCounts.none} with no data` : ''}.
            </p>
            <div className="flex h-24 items-end gap-[3px]" aria-hidden>
              {summary.points.map((point) => {
                const ratio = point.total > 0 ? point.done / point.total : 0
                const height = Math.max(3, Math.round(ratio * 88))
                const tone =
                  point.total === 0
                    ? 'bg-cal-none'
                    : ratio >= 1
                      ? 'bg-cal-full'
                      : ratio > 0
                        ? 'bg-cal-partial'
                        : 'bg-cal-empty'
                return (
                  <div
                    key={point.iso}
                    title={`${point.iso}: ${point.done}/${point.total}`}
                    className={`flex-1 rounded-full ${tone}`}
                    style={{ height }}
                  />
                )
              })}
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted">
              <span>30 days ago</span>
              <span>Today</span>
            </div>
          </section>

          {/* Per-habit list */}
          {live.length > 0 && (
            <section className="mt-5 rounded-calm border border-line bg-raised p-4 shadow-calm sm:p-5">
              <h2 className="mb-3 font-display text-sm font-semibold text-ink">Your habits</h2>
              <ul className="space-y-1">
                {live.map((habit) => {
                  const best = bestStreak(habit, weekStart)
                  const done = habit.history.length
                  const recent = habitCompletion(habit, now, 30)
                  const recentDone = recent.filter((day) => day.done).length
                  const open = openId === habit.id
                  const badges = milestones(habit, weekStart)
                  const reached = badges.filter((badge) => badge.reached).length
                  return (
                    <li key={habit.id}>
                      <button
                        type="button"
                        onClick={() => setOpenId(open ? null : habit.id)}
                        aria-expanded={open}
                        className="flex w-full items-center justify-between gap-3 rounded-calm-sm px-1 py-2 text-left"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">{habit.name}</p>
                          <p className="text-xs text-muted">
                            {habit.category} · {scheduleLabel(habit.schedule)} · {reached}/
                            {badges.length} milestones
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <div className="text-right">
                            <p className="text-sm font-semibold text-ink">{done}</p>
                            <p className="text-xs text-muted">total · best {best}</p>
                          </div>
                          <ChevronDown
                            className={`h-4 w-4 text-muted transition-transform duration-calm ease-calm ${
                              open ? 'rotate-180' : ''
                            }`}
                            aria-hidden
                          />
                        </div>
                      </button>
                      {open && (
                        <div className="px-1 pb-3 pt-1">
                          <div className="flex gap-[3px]" aria-hidden>
                            {recent.map((day) => (
                              <span
                                key={day.iso}
                                title={day.iso}
                                className={`h-3.5 flex-1 rounded-sm ${
                                  day.done ? 'bg-cal-full' : 'bg-mint-100 dark:bg-mint-900/40'
                                }`}
                              />
                            ))}
                          </div>
                          <p className="sr-only">
                            {habit.name}, last 30 days: {recentDone} day
                            {recentDone === 1 ? '' : 's'} logged.
                          </p>
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {badges.map((badge) => (
                              <span
                                key={badge.id}
                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                  badge.reached
                                    ? 'bg-sage-100 text-sage-700 dark:bg-sage-900/50 dark:text-sage-200'
                                    : 'bg-mint-100 text-muted dark:bg-mint-900/40'
                                }`}
                              >
                                {badge.reached ? '★ ' : ''}
                                {badge.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          <p className="mt-5 pb-4 text-center text-xs text-muted">
            {summary.totalCompletions} completions recorded in total.
          </p>
        </motion.section>
      </motion.div>
    </Portal>
  )
}
