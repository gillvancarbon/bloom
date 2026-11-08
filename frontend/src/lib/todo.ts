import type { LucideIcon } from 'lucide-react'
import {
  Briefcase,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  HeartPulse,
  Home,
  Minus,
  ShoppingBag,
  User,
} from 'lucide-react'
import type {
  Subtask,
  Todo,
  TodoCategory,
  TodoImportance,
  TodoRecurrence,
  TodoSort,
} from '../types'
import { daysSince, toISODate } from './streak'

export interface TodoCategoryMeta {
  id: TodoCategory
  label: string
  icon: LucideIcon
  /** Chip colours, matching the habit streak chips. */
  chip: string
}

export const TODO_CATEGORIES: TodoCategoryMeta[] = [
  {
    id: 'chores',
    label: 'Chores',
    icon: Home,
    chip: 'bg-peach-100 text-peach-700 dark:bg-peach-900/40 dark:text-peach-200',
  },
  {
    id: 'schoolwork',
    label: 'Schoolwork',
    icon: GraduationCap,
    chip: 'bg-mint-200 text-mint-800 dark:bg-mint-800/60 dark:text-mint-100',
  },
  {
    id: 'work',
    label: 'Work',
    icon: Briefcase,
    chip: 'bg-sage-100 text-sage-700 dark:bg-sage-900/50 dark:text-sage-200',
  },
  {
    id: 'personal',
    label: 'Personal',
    icon: User,
    chip: 'bg-mint-100 text-sage-700 dark:bg-mint-900/60 dark:text-mint-100',
  },
  {
    id: 'health',
    label: 'Health',
    icon: HeartPulse,
    chip: 'bg-peach-100 text-peach-700 dark:bg-peach-900/40 dark:text-peach-200',
  },
  {
    id: 'errands',
    label: 'Errands',
    icon: ShoppingBag,
    chip: 'bg-sage-100 text-sage-700 dark:bg-sage-900/50 dark:text-sage-200',
  },
]

const DEFAULT_CATEGORY = TODO_CATEGORIES[3]

export function categoryMeta(id: string | null | undefined): TodoCategoryMeta {
  return TODO_CATEGORIES.find((category) => category.id === id) ?? DEFAULT_CATEGORY
}

export interface TodoImportanceMeta {
  id: TodoImportance
  label: string
  icon: LucideIcon
  /** Badge colours. */
  chip: string
  /** Higher sorts first. */
  rank: number
}

/** Low → high. Order matters: it's used for both the picker and the ranking. */
export const TODO_IMPORTANCE: TodoImportanceMeta[] = [
  {
    id: 'low',
    label: 'Low',
    icon: ChevronDown,
    chip: 'bg-mint-100 text-muted dark:bg-mint-900/50 dark:text-mint-100',
    rank: 0,
  },
  {
    id: 'medium',
    label: 'Medium',
    icon: Minus,
    chip: 'bg-sage-100 text-sage-700 dark:bg-sage-900/50 dark:text-sage-200',
    rank: 1,
  },
  {
    id: 'high',
    label: 'High',
    icon: ChevronUp,
    chip: 'bg-peach-100 text-peach-700 dark:bg-peach-900/40 dark:text-peach-200',
    rank: 2,
  },
]

const DEFAULT_IMPORTANCE = TODO_IMPORTANCE[1]

export function importanceMeta(id: string | null | undefined): TodoImportanceMeta {
  return TODO_IMPORTANCE.find((level) => level.id === id) ?? DEFAULT_IMPORTANCE
}

/** How a task repeats, in the order shown in the form and card. */
export interface TodoRecurrenceMeta {
  id: TodoRecurrence
  label: string
}

export const TODO_RECURRENCE: TodoRecurrenceMeta[] = [
  { id: 'none', label: 'Once' },
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
]

const DEFAULT_RECURRENCE: TodoRecurrence = 'none'

