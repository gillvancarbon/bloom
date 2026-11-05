import type { Habit, Settings, WeekStart } from '../types'
import { keptDates, toISODate } from './streak'
import { weekRange } from './schedule'

/**
 * Streak freezes ("skip tokens").
 *
 * A freeze protects one missed day so a streak survives an off day. Freezes
 * come as a weekly allowance — three each week — and are spent by hand from the
 * Habit screen, so nothing is frozen behind the user's back.
 */

/** Freezes granted at the start of each week. */
export const WEEKLY_FREEZES = 3

/** How far back a gap is scanned (keeps the walk bounded on very old habits). */
const MAX_LOOKBACK = 120

/**
 * Whether the habit is expected on a given day. Flexible "N× per week" habits
 * have no single missed day, so they are never treated as at-risk.
 */
function expectedOn(habit: Habit, date: Date): boolean {
  if (habit.schedule.type === 'daily') return true
  if (habit.schedule.type === 'weekdays') return habit.schedule.days.includes(date.getDay())
  return false
}

/**
 * The missed days a freeze could still cover, most recent first, stopping at
 * the last kept day. Off-schedule days are stepped over, not counted. An empty
 * list means the streak is safe.
 */
export function missedDays(habit: Habit, now: Date): string[] {
  const kept = keptDates(habit)
  if (kept.length === 0) return []
  const set = new Set(kept)
  const earliest = kept[0]

  const missed: string[] = []
  for (let i = 1; i <= MAX_LOOKBACK; i++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    const iso = toISODate(date)
    if (iso < earliest) break
    if (set.has(iso)) break
    if (!expectedOn(habit, date)) continue
    missed.push(iso)
  }
  return missed
}

/** Whether a habit has unprotected missed days. */
export function isAtRisk(habit: Habit, now: Date): boolean {
  return missedDays(habit, now).length > 0
}

/** The day a freeze should cover next: the earliest unprotected missed day. */
export function nextFreezeDate(habit: Habit, now: Date): string | null {
  const missed = missedDays(habit, now)
  return missed.length ? missed[missed.length - 1] : null
}

/** The start-of-week key used to decide when to refill freezes. */
export function weekKey(now: Date, weekStart: WeekStart): string {
  return weekRange(now, weekStart).start
}

/**
 * Refill freezes when a new week has begun, so unused tokens reset to the
 * weekly allowance. Returns the settings patch, or null when already current.
 */
export function freezeRefillPatch(settings: Settings, now: Date): Partial<Settings> | null {
  const key = weekKey(now, settings.weekStart)
  if (settings.lastFreezeWeek === key) return null
  return { freezeTokens: WEEKLY_FREEZES, lastFreezeWeek: key }
}
