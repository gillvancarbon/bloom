import { Capacitor, registerPlugin } from '@capacitor/core'
import type { Habit, Todo, WeekStart } from '../types'
import { isCompleteForPeriod, scheduledOrCompletedToday } from './schedule'
import { PERIOD_LABELS, periodFromTime } from './dayPeriod'
import { dueState, sortTodos } from './todo'

/**
 * Home-screen widget bridge.
 *
 * The widget itself is a thin native renderer; the web layer owns the logic and
 * pushes a small snapshot ({ period, done, total, items, tasks }) whenever the
 * habits or tasks change. On the web this is a no-op.
 */

interface BloomWidgetPlugin {
  setSnapshot(options: { snapshot: string }): Promise<void>
}

const BloomWidget = registerPlugin<BloomWidgetPlugin>('BloomWidget')

export interface WidgetSnapshot {
  updatedAt: string
  /** The part of the day it is now, e.g. "Morning". */
  period: string
  done: number
  total: number
  items: Array<{ name: string; done: boolean }>
  /** Today's open tasks: how many, and the first few by name. */
  taskTotal: number
  taskItems: string[]
}

/** The number of habit rows the widget can show. */
const WIDGET_ROWS = 3
/** The number of task rows the widget can show. */
const WIDGET_TASK_ROWS = 2

/**
 * The latest habit and task lists. Habits and tasks are owned by two different
 * hooks, so each pushes what it has and we merge before building a snapshot —
 * neither can clobber the other's half of the widget.
 */
let lastHabits: Habit[] = []
let lastTodos: Todo[] = []

/** A snapshot of today's habits and tasks — what's left and what's done. */
export function buildSnapshot(
  habits: Habit[],
  todos: Todo[],
  now: Date,
  weekStart: WeekStart,
): WidgetSnapshot {
  const today = habits.filter(
    (habit) => !habit.archived && scheduledOrCompletedToday(habit, now, weekStart),
  )
  const items = today.slice(0, WIDGET_ROWS).map((habit) => ({
    name: habit.name,
    done: isCompleteForPeriod(habit, now, weekStart),
  }))

  // Tasks worth surfacing: open, not archived, overdue or due today.
  const dueNow = sortTodos(
    todos.filter((todo) => !todo.archived && !todo.done && todoBucketIsDue(todo, now) !== null),
  )

  return {
    updatedAt: now.toISOString(),
    period: PERIOD_LABELS[periodFromTime(now)],
    done: today.filter((habit) => isCompleteForPeriod(habit, now, weekStart)).length,
    total: today.length,
    items,
    taskTotal: dueNow.length,
    taskItems: dueNow.slice(0, WIDGET_TASK_ROWS).map((todo) => todo.title),
  }
}

/** Overdue or due today (null otherwise). */
function todoBucketIsDue(todo: Todo, now: Date): boolean | null {
  const due = dueState(todo.dueDate, todo.dueTime, now)
  if (due.level === 'overdue' || due.level === 'today') return true
  return null
}

/** True when a home-screen widget can actually be updated on this device. */
export function widgetSupported(): boolean {
  return Capacitor.getPlatform() === 'android'
}

/**
 * Push a fresh snapshot. Pass only what changed; the other half is remembered.
 * A no-op on the web and when the widget isn't placed.
 */
export async function syncWidget(
  update: { habits?: Habit[]; todos?: Todo[] },
  now: Date,
  weekStart: WeekStart,
): Promise<void> {
  if (update.habits) lastHabits = update.habits
  if (update.todos) lastTodos = update.todos
  if (!widgetSupported()) return
  try {
    const snapshot = JSON.stringify(buildSnapshot(lastHabits, lastTodos, now, weekStart))
    await BloomWidget.setSnapshot({ snapshot })
  } catch {
    /* widget not placed, or plugin unavailable — nothing to do */
  }
}
