import type { Habit, WeekStart } from '../types'
import { createdDate } from './calendar'
import { toISODate, daysSince, todayISO, keptDates } from './streak'
import { scheduledOccurrencesMissed, streakState, weekRange } from './schedule'

/**
 * Longest run of kept days in a habit's history. A run continues across two
 * consecutive kept days only when the habit's schedule expects nothing in
 * between — so a weekday habit survives a weekend while a daily habit doesn't.
 */
export function bestStreak(habit: Habit, weekStart: WeekStart = 1): number {
  // Frozen days count as kept, so protected streaks read correctly here too.
  const days = keptDates(habit)
  let best = 0
  let run = 0
  let prev: string | null = null
  for (const day of days) {
    const continues =
      prev !== null &&
      scheduledOccurrencesMissed(habit, prev, new Date(`${day}T00:00:00`), weekStart) === 0
    if (continues) {
      run += 1
    } else {
      run = 1
    }
    best = Math.max(best, run)
    prev = day
  }
  return best
}

export interface DailyPoint {
  iso: string
  done: number
  total: number
}

/**
 * A habit's creation date and history resolved once, so multi-day loops don't
 * re-parse `createdAt` or do a linear `history.includes` scan every iteration.
 */
interface PreparedHabit {
  createdISO: string
  history: Set<string>
}

function prepareHabits(habits: Habit[]): PreparedHabit[] {
  return habits.map((habit) => ({
    createdISO: createdDate(habit.createdAt),
    history: new Set(habit.history),
  }))
}

/** Per-day done/total for the last `days` days (oldest first), for a bar chart. */
export function dailyCompletion(
  habits: Habit[],
  now: Date,
  days: number,
  historyStart: string | null,
): DailyPoint[] {
  const prepared = prepareHabits(habits)
  const points: DailyPoint[] = []
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    const iso = toISODate(date)
    const active = prepared.filter((h) => h.createdISO <= iso)
    const live = !historyStart || iso >= historyStart
    const done = live ? active.filter((h) => h.history.has(iso)).length : 0
    points.push({ iso, done, total: live ? active.length : 0 })
  }
  return points
}

export interface InsightsSummary {
  /** Completed / expected over the last 7 days. */
  weekRate: number
  /** Completed / expected over the last 30 days. */
  monthRate: number
  /**
   * Days in a row (ending today or yesterday) where every habit was done —
   * shown as "full days" rather than a perfect score to be judged against.
   */
  currentPerfectStreak: number
  bestStreak: number
  totalCompletions: number
  /** Habit with the longest current streak. */
  topHabit: Habit | null
  points: DailyPoint[]
}

function rate(points: DailyPoint[]): number {
  const total = points.reduce((sum, p) => sum + p.total, 0)
  if (total === 0) return 0
  const done = points.reduce((sum, p) => sum + p.done, 0)
  return done / total
}

/**
 * Consecutive "full days" ending today or yesterday. A full day simply means
 * everything active that day was logged — an observation, not a grade.
 */
function allDoneStreak(habits: Habit[], now: Date, historyStart: string | null): number {
  const prepared = prepareHabits(habits)
  let streak = 0
  for (let i = 0; i < 365; i++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    const iso = toISODate(date)
    if (historyStart && iso < historyStart) break
    const active = prepared.filter((h) => h.createdISO <= iso)
    if (active.length === 0) {
      if (i === 0) continue
      break
    }
    const allDone = active.every((h) => h.history.has(iso))
    if (allDone) {
      streak += 1
    } else if (i === 0) {
      // Today can still be in progress — don't break the run on day 0.
      continue
    } else {
      break
    }
  }
  return streak
}

/**
 * Consecutive days (ending today or yesterday) with at least one habit done.
 *
 * Unlike `allDoneStreak`, a single completion is enough to keep the run alive,
 * so the number rises the moment the first habit is ticked. If nothing has been
 * done yet today, the run ending yesterday is shown rather than resetting to 0.
 */
export function dailyStreak(habits: Habit[], now: Date, historyStart: string | null): number {
  if (habits.length === 0) return 0

  const prepared = prepareHabits(habits)
  let streak = 0
  for (let i = 0; i < 365; i++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    const iso = toISODate(date)
    if (historyStart && iso < historyStart) break

    const active = prepared.filter((h) => h.createdISO <= iso)
    if (active.length === 0) {
      if (i === 0) continue
      break
    }

    if (active.some((h) => h.history.has(iso))) {
      streak += 1
    } else if (i === 0) {
      // Nothing done today yet — show the run ending yesterday instead.
      continue
    } else {
      break
    }
  }
  return streak
}