export function recurrenceLabel(id: string | null | undefined): string | null {
  const meta = TODO_RECURRENCE.find((option) => option.id === id)
  return meta && meta.id !== 'none' ? meta.label : null
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const CLOCK_TIME = /^\d{2}:\d{2}$/

/** True for a real calendar date in "YYYY-MM-DD" form. */
export function isISODate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

/** True for a valid "HH:mm" clock time (00–23 hours, 00–59 minutes). */
export function isClockTime(value: unknown): value is string {
  if (typeof value !== 'string' || !CLOCK_TIME.test(value)) return false
  const [hours, minutes] = value.split(':').map(Number)
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59
}

/** Fills in missing fields on tasks saved by earlier versions. */
export function normalizeTodo(todo: Todo): Todo {
  // Drop malformed dates/times from import or corrupt storage so they can't
  // throw later in dueState/formatDueTime. A time is kept even without a date:
  // quick-add and the form can set a time on its own.
  return {
    ...todo,
    category: todo.category || DEFAULT_CATEGORY.id,
    importance: (todo.importance as TodoImportance) || DEFAULT_IMPORTANCE.id,
    recurrence: (todo.recurrence as TodoRecurrence) || DEFAULT_RECURRENCE,
    dueDate: isISODate(todo.dueDate) ? todo.dueDate : null,
    dueTime: isClockTime(todo.dueTime) ? todo.dueTime : null,
    subtasks: normalizeSubtasks(todo.subtasks),
    archived: todo.archived ?? false,
  }
}

/** Coerce stored checklist data into a safe, complete list. */
export function normalizeSubtasks(subtasks: Subtask[] | null | undefined): Subtask[] {
  if (!Array.isArray(subtasks)) return []
  return subtasks
    .filter((subtask) => subtask && typeof subtask.title === 'string')
    .map((subtask, index) => ({
      id: subtask.id || `sub-${index}`,
      title: subtask.title.trim(),
      done: Boolean(subtask.done),
    }))
    .filter((subtask) => subtask.title.length > 0)
}

export interface SubtaskProgress {
  done: number
  total: number
}

export function subtaskProgress(todo: Todo): SubtaskProgress {
  const total = todo.subtasks.length
  const done = todo.subtasks.filter((subtask) => subtask.done).length
  return { done, total }
}

/** True when a task matches a free-text search over its title, note and steps. */
export function matchesTodo(todo: Todo, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (todo.title.toLowerCase().includes(q)) return true
  if (todo.note?.toLowerCase().includes(q)) return true
  return todo.subtasks.some((subtask) => subtask.title.toLowerCase().includes(q))
}

/**
 * Add a whole number of months. A month-end date stays on the target month's
 * last day (31 Jan + 1 month = 28 Feb, then 28 Feb + 1 month = 31 Mar), so a
 * monthly task never drifts earlier each month. Other days clamp normally.
 */
export function addMonths(date: Date, months: number): Date {
  const day = date.getDate()
  const lastDayOfInputMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  const isMonthEnd = day === lastDayOfInputMonth

  const next = new Date(date.getFullYear(), date.getMonth() + months, 1)
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
  next.setDate(isMonthEnd ? lastDay : Math.min(day, lastDay))
  return next
}

/**
 * The next occurrence of a repeating task, as "YYYY-MM-DD".
 *
 * Stepping starts from the task's current due date (or `from` when it has none)
 * and rolls forward until it lands in the future, so an overdue daily task
 * completed today lands on tomorrow rather than staying in the past.
 */
export function nextOccurrence(
  dueDate: string | null,
  recurrence: TodoRecurrence,
  from: Date = new Date(),
): string | null {
  if (recurrence === 'none') return null

  const base = dueDate
    ? parseISODate(dueDate)
    : new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  let next = base

  // Guard against a runaway loop on malformed data.
  for (let step = 0; step < 1000; step += 1) {
    next =
      recurrence === 'daily'
        ? new Date(next.getFullYear(), next.getMonth(), next.getDate() + 1)
        : recurrence === 'weekly'
          ? new Date(next.getFullYear(), next.getMonth(), next.getDate() + 7)
          : addMonths(next, 1)
    if (next.getTime() > today.getTime()) break
  }

  return toISODate(next)
}

function parseISODate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  if (![year, month, day].every(Number.isFinite)) return new Date()
  return new Date(year, month - 1, day)
}

export type DueLevel = 'none' | 'overdue' | 'today' | 'tomorrow' | 'later'

export interface DueState {
  level: DueLevel
  text: string
}

function parseDueAt(dueDate: string, dueTime: string | null): Date {
  const dateParts = dueDate.split('-').map(Number)
  const [year, month, day] = dateParts
  // An unparseable date degrades to an invalid Date rather than throwing.
  if (dateParts.length !== 3 || !dateParts.every(Number.isFinite)) return new Date(NaN)
  if (isClockTime(dueTime)) {
    const [hours, minutes] = dueTime.split(':').map(Number)
    return new Date(year, month - 1, day, hours, minutes)
  }
  // With no (valid) time, the task only becomes overdue once the day has passed.
  return new Date(year, month - 1, day, 23, 59, 59, 999)
}

/** Format "HH:mm" for display; an unparseable value degrades to an empty string. */
export function formatDueTime(dueTime: string | null): string {
  if (!isClockTime(dueTime)) return ''
  const [hours, minutes] = dueTime.split(':').map(Number)
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Calm due label: Overdue / Today · 3:00 PM / Tomorrow / Fri 7 Nov. */
export function dueState(dueDate: string | null, dueTime: string | null, now: Date): DueState {
  if (!dueDate) return { level: 'none', text: '' }

  const today = toISODate(now)
  const time = formatDueTime(dueTime)
  const withTime = (label: string) => (time ? `${label} · ${time}` : label)
  const deadline = parseDueAt(dueDate, dueTime)

  if (now.getTime() > deadline.getTime()) {
    const days = daysSince(dueDate, now)
    return {
      level: 'overdue',
      text: days > 1 ? `${days}d overdue` : withTime('Overdue'),
    }
  }

  if (dueDate === today) return { level: 'today', text: withTime('Today') }

  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (dueDate === toISODate(tomorrow)) {
    return { level: 'tomorrow', text: withTime('Tomorrow') }
  }

  const [year, month, day] = dueDate.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const sameYear = date.getFullYear() === now.getFullYear()
  return {
    level: 'later',
    text: withTime(
      date.toLocaleDateString(undefined, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        ...(sameYear ? {} : { year: 'numeric' }),
      }),
    ),
  }
}

