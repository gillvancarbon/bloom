import type { Habit, HabitSchedule, WeekStart } from '../types'
import { describeWeekdays } from './format'
import { lastKeptDate, toISODate } from './streak'

/** Always return a well-formed schedule. */
export function normalizeSchedule(schedule: HabitSchedule | undefined): HabitSchedule {
  if (!schedule || typeof schedule !== 'object') return { type: 'daily' }
  if (schedule.type === 'weekdays') {
    const days = Array.isArray(schedule.days)
      ? schedule.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
      : []
    return days.length ? { type: 'weekdays', days } : { type: 'daily' }
  }
  if (schedule.type === 'weekly') {
    const perWeek = Number(schedule.perWeek)
    return { type: 'weekly', perWeek: perWeek >= 1 && perWeek <= 7 ? perWeek : 3 }
  }
  return { type: 'daily' }
}

export function scheduleLabel(schedule: HabitSchedule): string {
  if (schedule.type === 'weekdays') {
    if (schedule.days.length === 5 && [1, 2, 3, 4, 5].every((d) => schedule.days.includes(d))) {
      return 'Weekdays'
    }
    if (schedule.days.length === 2 && [0, 6].every((d) => schedule.days.includes(d))) {
      return 'Weekends'
    }
    return describeWeekdays(schedule.days)
  }
  if (schedule.type === 'weekly') {
    return `${schedule.perWeek}× / week`
  }
  return 'Every day'
}

/** The local-calendar date range (inclusive) for the week containing `now`. */
export function weekRange(now: Date, weekStart: WeekStart): { start: string; end: string } {
  const day = now.getDay()
  const offset = (day - weekStart + 7) % 7
  const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset)
  const endDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 6)
  return { start: toISODate(startDate), end: toISODate(endDate) }
}

/** How many times the habit was completed within the week containing `now`. */
export function completionsThisWeek(habit: Habit, now: Date, weekStart: WeekStart): number {
  const { start, end } = weekRange(now, weekStart)
  return habit.history.filter((d) => d >= start && d <= end).length
}

/** Whether the habit's schedule expects it on the given day. */
export function scheduledOn(habit: Habit, date: Date, weekStart: WeekStart): boolean {
  const schedule = normalizeSchedule(habit.schedule)
  if (schedule.type === 'daily') return true
  if (schedule.type === 'weekdays') return schedule.days.includes(date.getDay())
  return completionsThisWeek(habit, date, weekStart) < schedule.perWeek
}

/** Whether the habit is expected today, given its schedule and progress. */
export function scheduledToday(habit: Habit, now: Date, weekStart: WeekStart): boolean {
  return scheduledOn(habit, now, weekStart)
}

/**
 * Habits to show in today's list: everything scheduled today, plus anything
 * already completed today. The latter keeps a weekly habit visible after its
 * target is met so the completion can still be undone.
 */
export function scheduledOrCompletedToday(habit: Habit, now: Date, weekStart: WeekStart): boolean {
  return scheduledToday(habit, now, weekStart) || habit.history.includes(toISODate(now))
}

/** The number of completions that counts as "done" for the current period. */
export function periodTarget(habit: Habit): number {
  const schedule = normalizeSchedule(habit.schedule)
  if (schedule.type === 'weekly') return schedule.perWeek
  return Math.max(1, habit.target || 1)
}

export interface ScheduleProgress {
  done: number
  target: number
  label: string
  complete: boolean
}

/**
 * Target vs. actual for the habit's current period:
 *   daily / weekdays → today's completions over the daily target
 *   weekly           → this week's completions over the weekly target
 */
export function scheduleProgress(habit: Habit, now: Date, weekStart: WeekStart): ScheduleProgress {
  const schedule = normalizeSchedule(habit.schedule)
  const target = periodTarget(habit)
  if (schedule.type === 'weekly') {
    const done = completionsThisWeek(habit, now, weekStart)
    return { done, target, label: 'this week', complete: done >= target }
  }
  const today = toISODate(now)
  const done = Math.min(
    habit.history.filter((d) => d === today).length || (habit.lastCompletedDate === today ? 1 : 0),
    target,
  )
  return { done, target, label: 'today', complete: done >= target }
}

