import { Preferences } from '@capacitor/preferences'
import { minutesOfDay, nearestReminderPreset } from '../lib/reminder'

/**
 * Local data-schema versioning.
 *
 * The device store (habits, tasks, settings) can outlive many app versions, so
 * we stamp a schema version alongside it and run forward-only migrations on
 * startup. Each migration is idempotent and defensive: a corrupt or unknown
 * payload is left alone rather than wiped.
 */

export const SETTINGS_SCHEMA_VERSION = 2
export const LOCAL_SCHEMA_KEY = 'bloom.schema.v1'

const HABITS_KEY = 'bloom.habits.v1'
const TODOS_KEY = 'bloom.todos.v1'
const SETTINGS_KEY = 'bloom.settings.v1'

type Migration = {
  version: number
  /** Short description, useful in logs. */
  label: string
  run: () => Promise<void>
}

async function readJson<T>(key: string): Promise<T | null> {
  const { value } = await Preferences.get({ key })
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  await Preferences.set({ key, value: JSON.stringify(value) })
}

const TIME = /^\d{1,2}:\d{2}$/

/** Convert a legacy "HH:mm" reminder time into minutes before the deadline. */
function legacyHabitOffset(reminderTime: unknown, deadline: unknown): number | null {
  if (typeof reminderTime !== 'string' || !TIME.test(reminderTime)) return null
  const end = typeof deadline === 'string' && TIME.test(deadline) ? deadline : '23:59'
  return nearestReminderPreset(Math.max(0, minutesOfDay(end) - minutesOfDay(reminderTime)))
}

/** Convert a legacy default "HH:mm" time into minutes before end of day. */
function legacyDefaultOffset(reminderTime: unknown): number | null {
  if (typeof reminderTime !== 'string' || !TIME.test(reminderTime)) return null
  return nearestReminderPreset(Math.max(0, 1439 - minutesOfDay(reminderTime)))
}

/**
 * Backfill fields added in later releases so old records don't crash the UI.
 * `localStore`/`localTodoStore` also normalise on read — this keeps the stored
 * copy honest too.
 */
async function backfillRecords(): Promise<void> {
  const habits = await readJson<Array<Record<string, unknown>>>(HABITS_KEY)
  if (habits) {
    const next = habits.map((habit, index) => ({
      schedule: { type: 'daily' },
      target: 1,
      category: 'General',
      archived: false,
      order: index,
      reminderOffset: null,
      history: [],
      frozen: [],
      ...habit,
    }))
    await writeJson(HABITS_KEY, next)
  }

  const todos = await readJson<Array<Record<string, unknown>>>(TODOS_KEY)
  if (todos) {
    const next = todos.map((todo) => ({
      note: null,
      category: 'personal',
      dueDate: null,
      dueTime: null,
      completedAt: null,
      ...todo,
    }))
    await writeJson(TODOS_KEY, next)
  }
}

/**
 * Move reminders from a fixed "HH:mm" clock time onto an offset before the
 * deadline, for both habits and the default. Read-time normalisers do the same
 * conversion, so this only keeps the stored copy in step.
 */
async function migrateReminders(): Promise<void> {
  const habits = await readJson<Array<Record<string, unknown>>>(HABITS_KEY)
  if (habits) {
    const next = habits.map((habit) => {
      const record = { ...habit }
      const legacy = record.reminderTime
      delete record.reminderTime
      if (record.reminderOffset === undefined) {
        record.reminderOffset = legacyHabitOffset(legacy, record.deadline)
      }
      return record
    })
    await writeJson(HABITS_KEY, next)
  }

  const settings = await readJson<Record<string, unknown>>(SETTINGS_KEY)
  if (settings) {
    const record = { ...settings }
    const legacy = record.defaultReminderTime
    delete record.defaultReminderTime
    if (record.defaultReminderOffset === undefined) {
      record.defaultReminderOffset = legacyDefaultOffset(legacy)
    }
    await writeJson(SETTINGS_KEY, record)
  }
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    label: 'richer habit model + task defaults',
    run: backfillRecords,
  },
  {
    version: 2,
    label: 'reminders as an offset before the deadline',
    run: migrateReminders,
  },
]

/** The schema version currently stored on the device (0 when never stamped). */
export async function readSchemaVersion(): Promise<number> {
  const { value } = await Preferences.get({ key: LOCAL_SCHEMA_KEY })
  const parsed = value ? Number(value) : 0
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Run any migrations newer than what's stored. Safe to call on every startup —
 * it short-circuits when already current.
 */
export async function runMigrations(): Promise<void> {
  const current = await readSchemaVersion()
  const target = Math.max(SETTINGS_SCHEMA_VERSION, ...MIGRATIONS.map((m) => m.version))
  if (current >= target) return

  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue
    try {
      await migration.run()
    } catch {
      // Never block startup on a migration; the read-time normalisers are the
      // safety net.
    }
  }

  await Preferences.set({ key: LOCAL_SCHEMA_KEY, value: String(target) })
}