export function insightsSummary(
  habits: Habit[],
  now: Date,
  historyStart: string | null,
  weekStart: WeekStart,
): InsightsSummary {
  const live = habits.filter((h) => !h.archived)
  // Archived habits are excluded everywhere, so the rate denominator matches
  // the per-habit list and the perfect-day run.
  const points = dailyCompletion(live, now, 30, historyStart)

  let collectiveBest = 0
  let topHabit: Habit | null = null
  let topStreak = 0
  let totalCompletions = 0
  for (const habit of live) {
    totalCompletions += habit.history.length
    const best = bestStreak(habit, weekStart)
    if (best > collectiveBest) collectiveBest = best
  }
  // The habit to celebrate: the live one with the longest current streak.
  for (const habit of live) {
    const { count } = streakState(habit, now, weekStart)
    if (count > topStreak) {
      topStreak = count
      topHabit = habit
    }
  }

  return {
    weekRate: rate(points.slice(-7)),
    monthRate: rate(points),
    currentPerfectStreak: allDoneStreak(live, now, historyStart),
    bestStreak: collectiveBest,
    totalCompletions,
    topHabit,
    points,
  }
}

/** A calm, observational one-line summary of the user's consistency. */
export function insightHeadline(summary: InsightsSummary): string {
  if (summary.monthRate === 0) {
    return summary.totalCompletions > 0 ? 'A quiet month so far.' : 'Not enough data yet.'
  }
  if (summary.monthRate >= 0.85) return 'Many full days lately.'
  if (summary.monthRate >= 0.6) return 'A steady rhythm lately.'
  return 'A little progress at a time.'
}

export interface WeeklyReview {
  /** Days so far this week with at least one completion. */
  activeDays: number
  /** Total completions logged so far this week. */
  completions: number
  /** Days elapsed this week (today included). */
  days: number
  /** The strongest day this week, if any. */
  bestDay: { iso: string; done: number } | null
}

/** A calm "your week so far" summary for the week containing `now`. */
export function weeklyReview(
  habits: Habit[],
  now: Date,
  historyStart: string | null,
  weekStart: WeekStart,
): WeeklyReview {
  const { start, end } = weekRange(now, weekStart)
  const todayIdx = daysSince(start, now)
  const days = Math.min(7, Math.max(0, todayIdx) + 1)
  const prepared = prepareHabits(habits)

  let activeDays = 0
  let completions = 0
  let bestDay: { iso: string; done: number } | null = null

  for (let i = 0; i < days; i++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (todayIdx - i))
    const iso = toISODate(date)
    if (iso < start || iso > end) continue
    if (historyStart && iso < historyStart) continue
    const done = prepared.filter((h) => h.createdISO <= iso && h.history.has(iso)).length
    if (done > 0) {
      activeDays += 1
      if (!bestDay || done > bestDay.done) bestDay = { iso, done }
    }
    completions += done
  }

  return { activeDays, completions, days, bestDay }
}

export interface Milestone {
  id: string
  label: string
  reached: boolean
}

/** Gentle badges earned from a habit's best streak and total completions. */
export function milestones(habit: Habit, weekStart: WeekStart = 1): Milestone[] {
  const best = bestStreak(habit, weekStart)
  const total = habit.history.length
  return [
    { id: 'streak-7', label: '7-day streak', reached: best >= 7 },
    { id: 'streak-30', label: '30-day streak', reached: best >= 30 },
    { id: 'streak-100', label: '100-day streak', reached: best >= 100 },
    { id: 'total-10', label: '10 done', reached: total >= 10 },
    { id: 'total-50', label: '50 done', reached: total >= 50 },
    { id: 'total-100', label: '100 done', reached: total >= 100 },
  ]
}

/** Per-day completion for a single habit over the last `days` days. */
export function habitCompletion(
  habit: Habit,
  now: Date,
  days: number,
): Array<{ iso: string; done: boolean }> {
  const created = createdDate(habit.createdAt)
  const history = new Set(habit.history)
  const out: Array<{ iso: string; done: boolean }> = []
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    const iso = toISODate(date)
    out.push({ iso, done: created <= iso && history.has(iso) })
  }
  return out
}

export { todayISO }
