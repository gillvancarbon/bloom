import type { Habit, WeekStart } from '../types'
import { createdDate } from './calendar'
import { toISODate, daysSince, todayISO, keptDates } from './streak'
import { scheduleProgress, weekRange } from './schedule'

/** Longest run of consecutive completed days in a habit's history. */
export function bestStreak(habit: Habit): number {
  // Frozen days count as kept, so protected streaks read correctly here too.
  const days = keptDates(habit)
  let best = 0
  let run = 0
  let prev: string | null = null
  for (const day of days) {
    if (prev && daysSince(prev, new Date(`${day}T00:00:00`)) === 1) {
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

/** Per-day done/total for the last `days` days (oldest first), for a bar chart. */
export function dailyCompletion(
  habits: Habit[],
  now: Date,
  days: number,
  historyStart: string | null,
): DailyPoint[] {
  const points: DailyPoint[] = []
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    const iso = toISODate(date)
    const active = habits.filter((h) => createdDate(h.createdAt) <= iso)
    const live = !historyStart || iso >= historyStart
    const done = live ? active.filter((h) => h.history.includes(iso)).length : 0
    points.push({ iso, done, total: live ? active.length : 0 })
  }
  return points
}

export interface InsightsSummary {
  /** Completed / expected over the last 7 days. */
  weekRate: number
  /** Completed / expected over the last 30 days. */
  monthRate: number
  /** Days in a row (ending today or yesterday) where every habit was done. */
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

/** Consecutive perfect days ending today or yesterday. */
function perfectStreak(habits: Habit[], now: Date, historyStart: string | null): number {
  let streak = 0
  for (let i = 0; i < 365; i++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    const iso = toISODate(date)
    if (historyStart && iso < historyStart) break
    const active = habits.filter((h) => createdDate(h.createdAt) <= iso)
    if (active.length === 0) {
      if (i === 0) continue
      break
    }
    const allDone = active.every((h) => h.history.includes(iso))
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
 * Unlike `perfectStreak`, a single completion is enough to keep the run alive,
 * so the number rises the moment the first habit is ticked. If nothing has been
 * done yet today, the run ending yesterday is shown rather than resetting to 0.
 */
export function dailyStreak(habits: Habit[], now: Date, historyStart: string | null): number {
  if (habits.length === 0) return 0

  let streak = 0
  for (let i = 0; i < 365; i++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    const iso = toISODate(date)
    if (historyStart && iso < historyStart) break

    const active = habits.filter((h) => createdDate(h.createdAt) <= iso)
    if (active.length === 0) {
      if (i === 0) continue
      break
    }

    if (active.some((h) => h.history.includes(iso))) {
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
  const points = dailyCompletion(habits, now, 30, historyStart)

  let collectiveBest = 0
  let topHabit: Habit | null = null
  let totalCompletions = 0
  for (const habit of habits) {
    totalCompletions += habit.history.length
    const best = bestStreak(habit)
    if (best > collectiveBest) collectiveBest = best
    const progress = scheduleProgress(habit, now, weekStart)
    if (progress.complete && (!topHabit || progress.done > 0)) {
      topHabit = topHabit ?? habit
    }
  }

  return {
    weekRate: rate(points.slice(-7)),
    monthRate: rate(points),
    currentPerfectStreak: perfectStreak(live, now, historyStart),
    bestStreak: collectiveBest,
    totalCompletions,
    topHabit,
    points,
  }
}

/** A friendly one-line summary of the user's consistency. */
export function insightHeadline(summary: InsightsSummary): string {
  if (summary.monthRate >= 0.85) return 'You are on a roll.'
  if (summary.monthRate >= 0.6) return 'Steady progress.'
  if (summary.monthRate > 0) return 'Every day counts.'
  return 'A fresh start.'
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

  let activeDays = 0
  let completions = 0
  let bestDay: { iso: string; done: number } | null = null

  for (let i = 0; i < days; i++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (todayIdx - i))
    const iso = toISODate(date)
    if (iso < start || iso > end) continue
    if (historyStart && iso < historyStart) continue
    const done = habits.filter(
      (h) => createdDate(h.createdAt) <= iso && h.history.includes(iso),
    ).length
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
export function milestones(habit: Habit): Milestone[] {
  const best = bestStreak(habit)
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
  const out: Array<{ iso: string; done: boolean }> = []
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    const iso = toISODate(date)
    out.push({ iso, done: created <= iso && habit.history.includes(iso) })
  }
  return out
}

export { todayISO }
