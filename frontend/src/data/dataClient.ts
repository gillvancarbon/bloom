import { Preferences } from '@capacitor/preferences'
import { api } from '../api'
import { localStore } from './localStore'
import { localTodoStore } from './localTodoStore'
import { nudgeStore } from './nudgeStore'
import type { Habit, Todo } from '../types'

/**
 * Small facade over the two data modes (web = REST, Android = on-device) for
 * whole-dataset operations that don't belong to a single store.
 */

const localMode = import.meta.env.VITE_DATA_MODE === 'local'

/** Device keys that hold user data (settings and backups are deliberately kept). */
const DATA_KEYS = ['bloom.habits.v1', 'bloom.todos.v1', 'bloom.seq.v1', 'bloom.todoSeq.v1']

async function clearLocal(): Promise<void> {
  for (const key of DATA_KEYS) {
    await Preferences.remove({ key })
  }
  // The overdue-nudge ledger keys off task ids, so it must not outlive them.
  await nudgeStore.clear()
}

async function clearRemote(): Promise<void> {
  const [habits, todos] = await Promise.all([api.list(), api.todos.list()])
  await Promise.all(habits.map((h) => api.remove(h.id)))
  await Promise.all(todos.map((t) => api.todos.remove(t.id)))
}

export const dataClient = {
  isLocal: localMode,
  async clearAll(): Promise<void> {
    if (localMode) return clearLocal()
    return clearRemote()
  },
  /** Read the whole dataset, whichever data mode is active. */
  async readAll(): Promise<{ habits: Habit[]; todos: Todo[] }> {
    if (localMode) {
      const [habits, todos] = await Promise.all([localStore.list(), localTodoStore.list()])
      return { habits, todos }
    }
    const [habits, todos] = await Promise.all([api.list(), api.todos.list()])
    return { habits, todos }
  },
  /**
   * Replace the whole dataset from an imported snapshot. Local mode writes the
   * records straight through (keeping ids and history); the REST mode clears
   * the server copy first and re-creates each record.
   */
  async importAll(bundle: { habits: Habit[]; todos: Todo[] }): Promise<void> {
    // Imported records may reuse ids, so start the nudge ledger fresh.
    await nudgeStore.clear()
    if (localMode) {
      await Promise.all([
        localStore.replaceAll(bundle.habits),
        localTodoStore.replaceAll(bundle.todos),
      ])
      return
    }
    await clearRemote()
    for (const habit of bundle.habits) {
      await api.create(habit)
    }
    for (const todo of bundle.todos) {
      await api.todos.create(todo)
    }
  },
}
