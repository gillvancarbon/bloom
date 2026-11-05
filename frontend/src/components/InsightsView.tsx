import { useState } from 'react'
import { motion } from 'framer-motion'
import { Portal } from './Portal'
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

          {/* Headline stats */}
          <div className="mb-5 grid grid-cols-2 gap-3">
            <Stat label="This week" value={pct(summary.weekRate)} hint="completed" />
            <Stat label="This month" value={pct(summary.monthRate)} hint="completed" />
            <Stat label="Perfect days" value={summary.currentPerfectStreak} hint="in a row" />
            <Stat label="Best streak" value={summary.bestStreak} hint="days" />
          </div>

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
                <p className="text-[10px] text-muted">active days</p>
              </div>
              <div>
                <p className="font-display text-lg font-semibold text-ink">{review.completions}</p>
                <p className="text-[10px] text-muted">completions</p>
              </div>
              <div>
                <p className="font-display text-lg font-semibold text-ink">
                  {review.bestDay?.done ?? 0}
                </p>
                <p className="text-[10px] text-muted">best day</p>
              </div>
            </div>
          </section>

          {/* 30-day trend */}
          <section className="rounded-calm border border-line bg-raised p-4 shadow-calm sm:p-5">
            <h2 className="mb-1 flex items-center gap-2 font-display text-sm font-semibold text-ink">
              <TrendingUp className="h-4 w-4 text-sage-500 dark:text-sage-300" aria-hidden />
              Last 30 days
            </h2>
            <p className="mb-3 text-xs text-muted">
              Each bar is how much of that day’s habits you finished.
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
            <div className="mt-2 flex justify-between text-[10px] text-muted">
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
                  const best = bestStreak(habit)
                  const done = habit.history.length
                  const open = openId === habit.id
                  const badges = milestones(habit)
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
                            <p className="text-[10px] text-muted">total · best {best}</p>
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
                            {habitCompletion(habit, now, 30).map((day) => (
                              <span
                                key={day.iso}
                                title={day.iso}
                                className={`h-3.5 flex-1 rounded-sm ${
                                  day.done ? 'bg-cal-full' : 'bg-mint-100 dark:bg-mint-900/40'
                                }`}
                              />
                            ))}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {badges.map((badge) => (
                              <span
                                key={badge.id}
                                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
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

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-calm border border-line bg-raised px-3 py-3 text-center shadow-calm">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-display text-xl font-semibold text-ink">{value}</p>
      {hint && <p className="text-[10px] text-muted">{hint}</p>}
    </div>
  )
}
