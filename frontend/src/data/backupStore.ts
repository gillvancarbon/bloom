import { Preferences } from '@capacitor/preferences'

/**
 * Automatic local backups.
 *
 * Every launch (at most once a day) we snapshot all of the app's device keys
 * into a rolling set of restore points. Because the whole dataset lives on the
 * device, this is cheap insurance against a bad edit, a corrupt write, or an
 * accidental "clear all" — no network, no account.
 */

const BACKUPS_KEY = 'bloom.backups.v1'
/** Keys to snapshot — everything the app owns, minus the backups themselves. */
const DATA_PREFIX = 'bloom.'
const MAX_BACKUPS = 5

export interface Backup {
  at: string
  reason: string
  data: Record<string, string>
}

async function readBackups(): Promise<Backup[]> {
  const { value } = await Preferences.get({ key: BACKUPS_KEY })
  if (!value) return []
  try {
    const parsed = JSON.parse(value) as Backup[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeBackups(backups: Backup[]): Promise<void> {
  await Preferences.set({ key: BACKUPS_KEY, value: JSON.stringify(backups) })
}

/** Snapshot every `bloom.*` key (except the backup log itself). */
async function snapshot(): Promise<Record<string, string>> {
  const { keys } = await Preferences.keys()
  const data: Record<string, string> = {}
  for (const key of keys) {
    if (!key.startsWith(DATA_PREFIX) || key === BACKUPS_KEY) continue
    const { value } = await Preferences.get({ key })
    if (value !== null) data[key] = value
  }
  return data
}

export const backupStore = {
  async list(): Promise<Backup[]> {
    const backups = await readBackups()
    return [...backups].sort((a, b) => b.at.localeCompare(a.at))
  },

  async latestAt(): Promise<string | null> {
    const [first] = await this.list()
    return first?.at ?? null
  },

  /** Write a fresh restore point, rotating out the oldest beyond MAX_BACKUPS. */
  async create(reason: string): Promise<Backup> {
    const data = await snapshot()
    const backup: Backup = { at: new Date().toISOString(), reason, data }
    const existing = await readBackups()
    const next = [backup, ...existing].slice(0, MAX_BACKUPS)
    await writeBackups(next)
    return backup
  },

  /**
   * Create a backup at most once per day. Returns the new backup, or null when
   * one was already taken recently or backups are disabled.
   */
  async createIfDue(enabled: boolean): Promise<Backup | null> {
    if (!enabled) return null
    const latest = await backupStore.latestAt()
    if (latest) {
      const ageMs = Date.now() - new Date(latest).getTime()
      if (ageMs < 24 * 60 * 60 * 1000) return null
    }
    return backupStore.create('automatic')
  },

  /** Restore every key from a backup, replacing the current data. */
  async restore(backup: Backup): Promise<void> {
    // Take a safety snapshot first so a restore is itself undoable.
    await backupStore.create('before restore')

    // A restore replaces the dataset: drop any `bloom.*` key the backup doesn't
    // know about, so data added after the snapshot can't leak into the restore.
    const restored = new Set(Object.keys(backup.data))
    const { keys } = await Preferences.keys()
    for (const key of keys) {
      if (!key.startsWith(DATA_PREFIX) || key === BACKUPS_KEY) continue
      if (restored.has(key)) continue
      await Preferences.remove({ key })
    }

    for (const [key, value] of Object.entries(backup.data)) {
      await Preferences.set({ key, value })
    }
  },
}
