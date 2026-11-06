import { Preferences } from '@capacitor/preferences'

/**
 * Remembers the user's manual to-do order as a plain list of task ids.
 *
 * Order lives beside the tasks rather than inside them, so it works the same
 * whether the tasks come from the on-device store or the backend, and re-import
 * or restore can simply start it fresh. Ids the app no longer knows about are
 * harmless — they are simply never matched.
 */

const ORDER_KEY = 'bloom.todoOrder.v1'

async function readAll(): Promise<number[]> {
  const { value } = await Preferences.get({ key: ORDER_KEY })
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((id): id is number => typeof id === 'number') : []
  } catch {
    return []
  }
}

export const todoOrderStore = {
  read: readAll,

  async write(ids: number[]): Promise<void> {
    await Preferences.set({ key: ORDER_KEY, value: JSON.stringify(ids) })
  },

  async clear(): Promise<void> {
    await Preferences.remove({ key: ORDER_KEY })
  },
}
