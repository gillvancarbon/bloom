import { Preferences } from '@capacitor/preferences'

/**
 * A tiny ledger of which "this task is overdue" nudges have already gone out.
 *
 * The to-do list is rebuilt and re-armed every time the app opens or the data
 * changes, so without a memory it would re-notify the same overdue task on
 * every sync. Each entry keys off the task id plus its due moment, which means
 * moving the due date (or completing and rolling a repeating task forward)
 * earns one fresh nudge, while simply reopening the app does not.
 */

const NUDGES_KEY = 'bloom.overdueNudges.v1'
/** Plenty of headroom; old entries are pruned first so the key can't grow forever. */
const MAX_ENTRIES = 500

async function readAll(): Promise<string[]> {
  const { value } = await Preferences.get({ key: NUDGES_KEY })
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === 'string')
      : []
  } catch {
    return []
  }
}

export const nudgeStore = {
  /** The due occurrences already nudged as overdue. */
  async list(): Promise<Set<string>> {
    return new Set(await readAll())
  },

  /** Remember the given occurrences, keeping the ledger bounded. */
  async mark(keys: string[]): Promise<void> {
    if (!keys.length) return
    const merged = [...new Set([...keys, ...(await readAll())])]
    await Preferences.set({ key: NUDGES_KEY, value: JSON.stringify(merged.slice(0, MAX_ENTRIES)) })
  },

  /** Drop the ledger (e.g. when all data is cleared). */
  async clear(): Promise<void> {
    await Preferences.remove({ key: NUDGES_KEY })
  },
}
