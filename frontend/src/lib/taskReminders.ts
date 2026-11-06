import type { TimeFormat, Todo } from '../types'
import { formatTime } from './format'

/**
 * When a task should nudge.
 *
 * A task reminds at its exact due time when it has one. When it only has a due
 * date, it gets a single gentle morning nudge at {@link TASK_NUDGE_HOUR} rather
 * than a midnight alarm — a to-do isn't a habit with a deadline.
 *
 * Once that moment passes with the task still open, Bloom nudges once more to
 * say it's overdue — but only once per due occurrence, and never for a task
 * that has since been completed or archived.
 */

/** The hour used for a dated task that has no specific due time. */
export const TASK_NUDGE_HOUR = 9

/**
 * How long after the due moment a still-open task counts as overdue. The gap
 * stops the "overdue" nudge from tripping over the reminder that fired at the
 * due moment itself.
 */
export const OVERDUE_NUDGE_GRACE_MS = 15 * 60 * 1000

/** Small lead so a nudge scheduled during a sync always lands in the future. */
export const OVERDUE_NUDGE_DELAY_MS = 3 * 1000

/** Split an ISO date into local `[year, month, day]`, or null when malformed. */
function parseDueDate(dueDate: string | null): [number, number, number] | null {
  if (!dueDate) return null
  const parts = dueDate.split('-').map(Number)
  if (parts.length !== 3 || !parts.every(Number.isFinite)) return null
  return [parts[0], parts[1], parts[2]]
}

/**
 * The moment a dated task should remind. A task with a due time reminds then;
 * a date-only task gets a gentle morning nudge at {@link TASK_NUDGE_HOUR}
 * rather than a midnight alarm.
 */
export function taskDueMoment(todo: Todo): Date | null {
  const date = parseDueDate(todo.dueDate)
  if (!date) return null
  const [year, month, day] = date

  let hour = TASK_NUDGE_HOUR
  let minute = 0
  if (todo.dueTime) {
    const [h, m] = todo.dueTime.split(':').map(Number)
    if (Number.isFinite(h)) hour = h
    if (Number.isFinite(m)) minute = m
  }
  return new Date(year, month - 1, day, hour, minute, 0, 0)
}

/**
 * The moment a task actually falls overdue. This mirrors the to-do screen: a
 * task with a due time is overdue at that time, while a date-only task stays
 * calm until the end of its day.
 */
export function taskOverdueMoment(todo: Todo): Date | null {
  const date = parseDueDate(todo.dueDate)
  if (!date) return null
  const [year, month, day] = date
  if (todo.dueTime) {
    const [h, m] = todo.dueTime.split(':').map(Number)
    if (Number.isFinite(h) && Number.isFinite(m)) {
      return new Date(year, month - 1, day, h, m, 0, 0)
    }
  }
  return new Date(year, month - 1, day, 23, 59, 59, 999)
}

/** The moment a task should remind, or null when it has none ahead of `now`. */
export function taskReminderAt(todo: Todo, now: Date): Date | null {
  if (todo.done || todo.archived) return null
  const at = taskDueMoment(todo)
  if (!at) return null
  return at.getTime() > now.getTime() ? at : null
}

/**
 * True when an open, dated task has passed its due moment by more than the
 * grace period. Completed and archived tasks are never overdue — there is
 * nothing left to nudge.
 */
export function taskOverdue(
  todo: Todo,
  now: Date,
  graceMs: number = OVERDUE_NUDGE_GRACE_MS,
): boolean {
  if (todo.done || todo.archived) return false
  const at = taskOverdueMoment(todo)
  return at !== null && now.getTime() - at.getTime() >= graceMs
}

/**
 * A stable identity for one due occurrence, so a task is nudged about being
 * overdue at most once. Editing the due date or time makes a new occurrence.
 */
export function taskOverdueKey(todo: Todo): string | null {
  if (!todo.dueDate) return null
  return `${todo.id}:${todo.dueDate}:${todo.dueTime ?? ''}`
}

/** The notification body for a task reminder that has not yet come due. */
export function taskReminderBody(todo: Todo, timeFormat: TimeFormat): string {
  if (todo.dueTime) {
    return `“${todo.title}” is due at ${formatTime(todo.dueTime, timeFormat)}.`
  }
  return `“${todo.title}” is due today.`
}

/** The notification body for a task whose due moment has already passed. */
export function taskOverdueBody(todo: Todo, timeFormat: TimeFormat): string {
  if (todo.dueTime) {
    return `“${todo.title}” is overdue — it was due at ${formatTime(todo.dueTime, timeFormat)}.`
  }
  return `“${todo.title}” is overdue.`
}
