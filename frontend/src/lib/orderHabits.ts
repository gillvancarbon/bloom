import type { Habit, HabitSort, WeekStart } from '../types'
import { isCompleteForPeriod } from './schedule'
import { minutesOfDay } from './reminder'

/**
 * Order habits inside a period. Every mode falls back to the stored order
 * (and then newest-first) so the result is always stable.
 */
export function orderHabits(
  habits: Habit[],
  mode: HabitSort,
  now: Date,
  weekStart: WeekStart,
): Habit[] {
  const stored = (a: Habit, b: Habit) =>
    a.order !== b.order ? a.order - b.order : b.createdAt.localeCompare(a.createdAt)
  const done = (habit: Habit) => (isCompleteForPeriod(habit, now, weekStart) ? 1 : 0)

  const copy = [...habits]
  switch (mode) {
    case 'manual':
      return copy.sort(stored)
    case 'deadline':
      return copy.sort(
        (a, b) => minutesOfDay(a.deadline) - minutesOfDay(b.deadline) || stored(a, b),
      )
    case 'name':
      return copy.sort(
        (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) || stored(a, b),
      )
    case 'incomplete':
    default:
      // Finished habits sink to the bottom; the rest keep their stored order.
      return copy.sort((a, b) => done(a) - done(b) || stored(a, b))
  }
}
