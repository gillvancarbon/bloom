import { Preferences } from '@capacitor/preferences'
import { api } from '../api'
import { localStore } from './localStore'
import { localTodoStore } from './localTodoStore'

/**
 * A tiny durable queue of deletions that are waiting out their undo window.
 *
 * Deletes are optimistic: the row disappears instantly and is really removed
 * once the undo toast closes. Persisting the queue means a reload (or a cold
 * start on device) in that window still applies the deletion instead of
 * resurrecting the row.
 */

export type PendingDeleteKind = 'habit' | 'todo'

interface PendingDelete {
  kind: PendingDeleteKind
  id: number
}

const KEY = 'bloom.pendingDeletes.v1'
const localMode = import.meta.env.VITE_DATA_MODE === 'local'

async function readAll(): Promise<PendingDelete[]> {
  try {
    const { value } = await Preferences.get({ key: KEY })
    if (!value) return []
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is PendingDelete =>
        !!item && (item.kind === 'habit' || item.kind === 'todo') && typeof item.id === 'number',
    )
  } catch {
    return []
  }
}

async function writeAll(items: PendingDelete[]): Promise<void> {
  await Preferences.set({ key: KEY, value: JSON.stringify(items) })
}

async function removeOne({ kind, id }: PendingDelete): Promise<void> {
  if (kind === 'habit') {
    return localMode ? localStore.remove(id) : api.remove(id)
  }
  return localMode ? localTodoStore.remove(id) : api.todos.remove(id)
}

/** Remember that an item will be deleted once its undo window closes. */
export function schedulePendingDelete(kind: PendingDeleteKind, id: number): void {
  void (async () => {
    const items = await readAll()
    if (items.some((p) => p.kind === kind && p.id === id)) return
    items.push({ kind, id })
    await writeAll(items)
  })()
}

/** Forget a scheduled deletion — the user undid it, or it was just committed. */
export function clearPendingDelete(kind: PendingDeleteKind, id: number): void {
  void (async () => {
    const items = await readAll()
    const next = items.filter((p) => !(p.kind === kind && p.id === id))
    if (next.length !== items.length) await writeAll(next)
  })()
}

/** Apply deletions left over from a previous session before the app renders. */
export async function flushPendingDeletes(): Promise<void> {
  const items = await readAll()
  if (items.length === 0) return
  // Clear first so a re-entry can't double-delete.
  await writeAll([])
  await Promise.allSettled(items.map((item) => removeOne(item)))
}
