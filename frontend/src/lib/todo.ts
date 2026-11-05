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
import type { Todo, TodoCategory, TodoImportance } from '../types'
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

/** Fills in missing fields on tasks saved by earlier versions. */
export function normalizeTodo(todo: Todo): Todo {
  return {
    ...todo,
    category: todo.category || DEFAULT_CATEGORY.id,
    importance: (todo.importance as TodoImportance) || DEFAULT_IMPORTANCE.id,
    archived: todo.archived ?? false,
  }
}

export type DueLevel = 'none' | 'overdue' | 'today' | 'tomorrow' | 'later'

export interface DueState {
  level: DueLevel
  text: string
}

function parseDueAt(dueDate: string, dueTime: string | null): Date {
  const [year, month, day] = dueDate.split('-').map(Number)
  if (dueTime) {
    const [hours, minutes] = dueTime.split(':').map(Number)
    return new Date(year, month - 1, day, hours, minutes)
  }
  // With no time, the task only becomes overdue once the day has passed.
  return new Date(year, month - 1, day, 23, 59, 59, 999)
}

function formatDueTime(dueTime: string | null): string {
  if (!dueTime) return ''
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

/** Open tasks by due date (undated last); completed tasks at the bottom. */
export function sortTodos(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => {
    // Archived tasks sink below everything else.
    if (a.archived !== b.archived) return a.archived ? 1 : -1

    if (a.done !== b.done) return a.done ? 1 : -1

    if (a.done && b.done) {
      const aFinished = a.completedAt ?? a.createdAt
      const bFinished = b.completedAt ?? b.createdAt
      return bFinished.localeCompare(aFinished)
    }

    if (a.dueDate !== b.dueDate) {
      if (!a.dueDate) return 1
      if (!b.dueDate) return -1
      return a.dueDate.localeCompare(b.dueDate)
    }
    const aTime = a.dueTime ?? '23:59'
    const bTime = b.dueTime ?? '23:59'
    if (aTime !== bTime) return aTime.localeCompare(bTime)

    // Within the same due slot, the more important task floats up.
    const rank = importanceMeta(b.importance).rank - importanceMeta(a.importance).rank
    if (rank !== 0) return rank

    return b.createdAt.localeCompare(a.createdAt)
  })
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
