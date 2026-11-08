import type { Habit, WeekStart } from '../types'
import { normalizeSchedule, scheduledOn } from './schedule'
import { toISODate } from './streak'

/**
 * A forgiving, deliberately non-streak view of how a habit is going.
 *
 * Streaks reset hard the moment a day is missed, which makes a single bad day
 * feel like starting over. Momentum instead asks a softer question: over the
 * last few weeks, how often did this habit actually happen? A gap simply lowers
 * the ratio — it never wipes anything out.
 */

/** Monday-first week; only affects the flexible weekly schedule's progress. */
const WEEK_START: WeekStart = 1

/**
 * The habit's momentum over the trailing `windowDays` days, up to and including
 * `now`'s date (local time):
 *
 *   completed — how many of those days appear in `habit.history`. Any
 *               completion counts, even one on an off-schedule day, so a habit
 *               done more often than scheduled can read above 100%.
 *   of        — how many of those days the habit was actually scheduled for:
 *               a daily habit counts every day, a weekdays habit only its
 *               chosen weekdays, and a "N× per week" habit scales by the window
 *               length — `round(N * windowDays / 7)`, floored at 1 so a weekly
 *               habit always has something to measure against.
 *
 * Pure and synchronous: it reads `history` and the schedule, nothing else, and
 * never throws on a habit with no history.
 */
export function momentum(
  habit: Habit,
  now: Date,
  windowDays = 30,
): { completed: number; of: number } {
  if (windowDays <= 0) return { completed: 0, of: 0 }

  const completedDates = new Set(habit.history)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  let completed = 0
  for (let offset = 0; offset < windowDays; offset += 1) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset)
    if (completedDates.has(toISODate(day))) completed += 1
  }

  const schedule = normalizeSchedule(habit.schedule)
  let of: number
  if (schedule.type === 'weekly') {
    of = Math.max(1, Math.round(schedule.perWeek * (windowDays / 7)))
  } else {
    of = 0
    for (let offset = 0; offset < windowDays; offset += 1) {
      const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset)
      if (scheduledOn(habit, day, WEEK_START)) of += 1
    }
  }

  return { completed, of }
}

export type MomentumTier = 'starting' | 'building' | 'steady' | 'strong'

/**
 * Bucket a momentum ratio (`completed / of`) into four gentle bands:
 *
 *   < 0.2 → 'starting'  (barely begun, or nothing scheduled yet)
 *   < 0.5 → 'building'
 *   < 0.8 → 'steady'
 *   else  → 'strong'
 *
 * With nothing scheduled (`of` is 0) there is no ratio to speak of, so it reads
 * as 'starting' rather than a division by zero.
 */
export function momentumTier(completed: number, of: number): MomentumTier {
  if (of <= 0) return 'starting'
  const ratio = completed / of
  if (ratio < 0.2) return 'starting'
  if (ratio < 0.5) return 'building'
  if (ratio < 0.8) return 'steady'
  return 'strong'
}