export function isDoneToday(todo: Todo, now: Date): boolean {
  if (!todo.done || !todo.completedAt) return false
  return toISODate(new Date(todo.completedAt)) === toISODate(now)
}

/** Compare two open tasks by due date/time (undated last). */
function byDue(a: Todo, b: Todo): number {
  if (a.dueDate !== b.dueDate) {
    if (!a.dueDate) return 1
    if (!b.dueDate) return -1
    return a.dueDate.localeCompare(b.dueDate)
  }
  const aTime = a.dueTime ?? '23:59'
  const bTime = b.dueTime ?? '23:59'
  return aTime.localeCompare(bTime)
}

/**
 * Order tasks for display. Archived tasks always sink to the bottom, then
 * completed tasks (most recently finished first). Open tasks follow the chosen
 * `sort`:
 *   due        — soonest due first, undated last, priority as a tie-break
 *   importance — highest priority first, then by due date
 *   name       — A–Z
 *   created    — newest first
 */
export function sortTodos(todos: Todo[], sort: TodoSort = 'due', order: number[] = []): Todo[] {
  // Rank for manual ordering: the first time an id appears wins.
  const manualRank = new Map<number, number>()
  order.forEach((id, index) => {
    if (!manualRank.has(id)) manualRank.set(id, index)
  })

  return [...todos].sort((a, b) => {
    // Archived tasks sink below everything else.
    if (a.archived !== b.archived) return a.archived ? 1 : -1

    if (a.done !== b.done) return a.done ? 1 : -1

    if (a.done && b.done) {
      const aFinished = a.completedAt ?? a.createdAt
      const bFinished = b.completedAt ?? b.createdAt
      return bFinished.localeCompare(aFinished)
    }

    switch (sort) {
      case 'manual': {
        const aRank = manualRank.get(a.id) ?? Number.MAX_SAFE_INTEGER
        const bRank = manualRank.get(b.id) ?? Number.MAX_SAFE_INTEGER
        if (aRank !== bRank) return aRank - bRank
        // Unranked (e.g. brand-new) tasks sink to the bottom, newest first.
        return b.createdAt.localeCompare(a.createdAt)
      }
      case 'importance': {
        const rank = importanceMeta(b.importance).rank - importanceMeta(a.importance).rank
        if (rank !== 0) return rank
        return byDue(a, b)
      }
      case 'name':
        return a.title.localeCompare(b.title)
      case 'created':
        return b.createdAt.localeCompare(a.createdAt)
      case 'due':
      default: {
        const due = byDue(a, b)
        if (due !== 0) return due
        // Within the same due slot, the more important task floats up.
        const rank = importanceMeta(b.importance).rank - importanceMeta(a.importance).rank
        if (rank !== 0) return rank
        return b.createdAt.localeCompare(a.createdAt)
      }
    }
  })
}

/**
 * Where an open task belongs in the to-do view. Overdue tasks stay in "Today"
 * so they can't slip out of sight.
 */
export type TodoBucket = 'today' | 'upcoming' | 'anytime'

/** The buckets in their natural order. */
export const TODO_BUCKETS: TodoBucket[] = ['today', 'upcoming', 'anytime']

export const TODO_BUCKET_LABELS: Record<TodoBucket, string> = {
  today: 'Today',
  upcoming: 'Upcoming',
  anytime: 'Anytime',
}

export function todoBucket(todo: Todo, now: Date): TodoBucket {
  const due = dueState(todo.dueDate, todo.dueTime, now)
  if (due.level === 'none') return 'anytime'
  return due.level === 'overdue' || due.level === 'today' ? 'today' : 'upcoming'
}

export interface TodoStats {
  doneToday: number
  dueToday: number
  overdue: number
}

export function todoStats(todos: Todo[], now: Date): TodoStats {
  const open = todos.filter((todo) => !todo.done)
  let dueToday = 0
  let overdue = 0

  for (const todo of open) {
    const due = dueState(todo.dueDate, todo.dueTime, now)
    if (due.level === 'overdue') overdue += 1
    else if (due.level === 'today') dueToday += 1
  }

  return {
    doneToday: todos.filter((todo) => isDoneToday(todo, now)).length,
    dueToday,
    overdue,
  }
}
