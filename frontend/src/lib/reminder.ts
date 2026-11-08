import type { Habit, Settings } from '../types'
import { formatTime } from './format'

/**
 * Reminders are expressed as an offset *before* the habit's daily deadline,
 * rather than a fixed clock time, so changing a deadline keeps the nudge in the
 * right place ("1 hour before" stays 1 hour before).
 */

/** The preset choices, as minutes before the deadline. */
export const REMINDER_OFFSETS = [0, 15, 30, 60, 120, 180] as const

export interface ReminderOption {
  /** Minutes before the deadline, or null for no reminder. */
  value: number | null
  label: string
}

export const REMINDER_OPTIONS: ReminderOption[] = [
  { value: null, label: 'No reminder' },
  { value: 0, label: 'At the deadline' },
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 120, label: '2 hours before' },
  { value: 180, label: '3 hours before' },
]

/** A short phrase for an offset, e.g. 60 → "1 hour". */
export function offsetPhrase(offset: number): string {
  if (offset < 60) return `${offset} minutes`
  const hours = offset / 60
  if (Number.isInteger(hours)) return hours === 1 ? '1 hour' : `${hours} hours`
  return `${offset} minutes`
}

export function reminderOptionLabel(offset: number | null): string {
  return REMINDER_OPTIONS.find((option) => option.value === offset)?.label ?? 'No reminder'
}

/** Minutes since midnight for an "HH:mm" string. */
export function minutesOfDay(hhmm: string): number {
  const [rawHour, rawMinute] = (hhmm || '').split(':').map(Number)
  const hour = Number.isFinite(rawHour) ? rawHour : 0
  const minute = Number.isFinite(rawMinute) ? rawMinute : 0
  return Math.min(1439, Math.max(0, hour * 60 + minute))
}

/** Minutes since midnight back to an "HH:mm" string, clamped to one day. */
export function toHHMM(minutes: number): string {
  const clamped = Math.min(1439, Math.max(0, Math.round(minutes)))
  const hour = Math.floor(clamped / 60)
  const minute = clamped % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

/** The clock time for a reminder: the deadline moved back by `offset` minutes. */
export function reminderClock(deadline: string, offset: number): string {
  return toHHMM(minutesOfDay(deadline) - offset)
}

/**
 * The quiet-hours window to honour right now, or null when the feature is off.
 *
 * Kept as a small pure helper (rather than reading the two settings fields at
 * every call site) so the "is this moment audible?" rule is decided in one place
 * and can be unit-tested without the notification plugin.
 */
export function quietWindow(settings: Settings): { start: string; end: string } | null {
  if (!settings.quietHoursEnabled) return null
  return { start: settings.quietHoursStart, end: settings.quietHoursEnd }
}

/** The preset closest to an arbitrary offset — used when migrating old data. */
export function nearestReminderPreset(minutes: number): number {
  const safe = Math.max(0, minutes)
  return REMINDER_OFFSETS.reduce((best, option) =>
    Math.abs(option - safe) < Math.abs(best - safe) ? option : best,
  )
}

/** Coerce any stored value into a valid offset (or null). */
export function normalizeReminderOffset(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number)) return null
  return Math.max(0, Math.round(number))
}

/**
 * Like {@link normalizeReminderOffset}, but snaps to the nearest preset so any
 * legacy or hand-edited value becomes one the picker can display.
 */
export function snapReminderOffset(value: unknown): number | null {
  const offset = normalizeReminderOffset(value)
  return offset == null ? null : nearestReminderPreset(offset)
}

/**
 * The clock time a habit will remind, as "HH:mm", or null when reminders are
 * off (globally or for this habit).
 */
export function reminderTimeFor(habit: Habit, settings: Settings): string | null {
  if (!settings.notificationsEnabled) return null
  if (habit.reminderOffset == null) return null
  return reminderClock(habit.deadline, habit.reminderOffset)
}

/** Human preview, e.g. "8:00 PM". */
export function reminderPreview(habit: Habit, settings: Settings): string | null {
  const time = reminderTimeFor(habit, settings)
  return time ? formatTime(time, settings.timeFormat) : null
}

/** The notification body for a habit reminder. */
export function reminderBody(habit: Habit): string {
  const offset = habit.reminderOffset
  const suffix = habit.target > 1 ? ` (${habit.target}× today)` : ''
  if (!offset) return `Time for “${habit.name}”${suffix}.`
  return `“${habit.name}” is due in ${offsetPhrase(offset)}${suffix}.`
}