/** Whether the habit counts as complete for its current period. */
export function isCompleteForPeriod(habit: Habit, now: Date, weekStart: WeekStart): boolean {
  return scheduleProgress(habit, now, weekStart).complete
}

/* ── Schedule-aware streaks ────────────────────────────────────────── */

function parseISODate(dateISO: string): Date {
  const [y, m, d] = dateISO.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

/**
 * How many scheduled occurrences the habit missed strictly after `fromISO` and
 * strictly before `now` (today is never counted — it may still be completed).
 *
 * A "missed occurrence" is a scheduled day with no completion and no freeze, or
 * a whole week that fell short of a "N× per week" target. Off-schedule days
 * (e.g. the weekend of a weekday habit) are stepped over, not counted.
 */
export function scheduledOccurrencesMissed(
  habit: Habit,
  fromISO: string,
  now: Date,
  weekStart: WeekStart = 1,
): number {
  const schedule = normalizeSchedule(habit.schedule)

  if (schedule.type === 'weekly') {
    return missedWeeks(habit, fromISO, now, weekStart, schedule.perWeek)
  }

  const kept = new Set<string>([...habit.history, ...(habit.frozen ?? [])])
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const from = parseISODate(fromISO)

  let missed = 0
  for (let day = addDays(from, 1); day < today; day = addDays(day, 1)) {
    if (schedule.type === 'weekdays' && !schedule.days.includes(day.getDay())) continue
    if (!kept.has(toISODate(day))) missed += 1
  }
  return missed
}

/**
 * Whole weeks that fell short of a "N× per week" target, between the week of
 * `fromISO` and the week before `now`. The current (in-progress) week is never
 * judged, and neither is the week of the last kept day — the streak keeps a
 * one-week grace period, so a single slow week reads as `risk`, not `broken`.
 */
function missedWeeks(
  habit: Habit,
  fromISO: string,
  now: Date,
  weekStart: WeekStart,
  perWeek: number,
): number {
  const fromWeek = weekRange(parseISODate(fromISO), weekStart).start
  const nowWeek = weekRange(now, weekStart).start
  const prevWeek = toISODate(addDays(parseISODate(nowWeek), -7))

  // The last kept day is this week or last week: nothing full to judge yet.
  if (fromWeek >= prevWeek) return 0
  // A satisfied previous week keeps the streak intact, older misses aside.
  if (completionsThisWeek(habit, parseISODate(prevWeek), weekStart) >= perWeek) return 0

  let missed = 0
  for (
    let week = addDays(parseISODate(fromWeek), 7);
    toISODate(week) <= prevWeek;
    week = addDays(week, 7)
  ) {
    if (completionsThisWeek(habit, week, weekStart) < perWeek) missed += 1
  }
  return missed
}

export type StreakLevel = 'none' | 'safe' | 'risk' | 'broken'

export interface StreakState {
  level: StreakLevel
  count: number
}

/**
 * The streak keeps a one-occurrence grace period, measured against the habit's
 * own schedule:
 *   missed 0   → `safe`   (still on track, flame full size)
 *   missed 1   → `risk`   (one scheduled day/week already missed — the flame
 *                          shrinks to warn the streak resets if it's missed too)
 *   missed 2+  → `broken` (the streak has reset)
 */
export function streakState(habit: Habit, now: Date, weekStart: WeekStart = 1): StreakState {
  // Frozen days count as kept, so the gap is measured from the last kept day.
  const last = lastKeptDate(habit)
  if (!last) return { level: 'none', count: 0 }

  const missed = scheduledOccurrencesMissed(habit, last, now, weekStart)
  if (missed >= 2) return { level: 'broken', count: 0 }
  if (missed === 1) return { level: 'risk', count: habit.streakCount }
  return { level: 'safe', count: habit.streakCount }
}
