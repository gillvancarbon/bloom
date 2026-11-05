import type { TimeFormat, Todo } from '../types'
import { formatTime } from './format'

/**
 * When a task should nudge.
 *
 * A task reminds at its exact due time when it has one. When it only has a due
 * date, it gets a single gentle morning nudge at {@link TASK_NUDGE_HOUR} rather
 * than a midnight alarm — a to-do isn't a habit with a deadline.
 */

/** The hour used for a dated task that has no specific due time. */
export const TASK_NUDGE_HOUR = 9

/** The moment a task should remind, or null when it has none ahead of `now`. */
export function taskReminderAt(todo: Todo, now: Date): Date | null {
  if (todo.done || todo.archived || !todo.dueDate) return null
  const [year, month, day] = todo.dueDate.split('-').map(Number)
  if (![year, month, day].every(Number.isFinite)) return null

  let hour = TASK_NUDGE_HOUR
  let minute = 0
  if (todo.dueTime) {
    const [h, m] = todo.dueTime.split(':').map(Number)
    if (Number.isFinite(h)) hour = h
    if (Number.isFinite(m)) minute = m
  }

  const at = new Date(year, month - 1, day, hour, minute, 0, 0)
  return at.getTime() > now.getTime() ? at : null
}

/** The notification body for a task reminder. */
export function taskReminderBody(todo: Todo, timeFormat: TimeFormat): string {
  if (todo.dueTime) {
    return `“${todo.title}” is due at ${formatTime(todo.dueTime, timeFormat)}.`
  }
  return `“${todo.title}” is due today.`
}
