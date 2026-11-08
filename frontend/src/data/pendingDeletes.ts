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

/**
 * Serialise the queue's read-modify-writes. Without this a fast delete→undo can
 * read the pre-schedule array and skip the write, so the undo is lost and the
 * item is deleted on the next launch.
 */
let queue: Promise<unknown> = Promise.resolve()

function mutate<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn)
  // Keep the chain alive even when an operation rejects.
  queue = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

/** Remember that an item will be deleted once its undo window closes. */
export function schedulePendingDelete(kind: PendingDeleteKind, id: number): void {
  void mutate(async () => {
    const items = await readAll()
    if (items.some((p) => p.kind === kind && p.id === id)) return
    items.push({ kind, id })
    await writeAll(items)
  }).catch(() => {
    /* A failed persist must not surface as an unhandled rejection. */
  })
}

/** Forget a scheduled deletion — the user undid it, or it was just committed. */
export function clearPendingDelete(kind: PendingDeleteKind, id: number): void {
  void mutate(async () => {
    const items = await readAll()
    // Always write: the item may have been scheduled since the read.
    await writeAll(items.filter((p) => !(p.kind === kind && p.id === id)))
  }).catch(() => {
    /* A failed persist must not surface as an unhandled rejection. */
  })
}

/** Apply deletions left over from a previous session before the app renders. */
export async function flushPendingDeletes(): Promise<void> {
  return mutate(async () => {
    const items = await readAll()
    if (items.length === 0) return
    // Apply each delete and drop only the ids that succeeded, so a failure
    // stays queued for a later retry instead of resurrecting the row.
    const results = await Promise.allSettled(items.map((item) => removeOne(item)))
    const failed = items.filter((_, index) => results[index].status === 'rejected')
    await writeAll(failed)
  })
}
