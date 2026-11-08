import type { Habit, Todo, WeekStart } from '../types'
import { minutesOfDay, reminderBody, reminderClock } from './reminder'
import { scheduledOn } from './schedule'
import { toISODate } from './streak'
import { taskReminderAt } from './taskReminders'

/**
 * A pure planner for the nudges Bloom would like to schedule.
 *
 * This mirrors the scheduling maths in `lib/notifications.ts` without importing
 * the notification plugin, so the plan can be computed and tested on any host.
 * The notification layer can later consume a {@link PlannedNudge} list and hand
 * it to the OS.
 */

/**
 * How many days ahead of `now` the planner looks. Seven days keeps the plan a
 * sensible rolling window without arming an unbounded queue.
 */
const PLAN_HORIZON_DAYS = 7

/** Monday-first week; only affects the flexible weekly schedule's progress. */
const WEEK_START: WeekStart = 1

export interface PlannedNudge {
  id: string
  kind: 'habit' | 'task'
  title: string
  at: Date
  body?: string
}

export interface PlanOptions {
  habits: Habit[]
  todos: Todo[]
  now: Date
  notificationsEnabled: boolean
  taskReminders: boolean
  quietHours: { start: string; end: string } | null
  digest: boolean
}

/**
 * Whether `at` sits inside the quiet window, in local time. Supports windows
 * that cross midnight (e.g. "22:00"–"07:00"): the start is inclusive and the end
 * is exclusive, so 22:00 is quiet and 07:00 is awake again. A null window — or
 * a zero-length one — protects nothing.
 */
export function inQuietHours(at: Date, quiet: { start: string; end: string } | null): boolean {
  if (!quiet) return false
  const start = minutesOfDay(quiet.start)
  const end = minutesOfDay(quiet.end)
  if (start === end) return false

  const now = at.getHours() * 60 + at.getMinutes()
  if (start < end) return now >= start && now < end
  // Crosses midnight: quiet from `start` until the end of the day, then until `end`.
  return now >= start || now < end
}

function timeParts(hhmm: string): { hour: number; minute: number } {
  const [hour, minute] = hhmm.split(':').map(Number)
  return {
    hour: Number.isFinite(hour) ? hour : 0,
    minute: Number.isFinite(minute) ? minute : 0,
  }
}

/**
 * Habit reminders for the horizon: the deadline moved back by the habit's
 * reminder offset. Only archivable/future moments that fall on a scheduled day
 * are kept — a weekday habit skips its off days, and a flexible weekly habit
 * stops once its target is met for the week.
 */
function habitNudges(habits: Habit[], now: Date): PlannedNudge[] {
  const nudges: PlannedNudge[] = []
  for (const habit of habits) {
    if (habit.archived || habit.reminderOffset == null) continue
    const { hour, minute } = timeParts(reminderClock(habit.deadline, habit.reminderOffset))

    for (let dayOffset = 0; dayOffset < PLAN_HORIZON_DAYS; dayOffset += 1) {
      const at = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + dayOffset,
        hour,
        minute,
        0,
        0,
      )
      if (at.getTime() <= now.getTime()) continue
      if (!scheduledOn(habit, at, WEEK_START)) continue

      nudges.push({
        id: `habit-${habit.id}-${toISODate(at)}`,
        kind: 'habit',
        title: habit.name,
        at,
        body: reminderBody(habit),
      })
    }
  }
  return nudges
}

/** Task reminders: the next due moment of each open, dated task. */
function taskNudges(todos: Todo[], now: Date): PlannedNudge[] {
  const nudges: PlannedNudge[] = []
  for (const todo of todos) {
    const at = taskReminderAt(todo, now)
    if (!at) continue
    nudges.push({ id: `task-${todo.id}`, kind: 'task', title: todo.title, at })
  }
  return nudges
}

/**
 * Collapse every group of nudges that land in the same local hour into one
 * combined nudge. The combined nudge borrows the earliest moment and is always
 * typed as a habit with a count title (e.g. "3 habits to do") — a deliberate
 * simplification that keeps a digest from sounding like a list of chores.
 * Single nudges in an hour pass through untouched.
 */
function digestByHour(nudges: PlannedNudge[]): PlannedNudge[] {
  const groups = new Map<string, PlannedNudge[]>()
  for (const nudge of nudges) {
    const key = `${toISODate(nudge.at)}T${nudge.at.getHours()}`
    const group = groups.get(key)
    if (group) group.push(nudge)
    else groups.set(key, [nudge])
  }

  const out: PlannedNudge[] = []
  for (const [key, group] of groups) {
    if (group.length === 1) {
      out.push(group[0])
      continue
    }
    const first = group.reduce((a, b) => (a.at.getTime() <= b.at.getTime() ? a : b))
    out.push({
      id: `digest-${key}`,
      kind: 'habit',
      title: `${group.length} habits to do`,
      at: first.at,
    })
  }
  return out
}

/**
 * The nudges that should be scheduled for the rolling window:
 *
 *   - nothing at all when notifications are off;
 *   - habit reminders at deadline − reminderOffset on scheduled days;
 *   - task reminders for open, dated tasks (only when `taskReminders` is on);
 *   - any moment inside quiet hours is dropped;
 *   - with `digest`, more than one nudge in the same local hour collapses into
 *     a single combined nudge.
 *
 * Pure: it never reads a clock or calls the notification plugin.
 */
export function buildPlan(opts: PlanOptions): PlannedNudge[] {
  if (!opts.notificationsEnabled) return []

  const candidates = [
    ...habitNudges(opts.habits, opts.now),
    ...(opts.taskReminders ? taskNudges(opts.todos, opts.now) : []),
  ]
  const audible = candidates.filter((nudge) => !inQuietHours(nudge.at, opts.quietHours))
  const planned = opts.digest ? digestByHour(audible) : audible
  return planned.sort((a, b) => a.at.getTime() - b.at.getTime())
}
