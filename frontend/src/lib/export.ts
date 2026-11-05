import type { Habit, Todo } from '../types'
import { normalizeHabit } from './habit'
import { normalizeTodo } from './todo'

/**
 * Export and import the on-device data so it is never trapped in the app.
 * The JSON snapshot is loss-free, so a re-import restores exactly what was
 * there — habits with their history, tasks with their steps.
 */

export interface ExportBundle {
  app: 'Bloom'
  exportedAt: string
  habits: Habit[]
  todos: Todo[]
}

export function buildBundle(habits: Habit[], todos: Todo[], now: Date = new Date()): ExportBundle {
  return { app: 'Bloom', exportedAt: now.toISOString(), habits, todos }
}

export function toJson(habits: Habit[], todos: Todo[], now: Date = new Date()): string {
  return `${JSON.stringify(buildBundle(habits, todos, now), null, 2)}\n`
}

export interface ParsedBundle {
  habits: Habit[]
  todos: Todo[]
}

/**
 * Read a previously exported file back. Tolerant about extra fields and older
 * exports (each record is normalised), but strict about the overall shape so a
 * wrong file can't quietly wipe anything.
 */
export function parseBundle(text: string): ParsedBundle {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('That file isn’t valid JSON.')
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('That file doesn’t look like a Bloom export.')
  }

  const record = raw as { habits?: unknown; todos?: unknown }
  if (!Array.isArray(record.habits) && !Array.isArray(record.todos)) {
    throw new Error('That file doesn’t contain any habits or tasks.')
  }

  const habits = Array.isArray(record.habits)
    ? record.habits.map((habit) => normalizeHabit(habit as Partial<Habit> & { id: number }))
    : []
  const todos = Array.isArray(record.todos)
    ? record.todos.map((todo) => normalizeTodo(todo as Todo))
    : []

  return { habits, todos }
}

/** Trigger a file download. A no-op in non-browser environments. */
export function downloadFile(filename: string, mimeType: string, content: string): void {
  if (typeof document === 'undefined') return
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Give the browser a moment to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
