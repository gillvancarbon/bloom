import type { Habit, HabitSchedule, WeekStart } from '../types'
import { describeWeekdays } from './format'
import { toISODate } from './streak'

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
