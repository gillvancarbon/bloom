import { Preferences } from '@capacitor/preferences'
import { api } from '../api'
import { localStore } from './localStore'
import { localTodoStore } from './localTodoStore'
import { nudgeStore } from './nudgeStore'
import { todoOrderStore } from './todoOrderStore'
import type { Habit, Todo } from '../types'

/**
 * Small facade over the two data modes (web = REST, Android = on-device) for
 * whole-dataset operations that don't belong to a single store.
 */

const localMode = import.meta.env.VITE_DATA_MODE === 'local'

/** Device keys that hold user data (settings and backups are deliberately kept). */
const DATA_KEYS = [
  'bloom.habits.v1',
  'bloom.todos.v1',
  'bloom.seq.v1',
  'bloom.todoSeq.v1',
  'bloom.historyStart.v1',
  'bloom.pendingDeletes.v1',
]

async function clearLocal(): Promise<void> {
  for (const key of DATA_KEYS) {
    await Preferences.remove({ key })
  }
  // The overdue-nudge ledger and manual order both key off task ids, so they
  // must not outlive them.
  await nudgeStore.clear()
  await todoOrderStore.clear()
}

export const dataClient = {
  isLocal: localMode,
  async clearAll(): Promise<void> {
    if (localMode) return clearLocal()
    return api.data.clear()
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
   * records straight through (keeping ids and history); REST mode hands the
   * whole bundle to the server's transactional import endpoint, so a failure
   * rolls back and leaves the previous dataset intact.
   */
  async importAll(bundle: { habits: Habit[]; todos: Todo[] }): Promise<void> {
    // Imported records may reuse ids, so start the nudge ledger and manual
    // order fresh.
    await nudgeStore.clear()
    await todoOrderStore.clear()
    if (localMode) {
      await Promise.all([
        localStore.replaceAll(bundle.habits),
        localTodoStore.replaceAll(bundle.todos),
      ])
      return
    }
    await api.data.import(bundle)
  },
}
