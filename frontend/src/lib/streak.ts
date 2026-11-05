import type { Habit } from '../types'

/* ── Dates ─────────────────────────────────────────────────────────── */

/** Local calendar date as YYYY-MM-DD (never UTC, so "today" matches the user). */
export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`
}

export function todayISO(): string {
  return toISODate(new Date())
}

/** Whole local-calendar days from an ISO date to `now`. */
export function daysSince(dateISO: string, now: Date): number {
  const [y, m, d] = dateISO.split('-').map(Number)
  const from = new Date(y, m - 1, d)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((today.getTime() - from.getTime()) / 86_400_000)
}

export function isCompletedToday(habit: Habit, now: Date): boolean {
  return habit.lastCompletedDate === toISODate(now)
}

/** Days that keep a streak alive — completed or protected by a freeze. */
export function keptDates(habit: Habit): string[] {
  const set = new Set<string>([...habit.history, ...(habit.frozen ?? [])])
  return [...set].sort()
}

/** The most recent kept day, or null when the habit has no history yet. */
export function lastKeptDate(habit: Habit): string | null {
  const kept = keptDates(habit)
  return kept.length ? kept[kept.length - 1] : null
}

/* ── Streak state (one-day grace period) ───────────────────────────── */

export type StreakLevel = 'none' | 'safe' | 'risk' | 'broken'

export interface StreakState {
  level: StreakLevel
  count: number
}

/**
 * The streak keeps a one-day grace period:
 *   gap 0–1 days → `safe`   (still on track, flame full size)
 *   gap 2 days   → `risk`   (one day already missed — flame shrinks to warn
 *                            that the streak resets if today is missed too)
 *   gap 3+ days  → `broken` (two days missed — the streak resets)
 */
export function streakState(habit: Habit, now: Date): StreakState {
  // Frozen days count as kept, so the gap is measured from the last kept day.
  const last = lastKeptDate(habit)
  if (!last) return { level: 'none', count: 0 }
  const gap = daysSince(last, now)
  if (gap >= 3) return { level: 'broken', count: 0 }
  if (gap === 2) return { level: 'risk', count: habit.streakCount }
  return { level: 'safe', count: habit.streakCount }
}

/* ── Deadline countdown ────────────────────────────────────────────── */

export type DeadlineLevel = 'calm' | 'near' | 'overdue'

export interface DeadlineState {
  level: DeadlineLevel
  text: string
}

/** Window before the deadline in which the countdown starts warning. */
export const NEAR_WINDOW_MS = 2 * 3_600_000

/** Time left until today's deadline, e.g. "5h 32m" / "48m" / "Overdue". */
export function deadlineState(deadline: string, now: Date): DeadlineState {
  const [h, m] = (deadline || '23:59').split(':').map(Number)
  const target = new Date(now)
  target.setHours(Number.isFinite(h) ? h : 23, Number.isFinite(m) ? m : 59, 0, 0)

  const diff = target.getTime() - now.getTime()
  if (diff <= 0) return { level: 'overdue', text: 'Overdue' }

  const totalMinutes = Math.floor(diff / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const text = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
  return { level: diff <= NEAR_WINDOW_MS ? 'near' : 'calm', text }
}
