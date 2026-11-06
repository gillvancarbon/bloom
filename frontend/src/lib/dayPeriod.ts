import type { DayPeriod, Habit } from '../types'
import { minutesOfDay } from './reminder'

/** The periods in their natural order. "Anytime" stays last. */
export const DAY_PERIODS: DayPeriod[] = ['morning', 'afternoon', 'evening', 'anytime']

export const PERIOD_LABELS: Record<DayPeriod, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  anytime: 'Anytime',
}

/** Morning starts at 05:00, afternoon at 12:00, evening at 17:00. */
export function periodFromMinutes(minutes: number): DayPeriod {
  if (minutes >= 5 * 60 && minutes < 12 * 60) return 'morning'
  if (minutes >= 12 * 60 && minutes < 17 * 60) return 'afternoon'
  return 'evening'
}

/** The period for a clock time. Never returns "anytime". */
export function periodFromTime(date: Date): DayPeriod {
  return periodFromMinutes(date.getHours() * 60 + date.getMinutes())
}

/**
 * The period "follow the clock" should switch to, or null to stay put.
 *
 * Anytime sits outside the clock — it is a bucket, not a time of day — so a
 * reader deliberately viewing it is never pulled away, not even when the clock
 * crosses a boundary. Otherwise the view advances only when the clock enters a
 * new period (or the moment following is switched on), and never re-selects the
 * period already on screen.
 */
export function clockAdvance(
  viewed: DayPeriod,
  clock: DayPeriod,
  lastClock: DayPeriod,
  justEnabled: boolean,
): DayPeriod | null {
  if (viewed === 'anytime') return null
  if (!justEnabled && clock === lastClock) return null
  return clock === viewed ? null : clock
}

/** The period an older habit falls back to, based on its deadline. */
export function periodFromDeadline(deadline: string): DayPeriod {
  return periodFromMinutes(minutesOfDay(deadline))
}

/** Accepts only the known values; anything else is null. */
export function asPeriod(value: unknown): DayPeriod | null {
  return value === 'morning' || value === 'afternoon' || value === 'evening' || value === 'anytime'
    ? value
    : null
}

/** Stable index for direction-aware animations and clamping. */
export function periodIndex(period: DayPeriod): number {
  return DAY_PERIODS.indexOf(period)
}

/** Move one period left or right, clamping at the ends. */
export function shiftPeriod(period: DayPeriod, delta: number): DayPeriod {
  const next = Math.min(DAY_PERIODS.length - 1, Math.max(0, periodIndex(period) + delta))
  return DAY_PERIODS[next]
}

/** Group habits into periods, preserving their stored order. */
export function groupByPeriod(habits: Habit[]): Record<DayPeriod, Habit[]> {
  const groups: Record<DayPeriod, Habit[]> = {
    morning: [],
    afternoon: [],
    evening: [],
    anytime: [],
  }
  for (const habit of habits) {
    groups[habit.timeOfDay].push(habit)
  }
  return groups
}
