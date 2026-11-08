import { Preferences } from '@capacitor/preferences'
import type {
  CompletionSound,
  HabitSort,
  Settings,
  SoundChoice,
  StreakDisplay,
  TodoSort,
} from '../types'
import { SETTINGS_SCHEMA_VERSION } from '../data/migrations'
import { minutesOfDay, nearestReminderPreset, snapReminderOffset } from '../lib/reminder'
import { WEEKLY_FREEZES } from '../lib/freezes'

/**
 * On-device settings store. Uses Capacitor Preferences, which falls back to
 * localStorage on the web, so the web and Android builds behave identically.
 */

const SETTINGS_KEY = 'bloom.settings.v1'

export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: SETTINGS_SCHEMA_VERSION,
  notificationsEnabled: false,
  taskReminders: true,
  /** New habits start with a reminder an hour before their deadline. */
  defaultReminderOffset: 60,
  reminderSound: 'bloom_chime',
  completionSound: 'same',
  weekStart: 1,
  timeFormat: '12',
  habitSort: 'incomplete',
  todoSort: 'due',
  hideCompleted: false,
  quickAddGuidance: true,
  followClock: false,
  streakDisplay: 'momentum',
  celebrations: false,
  haptics: false,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  reminderDigest: false,
  overdueNudges: true,
  followClockNotice: true,
  freezeTokens: WEEKLY_FREEZES,
  lastFreezeWeek: null,
  onboarded: false,
  termsAcceptedAt: null,
  autoBackupEnabled: true,
  lastBackupAt: null,
}

/** Stored settings may predate newer fields, hence the legacy entry. */
type RawSettings = Partial<Settings> & {
  defaultReminderTime?: string | null
}

function soundFrom(value: unknown, fallback: SoundChoice): SoundChoice {
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

const HABIT_SORTS: HabitSort[] = ['incomplete', 'manual', 'deadline', 'name']

function sortFrom(value: unknown): HabitSort {
  return HABIT_SORTS.includes(value as HabitSort) ? (value as HabitSort) : 'incomplete'
}

const TODO_SORTS: TodoSort[] = ['due', 'importance', 'name', 'created', 'manual']

function todoSortFrom(value: unknown): TodoSort {
  return TODO_SORTS.includes(value as TodoSort) ? (value as TodoSort) : 'due'
}

const STREAK_DISPLAYS: StreakDisplay[] = ['flame', 'momentum', 'hidden']

function streakDisplayFrom(value: unknown): StreakDisplay {
  return STREAK_DISPLAYS.includes(value as StreakDisplay)
    ? (value as StreakDisplay)
    : DEFAULT_SETTINGS.streakDisplay
}

/** A 24-hour "HH:mm" clock time, e.g. "07:30". Anything else is rejected. */
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

function hhmmFrom(value: unknown, fallback: string): string {
  return typeof value === 'string' && HHMM.test(value) ? value : fallback
}

/**
 * Resolve the default reminder offset. An explicit value (even null) wins;
 * otherwise the legacy fixed "HH:mm" default is converted relative to 23:59.
 */
function defaultOffsetFrom(raw: RawSettings): number | null {
  if (raw.defaultReminderOffset !== undefined) return snapReminderOffset(raw.defaultReminderOffset)
  const legacy = raw.defaultReminderTime
  if (typeof legacy === 'string' && /^\d{1,2}:\d{2}$/.test(legacy)) {
    return nearestReminderPreset(Math.max(0, 1439 - minutesOfDay(legacy)))
  }
  return DEFAULT_SETTINGS.defaultReminderOffset
}

/** Coerce stored/partial data into a complete, valid Settings object. */
export function normalizeSettings(raw: RawSettings | null): Settings {
  const source = raw ?? {}
  const merged = { ...DEFAULT_SETTINGS, ...source }
  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    notificationsEnabled: Boolean(merged.notificationsEnabled),
    taskReminders: merged.taskReminders !== false,
    defaultReminderOffset: defaultOffsetFrom(source),
    reminderSound: soundFrom(merged.reminderSound, DEFAULT_SETTINGS.reminderSound),
    completionSound: soundFrom(
      merged.completionSound,
      DEFAULT_SETTINGS.completionSound,
    ) as CompletionSound,
    weekStart: merged.weekStart === 0 ? 0 : 1,
    timeFormat: merged.timeFormat === '24' ? '24' : '12',
    habitSort: sortFrom(merged.habitSort),
    todoSort: todoSortFrom(merged.todoSort),
    hideCompleted: Boolean(merged.hideCompleted),
    quickAddGuidance: merged.quickAddGuidance !== false,
    followClock: Boolean(merged.followClock),
    streakDisplay: streakDisplayFrom(merged.streakDisplay),
    celebrations: Boolean(merged.celebrations),
    haptics: Boolean(merged.haptics),
    quietHoursEnabled: Boolean(merged.quietHoursEnabled),
    quietHoursStart: hhmmFrom(merged.quietHoursStart, DEFAULT_SETTINGS.quietHoursStart),
    quietHoursEnd: hhmmFrom(merged.quietHoursEnd, DEFAULT_SETTINGS.quietHoursEnd),
    reminderDigest: Boolean(merged.reminderDigest),
    overdueNudges: merged.overdueNudges !== false,
    followClockNotice: merged.followClockNotice !== false,
    freezeTokens: Number.isFinite(merged.freezeTokens)
      ? Math.max(0, Math.round(merged.freezeTokens))
      : WEEKLY_FREEZES,
    lastFreezeWeek: typeof merged.lastFreezeWeek === 'string' ? merged.lastFreezeWeek : null,
    onboarded: Boolean(merged.onboarded),
    termsAcceptedAt:
      typeof merged.termsAcceptedAt === 'string' && merged.termsAcceptedAt
        ? merged.termsAcceptedAt
        : null,
    autoBackupEnabled: merged.autoBackupEnabled !== false,
    lastBackupAt: typeof merged.lastBackupAt === 'string' ? merged.lastBackupAt : null,
  }
}

export const settingsStore = {
  async read(): Promise<Settings> {
    const { value } = await Preferences.get({ key: SETTINGS_KEY })
    if (!value) return { ...DEFAULT_SETTINGS }
    try {
      return normalizeSettings(JSON.parse(value) as RawSettings)
    } catch {
      return { ...DEFAULT_SETTINGS }
    }
  },

  async write(settings: Settings): Promise<void> {
    await Preferences.set({
      key: SETTINGS_KEY,
      value: JSON.stringify(settings),
    })
  },
}
