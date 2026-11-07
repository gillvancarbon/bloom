import type { Habit, Settings, Todo } from '../types'
import { normalizeHabit } from './habit'
import { normalizeTodo } from './todo'
import { normalizeSettings } from '../data/settingsStore'

/**
 * Export and import the on-device data so it is never trapped in the app.
 * The JSON snapshot is loss-free, so a re-import restores exactly what was
 * there — habits with their history, tasks with their steps, and preferences.
 */

/** Bump when the shape of an export changes incompatibly. */
export const EXPORT_SCHEMA_VERSION = 1

export interface ExportBundle {
  app: 'Bloom'
  /** Format version, so a newer file can be spotted on an older install. */
  schemaVersion: number
  exportedAt: string
  habits: Habit[]
  todos: Todo[]
  settings?: Settings
}

export function buildBundle(
  habits: Habit[],
  todos: Todo[],
  now: Date = new Date(),
  settings?: Settings,
): ExportBundle {
  return {
    app: 'Bloom',
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    habits,
    todos,
    ...(settings ? { settings } : {}),
  }
}

export function toJson(
  habits: Habit[],
  todos: Todo[],
  now: Date = new Date(),
  settings?: Settings,
): string {
  return `${JSON.stringify(buildBundle(habits, todos, now, settings), null, 2)}\n`
}

export interface ParsedBundle {
  habits: Habit[]
  todos: Todo[]
  settings?: Settings
}

/** Require a positive-integer, unique `id` on every record of a collection. */
function assertRecordIds(records: unknown[], label: string): void {
  const seen = new Set<number>()
  for (const record of records) {
    const id = (record as { id?: unknown } | null | undefined)?.id
    if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) {
      throw new Error(`That file has a ${label} without a valid id.`)
    }
    if (seen.has(id)) {
      throw new Error(`That file has more than one ${label} with id ${id}.`)
    }
    seen.add(id)
  }
}

/**
 * Read a previously exported file back. Tolerant about extra fields and older
 * exports (each record is normalised), but strict about the overall shape so a
 * wrong file can't quietly wipe anything — and it refuses a file written by a
 * newer version rather than importing something it can't understand.
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

  const record = raw as {
    habits?: unknown
    todos?: unknown
    settings?: unknown
    schemaVersion?: unknown
  }
  const hasHabits = Array.isArray(record.habits)
  const hasTodos = Array.isArray(record.todos)
  if (!hasHabits && !hasTodos) {
    throw new Error('That file doesn’t contain any habits or tasks.')
  }

  // A missing version means an export from before versioning — treat as 1.
  const schemaVersion = typeof record.schemaVersion === 'number' ? record.schemaVersion : 1
  if (schemaVersion > EXPORT_SCHEMA_VERSION) {
    throw new Error(
      'This file was made by a newer version of Bloom. Update the app, then try again.',
    )
  }

  // A Bloom export always carries both collections: requiring both stops a
  // partial file from silently wiping the collection it omitted.
  if (!hasHabits || !hasTodos) {
    throw new Error('That file is incomplete — a Bloom export needs both habits and tasks.')
  }

  assertRecordIds(record.habits as unknown[], 'habit')
  assertRecordIds(record.todos as unknown[], 'task')

  const habits = (record.habits as Array<Partial<Habit> & { id: number }>).map((habit) =>
    normalizeHabit(habit),
  )
  const todos = (record.todos as Todo[]).map((todo) => normalizeTodo(todo))
  const settings =
    record.settings && typeof record.settings === 'object'
      ? normalizeSettings(record.settings as Partial<Settings>)
      : undefined

  return { habits, todos, ...(settings ? { settings } : {}) }
}
