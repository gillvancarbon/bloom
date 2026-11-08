import type { Habit } from '../types'
import { toISODate } from './streak'

/**
 * Consistency calendar math, shared by the web (Spring Boot) and Android
 * (on-device) builds so both colour days identically.
 *
 * A day reflects how many habits that *existed that day* were logged:
 *   nothing logged → neutral · some done → soft amber · all done → sage green.
 * The colours are a gentle record of activity, never a pass/fail verdict.
 * Days before tracking began (or with no habits yet) have no data.
 */

export type DayStatus = 'none' | 'empty' | 'partial' | 'full' | 'future'

/** The local calendar date a habit was created on. */
export function createdDate(createdAt: string): string {
  const d = new Date(createdAt)
  return Number.isNaN(d.getTime()) ? createdAt.slice(0, 10) : toISODate(d)
}

/** Habits that already existed on `date` (created that day or earlier). */
function habitsOn(habits: Habit[], date: string): Habit[] {
  return habits.filter((h) => createdDate(h.createdAt) <= date)
}

export function dayStatus(
  date: string,
  habits: Habit[],
  historyStart: string | null,
  today: string,
): DayStatus {
  if (date > today) return 'future'
  if (!historyStart || date < historyStart) return 'none'

  // Filter the habits that existed on the day once, then count the logged
  // ones — avoids scanning the habit list twice for the same day.
  const active = habitsOn(habits, date)
  if (active.length === 0) return 'none'

  const done = active.filter((h) => h.history.includes(date)).length
  if (done === 0) return 'empty'
  if (done >= active.length) return 'full'
  return 'partial'
}

export interface CalendarCell {
  iso: string
  day: number
}

/** A month laid out in weeks, with the week starting on `weekStart` (0 = Sun). */
export function monthGrid(year: number, month: number, weekStart = 0): (CalendarCell | null)[] {
  const firstWeekday = new Date(year, month, 1).getDay() // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const leading = (firstWeekday - weekStart + 7) % 7

  const cells: (CalendarCell | null)[] = []
  for (let i = 0; i < leading; i++) cells.push(null)
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ iso: toISODate(new Date(year, month, day)), day })
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/** Single-letter weekday labels ordered from the user's week start. */
export function weekdayInitials(weekStart = 0): string[] {
  return Array.from({ length: 7 }, (_, i) => WEEKDAYS[(i + weekStart) % 7])
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
}

const STATUS_LABEL: Record<DayStatus, string> = {
  none: 'no data',
  empty: 'nothing logged',
  partial: 'some done',
  full: 'all done',
  future: 'upcoming',
}

/**
 * Human summary used for a day cell's accessible label.
 *
 * `status` may be supplied when the caller has already computed it (for example
 * from a memoised per-month map), so the status isn't derived a second time.
 */
export function dayDescription(
  date: string,
  habits: Habit[],
  historyStart: string | null,
  today: string,
  status: DayStatus = dayStatus(date, habits, historyStart, today),
): string {
  const pretty = new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
  if (status === 'none' || status === 'future') {
    return `${pretty} — ${STATUS_LABEL[status]}`
  }
  const active = habitsOn(habits, date)
  const done = active.filter((h) => h.history.includes(date)).length
  if (done === 0) return `${pretty} — ${STATUS_LABEL.empty}`
  return `${pretty} — ${done} of ${active.length} done`
}
